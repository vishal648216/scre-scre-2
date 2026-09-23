const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb://localhost:27017';
const DB = 'scre_db';
async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);

  console.log('=== Template document full dump (all rows) ===');
  const all = await db.collection('templates').find({}).toArray();
  for (const t of all) {
    console.log('\ntpl _id:', t._id.toHexString());
    for (const k of ['template_type','course_id','default_design','name','title']) {
      let v = t[k];
      if (v instanceof ObjectId) v = v.toHexString();
      console.log(' ', k.padEnd(18), '=', v === undefined ? 'UNDEFINED' : v);
    }
  }

  console.log('\n=== What admin_download_student_document QUERIES for marksheet, certificate ===');
  // For a student with course 69ef5c51dbbd001e2044ba8a (Diploma in Computer)
  const studentCourseOid = new ObjectId('69ef5c51dbbd001e2044ba8a');
  console.log('course_id =', studentCourseOid.toHexString());
  for (const [label, tpl_type_str] of [
    ['CERTIFICATE (query type="certificate")', 'certificate'],
    ['MARKSHEET   (query type="marksheet")',   'marksheet'],
  ]) {
    console.log(`\n  ${label}:`);
    // Priority 1: default_design=true + course
    const p1 = await db.collection('templates').countDocuments({
      template_type: tpl_type_str,
      course_id: studentCourseOid,
      default_design: true,
    });
    // Priority 2: any template with course (regardless default)
    const p2 = await db.collection('templates').countDocuments({
      template_type: tpl_type_str,
      course_id: studentCourseOid,
    });
    // Priority 3: global any
    const p3 = await db.collection('templates').countDocuments({
      template_type: tpl_type_str,
    });
    console.log('    p1 (course+default_design=true) :', p1 ? 'FOUND' : 'NONE');
    console.log('    p2 (course+any)                 :', p2 ? 'FOUND' : 'NONE');
    console.log('    p3 (global any)                 :', p3 ? 'FOUND' : 'NONE');
  }

  console.log('\n=== ACTUAL stored template_type strings (case) ===');
  const type_dist = await db.collection('templates').distinct('template_type');
  console.log('  distinct values:', JSON.stringify(type_dist));

  // Also check: Student Panel Download URL route & handler (to confirm not broken by our changes)
  console.log('\n=== Check student_panel download marksheets/certificates endpoints ===');
  // These use different paths we need to ensure untouched
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
