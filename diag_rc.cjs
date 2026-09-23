const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb://localhost:27017';
const DB = 'scre_db';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);

  console.log('=== Root Cause Deep Dive ===\n');

  // ===== ROOT CAUSE 1: SourceC exam_v2_papers.exam_id ====
  console.log('--- RC1: exam_v2_papers FIELDS IN FULL (all 5 docs) ---');
  const v2 = await db.collection('exam_v2_papers').find({}).toArray();
  for (const p of v2) {
    console.log('paper._id=', p._id.toHexString());
    console.log('  fields:', Object.keys(p).join(', '));
    console.log('  student_id =', p.student_id?.toHexString?.() ?? String(p.student_id), 'type:', typeof p.student_id);
    console.log('  exam_id exists?', 'exam_id' in p, 'value=', p.exam_id, 'type:', typeof p.exam_id);
    console.log('  course_id exists?', 'course_id' in p, 'value=', p.course_id);
    console.log('  status =', p.status);
    console.log('  attempt_number =', p.attempt_number);
    console.log('');
  }

  // ===== ROOT CAUSE 2: exam_v1_papers / student_papers =====
  console.log('--- RC1b: student_papers status counts (legacy v1 papers) ---');
  const spStatuses = await db.collection('student_papers').aggregate([
    { $group: { _id: { $ifNull: ['$status', '__null__'] }, count: { $sum: 1 } } },
  ]).toArray();
  for (const s of spStatuses) console.log(`  status="${s._id}" count=${s.count}`);
  console.log('');
  const spEvaluated = await db.collection('student_papers').find({
    status: { $regex: 'evaluated|Evaluated|Evaluated', $options: '' },
  }).limit(5).toArray();
  console.log(`student_papers status matching evaluated: total ${await db.collection('student_papers').countDocuments({ status: { $regex: 'evaluated', $options: 'i' } })}`);
  for (const p of spEvaluated) {
    console.log('  sp._id=', p._id.toHexString(), 'status=', p.status, 'student_id=', p.student_id?.toHexString?.(), 'subject_id=', p.subject_id?.toHexString?.(), 'course_id=', p.course_id ?? 'ABSENT');
  }

  // ===== ROOT CAUSE 2: SourceA certificate_eligibility empty =====
  console.log('\n--- RC2: certificate_eligibility=0. Are there ANY docs with any eligibility_type? ---');
  const ceAny = await db.collection('certificate_eligibility').find({}).limit(10).toArray();
  console.log(`Count: ${ceAny.length}. Fields on each (if any):`);
  for (const x of ceAny) console.log(' ', Object.keys(x).join(','));

  // ===== ROOT CAUSE 3: certificates.certificate_type field missing =====
  console.log('\n--- RC3: certificates.certificate_type, course_id, attempt_number ---');
  const certCounts = await db.collection('certificates').aggregate([
    { $group: { _id: {
      certType: { $ifNull: ['$certificate_type', '__UNDEFINED__'] },
      courseIdMissing: { $cond: [{ $ifNull: ['$course_id', false] }, 'course_id_present', 'course_id_ABSENT'] },
      attemptMissing: { $cond: [{ $ifNull: ['$attempt_number', false] }, 'attempt_present', 'attempt_ABSENT'] },
    }, count: { $sum: 1 } } },
  ]).toArray();
  for (const g of certCounts) {
    console.log(`  certificate_type=${g._id.certType} course_id=${g._id.courseIdMissing} attempt_num=${g._id.attemptMissing} count=${g.count}`);
  }

  const certsSamp = await db.collection('certificates').find({}).limit(5).toArray();
  for (const c of certsSamp) {
    console.log('\n  cert doc full keys:', Object.keys(c).join(','));
    console.log('    certificate_no =', c.certificate_number ?? c.certificate_no ?? '(no cert number field!)');
    console.log('    type from name field guess =', c.type ?? '(no c.type either!)');
    for (const k of ['certificate_type','type','cert_type','doc_type','kind','category']) {
      if (k in c) console.log(`    ${k}=`, c[k]);
    }
    // check for any string-type field
    for (const k of Object.keys(c)) {
      const v = c[k];
      if (typeof v === 'string' && /marksheet|certificate/i.test(v)) {
        console.log(`    FOUND MARKER: ${k} =`, v);
      }
    }
  }

  // ===== ROOT CAUSE 4: SourceC student_ids don't exist in users =====
  console.log('\n--- RC4: exam_v2_papers.student_id → users lookup ---');
  for (const p of v2) {
    const sid = p.student_id;
    if (!sid) { console.log('  paper has no student_id!'); continue; }
    const uAny = await db.collection('users').findOne({ _id: sid });
    const uActive = await db.collection('users').findOne({ _id: sid, is_deleted: { $ne: true } });
    console.log(`  sid=${sid.toHexString()} in users at all: ${uAny ? 'YES (role='+uAny.role+' active='+uAny.active+' is_del='+uAny.is_deleted+')' : 'NO'} active+non-deleted: ${uActive ? 'YES' : 'NO'}`);
  }

  // ===== SPECULATIVE: is SourceC actually supposed to use course_id direct or from paper-to-course via another field? =====
  console.log('\n--- RC1c: Do exam_v2_papers have course_id directly, or a join field OTHER than exam_id? ---');
  for (const p of v2) {
    const fks = Object.keys(p).filter(k => /_id$/.test(k));
    console.log('  paper._id=', p._id.toHexString(), 'FK fields:', fks.map(k=>`${k}=${typeof p[k]}`).join(', '));
  }

  // ===== Also verify SourceB (course_exam_attempts) 5 records, and whether each student+course actually shows in users correctly =====
  console.log('\n--- SourceB full: course_exam_attempts 5 records and users lookup for each + course + marks_submitted + result ---');
  const ceas = await db.collection('course_exam_attempts').find({}).toArray();
  for (const a of ceas) {
    const u = await db.collection('users').findOne({ _id: a.student_id });
    const c = await db.collection('courses').findOne({ _id: a.course_id });
    console.log('  attempt:', a._id.toHexString(), 'sid=', a.student_id.toHexString(), 'cid=', a.course_id.toHexString());
    console.log('    marks_submitted=', a.marks_submitted, 'overall_result=', a.overall_result, 'attempt_number=', a.attempt_number);
    console.log('    user lookup:', u ? `name=${u.full_name||u.student_name} role=${u.role} is_del=${u.is_deleted} active=${u.active}` : 'USER NOT FOUND IN DB!');
    console.log('    course lookup:', c ? `"${c.course_name}"` : 'COURSE NOT FOUND!');
  }

  // ===== SourceD certificates 102 docs, find student_ids that do exist =====
  console.log('\n--- SourceD: 102 certificates; find distinct student_ids that DO exist in users ---');
  const allCertStudents = await db.collection('certificates').distinct('student_id');
  let foundActive = 0, foundInactive=0, notFound=0;
  for (const sid of allCertStudents) {
    const u = await db.collection('users').findOne({ _id: sid });
    if (!u) notFound++;
    else if (u.is_deleted || !u.active) foundInactive++;
    else foundActive++;
  }
  console.log(`  ${allCertStudents.length} distinct cert student_ids: found active=${foundActive} found inactive/deleted=${foundInactive} not-in-users-at-all=${notFound}`);

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
