const { MongoClient, ObjectId } = require('mongodb');

const URI = 'mongodb://localhost:27017';
const DB = 'scre_db';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);
  console.log('Connected to', URI, '/', DB, '\n');

  // ---------- COUNT ALL KEY COLLECTIONS ----------
  const keyCols = [
    'users',
    'centers',
    'courses',
    'course_exam_attempts',
    'certificate_eligibility',
    'exam_v2_papers',
    'exam_v2_exams',
    'certificates',
    'student_papers',
  ];
  console.log('=== COLLECTION COUNTS ===');
  for (const c of keyCols) {
    try {
      const cnt = await db.collection(c).countDocuments();
      console.log(`  ${c.padEnd(30)} ${cnt}`);
    } catch (e) {
      console.log(`  ${c.padEnd(30)} ERR: ${e.message}`);
    }
  }

  // ---------- COUNT FILTERED SUBSETS ----------
  console.log('\n=== FILTERED COUNTS (exact same filters as listing handler) ===');

  // Users: total students (lenient role check)
  const totalStudentLike = await db.collection('users').countDocuments({
    is_deleted: { $ne: true },
    $or: [
      { role: { $exists: false } },
      { role: null },
      { role: '' },
      { role: { $regex: 'student', $options: 'i' } },
    ],
  });
  console.log(`  users (student-like, is_deleted!=true):   ${totalStudentLike}`);

  // Source A: certificate_eligibility
  const ce_all = await db.collection('certificate_eligibility').countDocuments({});
  const ce_marksheet = await db.collection('certificate_eligibility').countDocuments({ eligibility_type: 'marksheet' });
  const ce_certificate = await db.collection('certificate_eligibility').countDocuments({ eligibility_type: 'certificate' });
  console.log(`  certificate_eligibility:                  ${ce_all}  (marksheet=${ce_marksheet}, certificate=${ce_certificate})`);

  // Source B: course_exam_attempts (marks submitted OR overall_result)
  const c_total = await db.collection('course_exam_attempts').countDocuments({});
  const c_marksSub = await db.collection('course_exam_attempts').countDocuments({ marks_submitted: true });
  const c_resultExists = await db.collection('course_exam_attempts').countDocuments({
    overall_result: { $exists: true, $nin: [null, ''] },
  });
  const c_sourceB = await db.collection('course_exam_attempts').countDocuments({
    $or: [
      { marks_submitted: true },
      { overall_result: { $exists: true, $nin: [null, ''] } },
    ],
  });
  const c_pass = await db.collection('course_exam_attempts').countDocuments({
    overall_result: { $regex: '^pass$', $options: 'i' },
  });
  console.log(`  course_exam_attempts:                     ${c_total} total`);
  console.log(`    marks_submitted=true:                   ${c_marksSub}`);
  console.log(`    overall_result exists & non-empty:      ${c_resultExists}`);
  console.log(`    SourceB (OR of above two):              ${c_sourceB}`);
  console.log(`    overall_result="Pass":                  ${c_pass}`);

  // Source C: exam_v2_papers evaluated
  const v2_total = await db.collection('exam_v2_papers').countDocuments({});
  const v2_evaluated_regex = await db.collection('exam_v2_papers').countDocuments({
    status: { $regex: 'evaluated', $options: 'i' },
  });
  const v2_evaluated_exact = await db.collection('exam_v2_papers').countDocuments({
    status: { $in: ['Evaluated', 'evaluated', 'EVALUATED'] },
  });
  const v2_sourceC = await db.collection('exam_v2_papers').countDocuments({
    $or: [
      { status: { $regex: 'evaluated', $options: 'i' } },
      { status: { $in: ['Evaluated', 'evaluated', 'EVALUATED'] } },
    ],
  });
  console.log(`  exam_v2_papers:                           ${v2_total} total`);
  console.log(`    status regex /evaluated/i:              ${v2_evaluated_regex}`);
  console.log(`    status exact $in (3 case variants):     ${v2_evaluated_exact}`);
  console.log(`    SourceC (OR of above):                  ${v2_sourceC}`);

  // Source D: certificates
  const certs_total = await db.collection('certificates').countDocuments({});
  const certs_ms = await db.collection('certificates').countDocuments({ certificate_type: 'marksheet' });
  const certs_c = await db.collection('certificates').countDocuments({ certificate_type: 'certificate' });
  console.log(`  certificates:                             ${certs_total}  (marksheet=${certs_ms}, certificate=${certs_c})`);

  // ---------- DISTINCT STUDENTS PER SOURCE ----------
  console.log('\n=== DISTINCT student_ids / student+course pairs PER SOURCE ===');

  const distinctUsersInSourceA = await db.collection('certificate_eligibility').distinct('student_id');
  console.log(`  Source A (ce): distinct student_ids = ${distinctUsersInSourceA.length}`);
  if (distinctUsersInSourceA.length) {
    const nonOidA = distinctUsersInSourceA.filter(x => !(x instanceof ObjectId));
    console.log(`    (of which non-ObjectId types: ${nonOidA.length} -- could be strings/mismatch!)`);
  }

  const distinctUsersInSourceB = await db.collection('course_exam_attempts').distinct('student_id', {
    $or: [
      { marks_submitted: true },
      { overall_result: { $exists: true, $nin: [null, ''] } },
    ],
  });
  console.log(`  Source B (cea): distinct student_ids = ${distinctUsersInSourceB.length}`);
  if (distinctUsersInSourceB.length) {
    const nonOidB = distinctUsersInSourceB.filter(x => !(x instanceof ObjectId));
    console.log(`    (of which non-ObjectId types: ${nonOidB.length})`);
  }

  const v2evaluated = await db.collection('exam_v2_papers').find({
    $or: [
      { status: { $regex: 'evaluated', $options: 'i' } },
      { status: { $in: ['Evaluated', 'evaluated', 'EVALUATED'] } },
    ],
  }).project({ student_id: 1, exam_id: 1, _id: 0 }).toArray();
  const distinctUsersInSourceC = [...new Set(v2evaluated.map(x => String(x.student_id)))].length;
  console.log(`  Source C (v2_papers): distinct student_ids = ${distinctUsersInSourceC}`);
  if (v2evaluated.length) {
    const nonOidC = v2evaluated.filter(x => !(x.student_id instanceof ObjectId)).length;
    console.log(`    (of which student_id non-ObjectId types: ${nonOidC})`);
  }

  const distinctUsersInSourceD = await db.collection('certificates').distinct('student_id');
  console.log(`  Source D (certs): distinct student_ids = ${distinctUsersInSourceD.length}`);

  // ---------- SAMPLE DOCUMENTS ----------
  console.log('\n=== SAMPLE DOCUMENTS (first 2 per collection) ===');

  const ce_samp = await db.collection('certificate_eligibility').find({}).limit(2).toArray();
  for (const d of ce_samp) {
    console.log('\n  CERTIFICATE_ELIGIBILITY sample:');
    console.log('    _id              :', ObjectId.isValid(d._id) ? d._id.toHexString() : d._id);
    console.log('    student_id type  :', typeof d.student_id, '(', ObjectId.isValid(d.student_id) ? 'OID' : String(d.student_id).slice(0,20), ')');
    console.log('    course_id type   :', typeof d.course_id, '(', ObjectId.isValid(d.course_id) ? 'OID' : String(d.course_id).slice(0,20), ')');
    console.log('    eligibility_type :', d.eligibility_type);
    console.log('    attempt_number   :', d.attempt_number, '(expected Some(i32) for marksheet, None for certificate)');
    console.log('    processed        :', d.processed);
    console.log('    eligible_at      :', d.eligible_at);
    // Check if student + course actually exist
    if (ObjectId.isValid(d.student_id)) {
      const u = await db.collection('users').findOne({ _id: ObjectId.createFromHexString(typeof d.student_id === 'string' ? d.student_id : d.student_id.toHexString()) });
      console.log('    user $lookup     :', u ? `FOUND name=${u.full_name||u.student_name} role=${u.role} is_deleted=${u.is_deleted}` : 'NOT FOUND in users');
    }
    if (ObjectId.isValid(d.course_id)) {
      const c = await db.collection('courses').findOne({ _id: ObjectId.createFromHexString(typeof d.course_id === 'string' ? d.course_id : d.course_id.toHexString()) });
      console.log('    course $lookup   :', c ? `FOUND "${c.course_name}"` : 'NOT FOUND in courses');
    }
  }

  const cea_samp = await db.collection('course_exam_attempts').find({}).limit(2).toArray();
  for (const d of cea_samp) {
    console.log('\n  COURSE_EXAM_ATTEMPTS sample:');
    console.log('    _id              :', ObjectId.isValid(d._id) ? d._id.toHexString() : d._id);
    console.log('    student_id       :', typeof d.student_id, ObjectId.isValid(d.student_id) ? 'OID' : String(d.student_id).slice(0,20));
    console.log('    course_id        :', typeof d.course_id, ObjectId.isValid(d.course_id) ? 'OID' : String(d.course_id).slice(0,20));
    console.log('    marks_submitted  :', d.marks_submitted, 'type=', typeof d.marks_submitted);
    console.log('    overall_result   :', d.overall_result, '(expected "Pass"/"Fail"/null)');
    console.log('    attempt_number   :', d.attempt_number);
    console.log('    percentage       :', d.percentage);
    console.log('    total_obtained   :', d.total_obtained);
    console.log('    total_marks      :', d.total_marks);
  }

  const v2_samp = await db.collection('exam_v2_papers').find({}).limit(2).toArray();
  for (const d of v2_samp) {
    console.log('\n  EXAM_V2_PAPERS sample:');
    console.log('    _id              :', ObjectId.isValid(d._id) ? d._id.toHexString() : d._id);
    console.log('    student_id       :', typeof d.student_id, ObjectId.isValid(d.student_id) ? 'OID' : String(d.student_id).slice(0,20));
    console.log('    exam_id          :', typeof d.exam_id, ObjectId.isValid(d.exam_id) ? 'OID' : String(d.exam_id).slice(0,20));
    console.log('    attempt_number   :', d.attempt_number);
    console.log('    status           :', d.status);
    // Check exam_id -> exam_v2_exams -> course_id
    if (ObjectId.isValid(d.exam_id)) {
      const ex = await db.collection('exam_v2_exams').findOne({ _id: ObjectId.createFromHexString(typeof d.exam_id === 'string' ? d.exam_id : d.exam_id.toHexString()) });
      console.log('    exam $lookup course_id:', ex ? (ObjectId.isValid(ex.course_id) ? ex.course_id.toHexString() : String(ex.course_id)) : 'NOT FOUND in exam_v2_exams');
    }
  }

  const cert_samp = await db.collection('certificates').find({}).limit(2).toArray();
  for (const d of cert_samp) {
    console.log('\n  CERTIFICATES sample:');
    console.log('    _id              :', ObjectId.isValid(d._id) ? d._id.toHexString() : d._id);
    console.log('    student_id       :', typeof d.student_id, ObjectId.isValid(d.student_id) ? 'OID' : String(d.student_id).slice(0,20));
    console.log('    course_id        :', typeof d.course_id, ObjectId.isValid(d.course_id) ? 'OID' : String(d.course_id).slice(0,20));
    console.log('    certificate_type :', d.certificate_type);
    console.log('    attempt_number   :', d.attempt_number);
  }

  // ---------- USERS: STUDENT ROLE DISTRIBUTION ----------
  console.log('\n=== USER ROLE DISTRIBUTION ===');
  const roleDist = await db.collection('users').aggregate([
    { $match: { is_deleted: { $ne: true } } },
    { $group: { _id: { $ifNull: ['$role', '__ABSENT_OR_NULL__'] }, count: { $sum: 1 } } },
  ]).toArray();
  for (const row of roleDist) {
    console.log(`  role="${row._id}"  count=${row.count}`);
  }

  // ---------- DANGLING REFERENCE CHECK: each source's student_id exists in users? ----------
  console.log('\n=== DANGLING REFERENCES: student_id in sources vs users collection ===');

  const checkDangling = async (srcLabel, srcIds) => {
    if (srcIds.length === 0) return;
    const oids = srcIds
      .map(s => {
        try { return typeof s === 'string' ? ObjectId.createFromHexString(s) : (s instanceof ObjectId ? s : null); }
        catch { return null; }
      })
      .filter(Boolean);
    const found = await db.collection('users').countDocuments({ _id: { $in: oids }, is_deleted: { $ne: true } });
    console.log(`  ${srcLabel}: ${oids.length} OIDs -> users found=${found}  dangling=${oids.length - found}`);
    return { oids, found };
  };

  await checkDangling('SourceA (certificate_eligibility)', distinctUsersInSourceA);
  await checkDangling('SourceB (course_exam_attempts marks)', distinctUsersInSourceB);
  const cOids = v2evaluated.map(v => v.student_id);
  if (cOids.length) await checkDangling('SourceC (exam_v2_papers eval)', cOids);
  await checkDangling('SourceD (certificates)', distinctUsersInSourceD);

  // ---------- AUTO-GEN SOURCE OF TRUTH QUERY (what certificate_automation.rs actually runs) ----------
  console.log('\n=== AUTO-GEN SOURCE OF TRUTH: certificate_eligibility queries identical to automation ===');
  const autoMarksheetPending = await db.collection('certificate_eligibility').countDocuments({
    eligibility_type: 'marksheet',
    processed: false,
  });
  const autoCertPending = await db.collection('certificate_eligibility').countDocuments({
    eligibility_type: 'certificate',
    processed: false,
  });
  console.log(`  Auto marksheet pending (eligibility_type=marksheet, processed=false):  ${autoMarksheetPending}`);
  console.log(`  Auto certificate pending (eligibility_type=certificate, processed=false): ${autoCertPending}`);

  const autoMarksheetAll = await db.collection('certificate_eligibility').countDocuments({ eligibility_type: 'marksheet' });
  const autoCertAll = await db.collection('certificate_eligibility').countDocuments({ eligibility_type: 'certificate' });
  console.log(`  Auto marksheet ALL (marksheet processed+unprocessed):                 ${autoMarksheetAll}`);
  console.log(`  Auto certificate ALL (certificate processed+unprocessed):             ${autoCertAll}`);

  // ---------- OBJECTID vs STRING MISMATCH SUMMARY ----------
  console.log('\n=== TYPE MISMATCH SUMMARY: OBJECT ID vs STRING in foreign key fields ===');

  const typeOf = (x) => x instanceof ObjectId ? 'ObjectId' : (x === null ? 'null' : typeof x === 'undefined' ? 'undefined' : typeof x);

  const analyzeFkTypes = async (collName, fkField, label) => {
    const docs = await db.collection(collName).find({}, { [fkField]: 1 }).limit(50).toArray();
    if (!docs.length) return;
    const types = new Map();
    for (const d of docs) {
      const t = typeOf(d[fkField]);
      types.set(t, (types.get(t) || 0) + 1);
    }
    console.log(`  ${collName}.${fkField.padEnd(20)} (first 50 docs): ${[...types.entries()].map(([t,c])=>`${t}x${c}`).join(', ')}  ${label}`);
  };

  await analyzeFkTypes('certificate_eligibility', 'student_id', 'user _id is ObjectId -> mismatch here = no lookup!');
  await analyzeFkTypes('certificate_eligibility', 'course_id', 'course _id is ObjectId');
  await analyzeFkTypes('course_exam_attempts', 'student_id', '');
  await analyzeFkTypes('course_exam_attempts', 'course_id', '');
  await analyzeFkTypes('exam_v2_papers', 'student_id', '');
  await analyzeFkTypes('exam_v2_papers', 'exam_id', 'join to exam_v2_exams');
  await analyzeFkTypes('exam_v2_exams', 'course_id', '');
  await analyzeFkTypes('certificates', 'student_id', '');
  await analyzeFkTypes('certificates', 'course_id', '');
  await analyzeFkTypes('users', 'parent_id', 'center FK; center _id OID -> mismatch = no center name');

  await client.close();
  console.log('\nDone.');
}
main().catch(e => { console.error('ERR', e); process.exit(1); });
