const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: __dirname + '/.env' });

const URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const DB = process.env.DATABASE_NAME || 'scre_db';
const SINGLETON = ObjectId.createFromHexString('000000000000000000000001');

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);
  console.log('=== STEP 2: system_settings ===');
  const byId = await db.collection('system_settings').findOne({ _id: SINGLETON });
  const any = await db.collection('system_settings').findOne({});
  console.log('count:', await db.collection('system_settings').countDocuments());
  console.log('singleton match _id=', SINGLETON.toHexString(), ':', byId ? 'FOUND' : 'MISSING');
  if (byId) {
    console.log(' auto_exam_enabled =', byId.auto_exam_enabled);
    console.log(' auto_exam_allotment_day =', byId.auto_exam_allotment_day);
    console.log(' auto_exam_day =', byId.auto_exam_day);
    console.log(' auto_exam_time =', byId.auto_exam_time);
    console.log(' auto_exam_subject_gap_minutes =', byId.auto_exam_subject_gap_minutes);
  } else {
    console.log(' !! system_settings NOT FOUND with singleton _id. Falling back find_one({}) returned:', any ? { enabled: any.auto_exam_enabled, day: any.auto_exam_allotment_day } : 'NULL');
  }

  const nowIST = new Date(Date.now() + 5.5*3600*1000);
  console.log('\ncurrent IST date Y-M-D =', nowIST.getUTCFullYear(), nowIST.getUTCMonth()+1, nowIST.getUTCDate());

  console.log('\n=== STEP 3: courses + default blueprints ===');
  const courses = await db.collection('courses').find({}).toArray();
  console.log('courses total =', courses.length);
  for (const c of courses) {
    const cid = c._id;
    const bp = await db.collection('exam_blueprints').findOne({ course_id: cid, default_blueprint: true });
    const allBp = await db.collection('exam_blueprints').countDocuments({ course_id: cid });
    const subjIds = bp ? bp.subjects.map(s => s.subject_id) : [];
    const subjValid = [];
    for (const sid of subjIds) {
      const exists = await db.collection('subjects').findOne({ _id: sid });
      subjValid.push(exists ? sid.toHexString().slice(-6)+':OK' : sid.toHexString().slice(-6)+':MISSING');
    }
    console.log(`  course ${c.course_name} (${cid.toHexString().slice(-6)})  blueprints_total=${allBp}  default_bp=${bp?'YES('+bp._id.toHexString().slice(-6)+') subjects='+subjIds.length+' ids_ok=['+subjValid.join(',')+']' : 'NO DEFAULT'}`);

    console.log(`    students in course (role=student active=true parent=active_center):`);
    const activeCenters = await db.collection('centers').find({ active: true, is_deleted: false }).project({ user_id: 1 }).toArray();
    const parentFilter = [];
    for (const ac of activeCenters) {
      parentFilter.push(ac.user_id);
      parentFilter.push(ac._id);
    }
    const totalStudents = await db.collection('users').countDocuments({
      role: 'student', active: true, is_deleted: { $ne: true },
      $or: [{ course_id: cid }, { course: c.course_name }],
      parent_id: { $in: parentFilter },
    });
    console.log(`      TOTAL raw course students (active center + active student) = ${totalStudents}`);

    // Simulate first-attempt eligibility:
    // - session_end_date <= today IST
    // - no appeared / existing allotment
    // - active+approved
    const stuCandidates = await db.collection('users').aggregate([
      { $match: {
          role: 'student', active: true, is_deleted: { $ne: true },
          $or: [{ course_id: cid }, { course: c.course_name }],
          parent_id: { $in: parentFilter },
      }},
      { $lookup: { from: 'course_exam_attempts', localField: '_id', foreignField: 'student_id', as: 'attempts', pipeline: [{ $match: { course_id: cid }}] }},
      { $lookup: { from: 'student_papers', localField: '_id', foreignField: 'student_id', as: 'papers', pipeline: [{ $match: { subject_id: { $in: subjIds }}}] }},
    ]).toArray();

    let courseEnded = 0, alreadyAppeared = 0, allotted = 0, inactive = 0, eligible = 0;
    const sampleEligible = [];
    const sampleRejected = [];
    for (const s of stuCandidates) {
      let rej = [];
      const d = s.session_end_date;
      let endedOk = false;
      if (d) {
        const dt = new Date(d);
        endedOk = !isNaN(dt) && dt <= new Date(nowIST.toISOString().slice(0,10) + 'T00:00:00Z');
      }
      if (!endedOk) { courseEnded++; rej.push('course_not_ended '+d); }
      const appeared = s.attempts.some(a => a.appeared || a.marks_submitted) || s.papers.some(p => ['InProgress','Submitted','Evaluated','submitted','evaluated'].includes(p.status));
      if (appeared) { alreadyAppeared++; rej.push('appeared'); }
      const hasAllot = s.papers.some(p => ['Generated','InProgress','Submitted','Evaluated','submitted','evaluated'].includes(p.status));
      if (hasAllot) { allotted++; rej.push('has_allot'); }
      const actOk = s.active && !s.is_deleted && (!s.approval_status || s.approval_status.toLowerCase() === 'approved');
      if (!actOk) { inactive++; rej.push('inactive '+s.approval_status); }
      if (endedOk && !appeared && !hasAllot && actOk) {
        eligible++;
        if (sampleEligible.length < 3) sampleEligible.push(s._id.toHexString().slice(-6)+' '+s.full_name+' ends='+d);
      } else if (sampleRejected.length < 5) {
        sampleRejected.push(s._id.toHexString().slice(-6)+' '+s.full_name+' ['+rej.join(' | ')+'] ends='+d);
      }
    }
    console.log(`      FIRST-ATTEMPT breakdown:  eligible=${eligible}  course_not_ended=${courseEnded}  already_appeared=${alreadyAppeared}  already_allotted=${allotted}  inactive=${inactive}  total=${stuCandidates.length}`);
    if (sampleEligible.length) console.log(`        sample eligible: ${sampleEligible.join('; ')}`);
    if (sampleRejected.length) console.log(`        sample rejected: ${sampleRejected.join('; ')}`);

    // reappear eligibility quick tally
    let reappElig = 0, neverApp = 0, notFailed = 0, notApproved = 0;
    const reappSamples = [];
    for (const s of stuCandidates) {
      const d = s.session_end_date;
      let endedOk = false;
      if (d) {
        const dt = new Date(d);
        endedOk = !isNaN(dt) && dt <= new Date(nowIST.toISOString().slice(0,10) + 'T00:00:00Z');
      }
      if (!endedOk) continue;
      const latestSubmit = s.attempts.filter(a => a.marks_submitted).sort((a,b)=>b.attempt_number-a.attempt_number)[0];
      const prev = latestSubmit ? latestSubmit.attempt_number : 0;
      const hadAllot = prev>0 && s.papers.some(p => p.attempt_number === prev);
      const everAppeared = (s.attempts.some(a => a.appeared) || s.papers.some(p => ['InProgress','Submitted','Evaluated','submitted','evaluated'].includes(p.status)));
      if (!everAppeared && !hadAllot) { neverApp++; continue; }
      const failed = latestSubmit && latestSubmit.overall_result && latestSubmit.overall_result.toLowerCase() === 'fail';
      if (!failed) { notFailed++; continue; }
      const approved = s.attempts.some(a => a.attempt_number===latestSubmit.attempt_number+1 && a.allow_reappear && !a.marks_submitted && a.attempt_number>1);
      if (!approved) { notApproved++; continue; }
      const actOk = s.active && !s.is_deleted && (!s.approval_status || s.approval_status.toLowerCase() === 'approved');
      if (!actOk) continue;
      const hasActive = s.papers.some(p => ['Generated','InProgress'].includes(p.status));
      if (hasActive) continue;
      reappElig++;
      if (reappSamples.length < 3) reappSamples.push(s._id.toHexString().slice(-6)+' '+s.full_name+' fail_att='+(latestSubmit?latestSubmit.attempt_number:0));
    }
    console.log(`      REAPPEAR breakdown:  eligible=${reappElig}  never_appeared=${neverApp}  not_failed=${notFailed}  reapp_not_approved=${notApproved}`);
    if (reappSamples.length) console.log(`        samples reapp eligible: ${reappSamples.join('; ')}`);
  }

  console.log('\n=== STEP 7: MongoDB collections state ===');
  for (const col of ['exam_auto_allotment_runs','exam_allotment_batches','student_papers','course_exam_attempts']) {
    const cnt = await db.collection(col).countDocuments();
    const sample = await db.collection(col).find({}).sort({created_at:-1}).limit(3).toArray();
    console.log(`  ${col}: count=${cnt}`);
    for (const s of sample) {
      console.log(`    - _id=${s._id.toHexString().slice(-8)} ${s.status||''} ${s.course_id?('course='+String(s.course_id).slice(-6)):''} ${s.year?'Y'+s.year+'-M'+s.month:''} ${s.for_reappear===undefined?'':(s.for_reappear?'reappear':'regular')} ${s.source||''} allotted=${s.allotted_count??''}`);
    }
  }
  await client.close();
}
main().catch(e => { console.error('ERR', e); process.exit(1); });
