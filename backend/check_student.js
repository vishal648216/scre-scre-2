
const db = connect("mongodb://localhost:27017/scre_db");
console.log("=== Checking databases...");
const dbs = db.adminCommand("listDatabases");
console.log(JSON.stringify(dbs, null, 2));
console.log("\n=== Checking users in scre_db...");
const users = db.users.find({}).toArray();
console.log(JSON.stringify(users, null, 2));
console.log("\n=== Checking first student...");
const student = db.users.findOne({role: 'student'});
console.log(JSON.stringify(student, null, 2));

