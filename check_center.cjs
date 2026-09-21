
const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = 'mongodb+srv://screduc_db_user:Akshay1238@cluster0.bmddety.mongodb.net/scre_db?retryWrites=true&w=majority&appName=Cluster0';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('scre_db');
    
    // Find center with user_id 69f1b5b4d48945fb547adf45
    const center = await db.collection('centers').findOne({ user_id: new ObjectId('69f1b5b4d48945fb547adf45') });
    console.log('Center document:', JSON.stringify(center, null, 2));
    
    // Also check a student
    const student = await db.collection('users').findOne({ role: 'student' });
    console.log('Student document:', JSON.stringify(student, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();
