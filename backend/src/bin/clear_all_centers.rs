use mongodb::{Client, Database};
use mongodb::bson::{doc, Document};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let mongodb_uri = std::env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb+srv://scre_admin:Scre%40123456@cluster0.fbbdcja.mongodb.net/scre_db?w=majority&appName=Cluster0&retryWrites=false".to_string());
    let database_name = std::env::var("DATABASE_NAME").unwrap_or_else(|_| "scre_db".to_string());
    let client = Client::with_uri_str(&mongodb_uri).await?;
    let db: Database = client.database(&database_name);

    println!("Connecting to MongoDB: {}", database_name);

    // 1. Delete all documents in 'centers' collection
    let centers_coll = db.collection::<Document>("centers");
    let deleted_centers = centers_coll.delete_many(doc! {}, None).await?;
    println!("Deleted {} centers from 'centers' collection.", deleted_centers.deleted_count);

    // 2. Delete all users with role 'center' in 'users' collection
    let users_coll = db.collection::<Document>("users");
    let deleted_center_users = users_coll.delete_many(doc! { "role": "center" }, None).await?;
    println!("Deleted {} center user accounts from 'users' collection.", deleted_center_users.deleted_count);

    // 3. Clear 'center_drafts'
    let drafts_coll = db.collection::<Document>("center_drafts");
    let deleted_drafts = drafts_coll.delete_many(doc! {}, None).await?;
    println!("Deleted {} drafts from 'center_drafts' collection.", deleted_drafts.deleted_count);

    println!("SUCCESS: All centers have been purged completely!");
    Ok(())
}
