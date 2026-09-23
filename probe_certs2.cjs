require('dotenv').config({ path: './backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const dbName = uri.split('/').pop().split('?')[0] || 'scre';
    const db = client.db(dbName);
    const allCerts = await db.collection('certificates').find({}).sort({ issued_on: -1 }).limit(15).toArray();
    console.log('Total certificates in collection:', await db.collection('certificates').estimatedDocumentCount());
    console.log('\nALL CERTIFICATES (status breakdown):');
    for (const c of allCerts) {
      const rel = c.file_path;
      const fp = rel ? path.resolve('/var/www/html/scre/backend/uploads', rel) : null;
      const onDisk = fp ? fs.existsSync(fp) : false;
      const fallbackCert = `/var/www/html/scre/backend/uploads/certificates/${c.certificate_no}.pdf`;
      const fallbackMarksheet = `/var/www/html/scre/backend/uploads/marksheets/${c.certificate_no}.pdf`;
      console.log(
        `_id=${c._id?.toString().slice(-6)} cert_no=${c.certificate_no} type=${c.certificate_type} status=${JSON.stringify(c.status)} course=${c.course?.slice(0,25)} student_id=${c.student_id?.toString().slice(-6)} center_id=${c.center_id?.toString().slice(-6)} template_id=${c.template_id?.toString().slice(-6)}`
      );
      console.log(`   file_path=${JSON.stringify(c.file_path)}  fs.exists(file_path)=${onDisk} pdf_url=${JSON.stringify(c.pdf_url)} pdf_path=${JSON.stringify(c.pdf_path)}`);
      console.log(`   fallback_cert_exists=${fs.existsSync(fallbackCert)} fallback_marksheet_exists=${fs.existsSync(fallbackMarksheet)}`);
    }
    console.log('\n=== marksheets collection (if any) ===');
    const marksheets = db.collection('marksheets');
    try {
      console.log('Estimated docs:', await marksheets.estimatedDocumentCount());
      const ms = await marksheets.find({}).sort({ created_at: -1 }).limit(5).toArray();
      for (const m of ms) {
        console.log(`_id=${m._id?.toString().slice(-6)} no=${m.marksheet_no ?? m.certificate_no} file_path=${JSON.stringify(m.file_path)} pdf_url=${JSON.stringify(m.pdf_url)}`);
      }
    } catch (e) {
      console.log('no marksheets collection:', e.message);
    }
    // Show ALL statuses
    console.log('\n=== STATUS COUNTS ===');
    const counts = await db.collection('certificates').aggregate([{$group:{_id:"$status", n:{$sum:1}}}]).toArray();
    console.log(JSON.stringify(counts, null, 2));
    console.log('\n=== TYPE COUNTS ===');
    const tcounts = await db.collection('certificates').aggregate([{$group:{_id:"$certificate_type", n:{$sum:1}}}]).toArray();
    console.log(JSON.stringify(tcounts, null, 2));
  } finally {
    await client.close();
  }
})();
