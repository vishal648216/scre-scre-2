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

    // pick 5 approved where file_path is set
    const withFp = await certsColl.find({ file_path: { $exists: true, $ne: null }, status: 'approved' }).limit(10).toArray();
    console.log('Approved certificates WITH file_path:', withFp.length);
    const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/scre/backend/uploads';
    for (const c of withFp) {
      const fpAbs = path.join(uploadDir, c.file_path);
      console.log(
        `cert_no=${c.certificate_no} file_path=${c.file_path} file_path_exists=${fs.existsSync(fpAbs)} certbased=${path.join(uploadDir,'certificates',c.certificate_no+'.pdf')} certbased_exists=${fs.existsSync(path.join(uploadDir,'certificates',c.certificate_no+'.pdf'))} marksheetbased_exists=${fs.existsSync(path.join(uploadDir,'marksheets',c.certificate_no+'.pdf'))}`
      );
    }
    // Now pick 5 approved WITHOUT file_path
    const withoutFp = await certsColl.find({ $or: [{ file_path: { $exists: false } }, { file_path: null }], status: 'approved' }).limit(10).toArray();
    console.log('\nApproved certificates WITHOUT file_path:', withoutFp.length);
    for (const c of withoutFp.slice(0,8)) {
      const certbased = path.join(uploadDir, 'certificates', c.certificate_no + '.pdf');
      const msheet = path.join(uploadDir, 'marksheets', c.certificate_no + '.pdf');
      console.log(`cert_no=${c.certificate_no} certbased_exists=${fs.existsSync(certbased)} marksheetbased_exists=${fs.existsSync(msheet)}`);
    }
    // inventory of files under certificates
    const certDir = path.join(uploadDir, 'certificates');
    const existingFiles = fs.existsSync(certDir) ? fs.readdirSync(certDir) : [];
    console.log('\nActual files in UPLOADS/certificates dir:', existingFiles);
  } finally {
    await client.close();
  }
})();
