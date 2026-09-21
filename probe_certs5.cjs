// Find the cert row for certificate_no="SC-82999" from the screenshot and print its _id + file_path + template_id + student_id + center_id
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
    const cert = await certsColl.findOne({ certificate_no: 'SC-82999' });
    console.log('SC-82999 cert doc:', JSON.stringify(cert, null, 2));
    const uploadDir = process.env.UPLOAD_DIR || '/var/www/html/scre/backend/uploads';
    const fpFile = cert && cert.file_path ? path.join(uploadDir, cert.file_path) : null;
    console.log('\nuploadDir:', uploadDir);
    console.log('file_path on disk exists:', fpFile, '->', fpFile && fs.existsSync(fpFile));
    const certbased = path.join(uploadDir, 'certificates', cert.certificate_no + '.pdf');
    console.log('cert-based exists:', certbased, '->', fs.existsSync(certbased));
    // also list files in certificates
    console.log('\nFiles in uploads/certificates:', fs.existsSync(path.join(uploadDir, 'certificates')) ? fs.readdirSync(path.join(uploadDir, 'certificates')) : 'DIR NOT FOUND');
  } finally {
    await client.close();
  }
})();
