
const { MongoClient } = require('mongodb');

async function main() {
    const uri = 'mongodb+srv://screduc_db_user:Akshay1238@cluster0.bmddety.mongodb.net/scre_db?retryWrites=true&w=majority&appName=Cluster0';
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB");
        
        const db = client.db('scre_db');
        const usersCollection = db.collection('users');
        
        const users = await usersCollection.find().limit(20).toArray();
        
        console.log("=== First 20 users ===");
        users.forEach((user, i) => {
            console.log(`\nUser ${i+1}: _id: ${user._id}, role: ${JSON.stringify(user.role)}`);
            console.log(`  active: ${JSON.stringify(user.active)} (type: ${typeof user.active})`);
            console.log(`  is_deleted: ${JSON.stringify(user.is_deleted)} (type: ${typeof user.is_deleted})`);
            console.log(`  is_email_verified: ${JSON.stringify(user.is_email_verified)} (type: ${typeof user.is_email_verified})`);
            console.log(`  is_deleted_by_center_final: ${JSON.stringify(user.is_deleted_by_center_final)} (type: ${typeof user.is_deleted_by_center_final})`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
