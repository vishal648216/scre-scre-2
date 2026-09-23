const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const URI = 'mongodb://localhost:27017';
const DB = 'scre_db';

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);

  // ====== 1. Check sample certificate doc structure (first 5) ======
  console.log('=== DOWLOAD RC #1: sample certificate docs ===');
  const certs = await db.collection('certificates').find({}).limit(5).toArray();
  for (const c of certs) {
    console.log('\ncert._id =', c._id.toHexString());
    for (const k of ['student_id','course_id','center_id','certificate_no','file_path','pdf_path','pdf_url','html','certificate_type']) {
      let v = c[k];
      if (v instanceof ObjectId) v = v.toHexString();
      if (typeof v === 'string') v = v.slice(0, 80);
      console.log(`  ${k.padEnd(20)} =`, v === undefined ? 'UNDEFINED ❌' : (v === null ? 'NULL ❌' : v));
    }
  }

  // ====== 2. Check center_id presence ======
  console.log('\n=== DOWLOAD RC #2: certificates.center_id field presence (all 102) ===');
  const centerMissing = await db.collection('certificates').countDocuments({
    $or: [
      { center_id: { $exists: false } },
      { center_id: null },
    ],
  });
  const centerPresent = await db.collection('certificates').countDocuments({ center_id: { $exists: true, $ne: null } });
  console.log(`  center_id present: ${centerPresent}, missing/null: ${centerMissing}`);

  // ====== 3. Check course_id presence ======
  console.log('\n=== DOWLOAD RC #3: certificates.course_id presence ===');
  const courseMissing = await db.collection('certificates').countDocuments({
    $or: [
      { course_id: { $exists: false } },
      { course_id: null },
    ],
  });
  const coursePresent = await db.collection('certificates').countDocuments({ course_id: { $exists: true, $ne: null } });
  console.log(`  course_id present: ${coursePresent}, missing/null: ${courseMissing}`);

  // ====== 4. Check certificate_no presence ======
  console.log('\n=== DOWLOAD RC #4: certificates.certificate_no presence ===');
  const noMissing = await db.collection('certificates').countDocuments({
    $or: [
      { certificate_no: { $exists: false } },
      { certificate_no: null },
      { certificate_no: '' },
    ],
  });
  console.log(`  certificate_no missing/null/empty: ${noMissing}`);

  // ====== 5. Check PDF files on disk in UPLOAD_DIR candidates ======
  console.log('\n=== DOWLOAD RC #5: Check PDF file paths on disk ===');
  const dirs = [
    '/var/www/html/scre/backend/uploads',
    '/var/www/html/scre/public/uploads',
    '/var/www/html/scre/backend',
    '/var/www/html/scre/public',
  ];
  for (const d of dirs) {
    const exists = fs.existsSync(d);
    console.log(`  dir ${d}: ${exists ? 'EXISTS' : 'DOES NOT EXIST'} ${exists ? (() => { try { return '('+fs.readdirSync(d, {recursive:true}).filter(n=>n.endsWith('.pdf')).slice(0,5).join(',')+')' } catch(e) { return ''; }})() : ''}`);
  }

  // Sample certificate_no -> path existence
  console.log('\n  Trying to resolve 5 sample cert PDFs:');
  for (const c of certs) {
    const no = c.certificate_no || '(NONE)';
    const candidates = [
      `/var/www/html/scre/backend/uploads/certificates/${no}.pdf`,
      `/var/www/html/scre/backend/uploads/marksheets/${no}.pdf`,
      `/var/www/html/scre/public/uploads/certificates/${no}.pdf`,
      `/var/www/html/scre/public/uploads/marksheets/${no}.pdf`,
      c.file_path && (c.file_path.startsWith('/') ? c.file_path : `/var/www/html/scre/backend/uploads/${c.file_path}`),
    ].filter(Boolean);
    let found = candidates.find(p => fs.existsSync(p));
    console.log(`    no=${no} file_path=${c.file_path} -> FOUND AT: ${found || 'NOT ON DISK ANYWHERE (will trigger on-demand HTML->PDF pipeline)'}`);
  }

  // ====== 6. admin_download_student_document failure paths ======
  console.log('\n=== DOWLOAD RC #6: Admin on-demand endpoint student prerequisites ===');
  // Check users.student.role field type vs UserRole::Student (serde rename_all = lowercase -> "student")
  const users_role_dist = await db.collection('users').aggregate([
    { $match: { is_deleted: { $ne: true }, role: { $regex: 'student', $options: 'i' } } },
    { $group: { _id: { role: '$role' }, count: { $sum: 1 } } },
  ]).toArray();
  console.log('  student-like roles in users (non-deleted):', users_role_dist.map(r=>`role="${r._id.role}"×${r.count}`).join(', '));

  // Check user.course_id presence on students
  const studentsNoCourse = await db.collection('users').countDocuments({
    is_deleted: { $ne: true },
    role: { $regex: 'student', $options: 'i' },
    $or: [
      { course_id: { $exists: false } },
      { course_id: null },
    ],
  });
  const studentsCourse = await db.collection('users').countDocuments({
    is_deleted: { $ne: true },
    role: { $regex: 'student', $options: 'i' },
    course_id: { $exists: true, $ne: null },
  });
  console.log(`  students with course_id: ${studentsCourse}, students without course_id: ${studentsNoCourse} ❌`);

  // If students with no course_id, try user.course (legacy string field)
  const legacyCourseStr = await db.collection('users').countDocuments({
    is_deleted: { $ne: true },
    role: { $regex: 'student', $options: 'i' },
    course: { $exists: true, $type: 'string', $ne: '' },
    $or: [{ course_id: { $exists: false } }, { course_id: null }],
  });
  console.log(`  (sub) students with legacy course=string but NO course_id OID: ${legacyCourseStr}`);

  // ====== 7. Templates — default course templates ======
  console.log('\n=== DOWLOAD RC #7: Templates for student courses ===');
  const tmpl = await db.collection('templates').aggregate([
    { $group: { _id: { tpl_type: '$template_type', course: '$course_id', default: '$default_design' }, count: { $sum: 1 } } },
  ]).toArray();
  console.log('  templates groupings (first 20):');
  for (const t of tmpl.slice(0, 20)) {
    const cid = t._id.course instanceof ObjectId ? t._id.course.toHexString().slice(0, 8) + '…' : String(t._id.course ?? 'GLOBAL');
    console.log(`    type=${String(t._id.tpl_type).padEnd(11)} course=${cid.padEnd(11)} default_design=${String(t._id.default??'N/A').padEnd(5)} count=${t.count}`);
  }
  // Check if any templates have default_design=true with no course_id (global defaults)
  const globalDefaultC = await db.collection('templates').countDocuments({
    template_type: 'certificate', default_design: true,
    $or: [{ course_id: { $exists: false } }, { course_id: null }],
  });
  const globalDefaultM = await db.collection('templates').countDocuments({
    template_type: 'marksheet', default_design: true,
    $or: [{ course_id: { $exists: false } }, { course_id: null }],
  });
  console.log(`  global default (no course_id) certificate templates: ${globalDefaultC} | marksheets: ${globalDefaultM}`);

  // ====== 8. process_generate_certificates — check force_new=false check existing logic flow ======
  console.log('\n=== DOWLOAD RC #8: Check if users role field mismatch (e.g. "Student" capitalized) ===');
  // If role stored as "Student" with capital S but JWT claims.role is UserRole::Student (which via serde is lowercase "student")
  // then user.role != UserRole::Student comparison uses enum discriminant comparison — let's check
  const roleValues = await db.collection('users').distinct('role');
  console.log('  All distinct user.role values:', JSON.stringify(roleValues));

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
