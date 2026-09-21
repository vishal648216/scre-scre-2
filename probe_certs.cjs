require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const dbName = (process.env.MONGODB_URI || '').split('/').pop().split('?')[0] || 'scre';
    const db = client.db(dbName);
    const certs = await db.collection('certificates').find({ status: { $in: ['approved', 'issued'] } }).sort({ issued_on: -1 }).limit(8).toArray();
    console.log(`Found ${certs.length} approved/issued certificates.\n`);
    const fs = require('fs');
    const path = require('path');
    const uploadDirs = [
      process.env.UPLOAD_DIR || '/var/www/html/scre/backend/uploads',
      '/var/www/html/scre/backend',
      '/var/www/html/scre/public/uploads',
      '/var/www/html/scre/public',
    ];
    for (const c of certs) {
      console.log('------------------------------------------------------------------');
      console.log('cert_id   :', c._id?.toString());
      console.log('cert_no   :', c.certificate_no);
      console.log('course    :', c.course);
      console.log('type      :', c.certificate_type ?? '(missing)');
      console.log('status    :', c.status);
      console.log('student_id:', c.student_id?.toString());
      console.log('center_id :', c.center_id?.toString());
      console.log('template  :', c.template_id?.toString());
      console.log('file_path :', JSON.stringify(c.file_path));
      console.log('pdf_url   :', JSON.stringify(c.pdf_url));
      console.log('pdf_path  :', JSON.stringify(c.pdf_path));
      const candidates = new Set();
      const add = (p) => { if (p) candidates.add(path.isAbsolute(p) ? p : path.resolve(uploadDirs[0], p)); };
      if (c.file_path) add(c.file_path);
      if (c.pdf_url) {
        let n = c.pdf_url.replace(/^\//,'');
        if (n.startsWith('uploads/')) n = n.slice('uploads/'.length);
        add(path.resolve(uploadDirs[0], n));
      }
      if (c.pdf_path) add(c.pdf_path);
      if (c.certificate_no) {
        const type = c.certificate_type === 'marksheet' ? 'marksheets' : 'certificates';
        add(path.resolve(uploadDirs[0], `${type}/${c.certificate_no}.pdf`));
        add(path.resolve(uploadDirs[0], `certificates/${c.certificate_no}.pdf`));
        add(path.resolve(uploadDirs[0], `marksheets/${c.certificate_no}.pdf`));
        add(path.resolve(uploadDirs[0], `${c.certificate_no}.pdf`));
      }
      let found = null;
      for (const p of candidates) {
        if (fs.existsSync(p)) { found = p; break; }
      }
      console.log('candidate count:', candidates.size, '| file on disk:', found ? 'YES ' + found : 'NO');
      // Also show files in upload directories
      for (const d of uploadDirs) {
        for (const sub of ['certificates','marksheets']) {
          const dir = path.join(d, sub);
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.includes(String(c.certificate_no)) || false);
            if (files.length) console.log(`  match in ${dir}:`, files.join(', '));
          }
        }
      }
    }
    // Summary of PDFs actually existing on disk under uploads/certificates & uploads/marksheets
    console.log('\n====== DISK INVENTORY ======');
    for (const d of uploadDirs) {
      for (const sub of ['certificates', 'marksheets']) {
        const dir = path.join(d, sub);
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).slice(0, 15);
          const total = fs.readdirSync(dir).length;
          console.log(`${dir} exists, total files: ${total}. First 15: ${files.join(', ')}`);
        } else {
          console.log(`${dir} MISSING`);
        }
      }
    }
  } catch (e) {
    console.error('probe error:', e);
  } finally {
    await client.close();
  }
})();
