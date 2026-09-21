// 1. Login student s35@gmail.com (password same as what's in DB) — let's first probe for user
require('dotenv').config({ path: './backend/.env' });
const { MongoClient } = require('mongodb');
const fs = require('fs');
(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const dbName = uri.split('/').pop().split('?')[0] || 'scre';
    const db = client.db(dbName);
    const users = db.collection('users');
    const u = await users.findOne({ email: 's35@gmail.com' });
    if (!u) {
      console.log('s35@gmail.com NOT FOUND');
      // try other common emails
      const list = await users.find({ role: 'student' }).limit(5).toArray();
      console.log('sample students:');
      for (const s of list) console.log('  id=', s._id.toString(), 'email=', s.email, 'username=', s.username);
      return;
    }
    console.log('s35 student id:', u._id.toString());
    console.log('s35 student username:', u.username);
    console.log('password_hash present?', !!u.password_hash);
    // fetch their certificates: match student_id + status approved
    const certs = db.collection('certificates');
    const owned = await certs.find({ student_id: u._id, status: 'approved' }).project({ _id: 1, certificate_no: 1, file_path: 1, html: { $exists: true } }).limit(10).toArray();
    console.log('\ns35 approved certificates:');
    for (const c of owned) {
      console.log(`  _id=${c._id.toString()} cert_no=${c.certificate_no} file_path=${c.file_path || 'null'} has_html=${c.html !== undefined}`);
    }
  } finally {
    await client.close();
  }
})();
