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
    const certsColl = db.collection('certificates');

    // Status counts
    console.log('total_docs:', await certsColl.estimatedDocumentCount());
    console.log('\n=== STATUS COUNTS ===');
    for (const row of await certsColl.aggregate([{$group:{_id:"$status", n:{$sum:1}}}]).toArray()) console.log(JSON.stringify(row));
    console.log('\n=== TYPE COUNTS ===');
    for (const row of await certsColl.aggregate([{$group:{_id:"$certificate_type", n:{$sum:1}}}]).toArray()) console.log(JSON.stringify(row));

    // Pick 10 latest WITHOUT sort (by natural reverse via $limit and hint, or just limit 20)
    console.log('\n=== SAMPLE CERTIFICATES ===');
    const sample = await certsColl.find({}).limit(12).toArray();
    const all = sample.slice(0, 12);
    const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/scre/backend/uploads';
    for (const c of all) {
      const checkP = (rel) => {
        if (!rel) return null;
        const pb = path.isAbsolute(rel) ? rel : path.join(uploadDir, rel);
        if (fs.existsSync(pb)) return pb;
        const pb2 = path.join('/var/www/html/scre/backend', rel);
        if (fs.existsSync(pb2)) return pb2;
        return null;
      };
      const from_fp = checkP(c.file_path);
      let fallback = null;
      if (!from_fp && c.certificate_no) {
        for (const sub of ['certificates','marksheets']) {
          const f = path.join(uploadDir, sub, `${c.certificate_no}.pdf`);
          if (fs.existsSync(f)) { fallback = f; break; }
        }
      }
      console.log(
        `id=${c._id?.toString().slice(0,8)}... no=${c.certificate_no} type=${c.certificate_type} status=${JSON.stringify(c.status)} course=${(c.course||'').slice(0,20)} student_id=${c.student_id?.toString().slice(0,8)} center_id=${c.center_id?.toString().slice(0,8)} template=${c.template_id?.toString().slice(0,8)} file_path=${JSON.stringify(c.file_path)} pdf_url=${JSON.stringify(c.pdf_url)} pdf_path=${JSON.stringify(c.pdf_path)} FOUND=${from_fp||fallback||'NO'}`
      );
    }
  } finally {
    await client.close();
  }
})();
