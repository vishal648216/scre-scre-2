require('dotenv').config({ path: './backend/.env' });
const { MongoClient } = require('mongodb');
(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const dbName = uri.split('/').pop().split('?')[0] || 'scre';
    const db = client.db(dbName);
    const users = db.collection('users');
    const u = await users.findOne({ email: 's35@gmail.com' });
    console.log('s35 student id:', u._id.toString());
    const certs = db.collection('certificates');
    const owned = await certs.find({ student_id: u._id, status: 'approved' }).project({ _id: 1, certificate_no: 1, file_path: 1, html: 1 }).limit(10).toArray();
    console.log('\ns35 approved certificates:');
    for (const c of owned) {
      console.log(`  _id=${c._id.toString()} cert_no=${c.certificate_no} file_path=${c.file_path || 'null'} has_html=${typeof c.html === 'string' && c.html.length > 0 ? 'YES (len='+c.html.length+')' : 'NO'}`);
    }
  } finally {
    await client.close();
  }
})();
