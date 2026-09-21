const { MongoClient, ObjectId } = require('mongodb');
const URI = 'mongodb://localhost:27017';
const DB = 'scre_db';
async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB);

  console.log('=== Certificates template_id presence ===');
  const tidPresent = await db.collection('certificates').countDocuments({
    template_id: { $exists: true, $ne: null, $ne: '' },
  });
  const tidMissing = 102 - tidPresent;
  console.log(`  template_id present: ${tidPresent}, missing: ${tidMissing}`);

  const cert_ids_course = await db.collection('certificates').find({}, { projection: { _id: 1, student_id: 1, course_id: 1, template_id: 1, certificate_type: 1 } }).limit(10).toArray();
  for (const c of cert_ids_course) {
    console.log('  cert._id:', c._id.toHexString(),
      'student_id:', c.student_id?.toHexString?.()?.slice(0,8),
      'course_id:', c.course_id?.toHexString?.()?.slice(0,8) ?? 'ABSENT',
      'template_id:', c.template_id?.toHexString?.()?.slice(0,8) ?? (typeof c.template_id === 'string' ? c.template_id.slice(0,8) : 'ABSENT'));
  }

  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
