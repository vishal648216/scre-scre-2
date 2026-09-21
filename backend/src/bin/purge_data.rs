use mongodb::{Client, Database};
use mongodb::bson::{doc, Document};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let mongodb_uri = std::env::var("MONGODB_URI").expect("MONGODB_URI must be set");
    let database_name = std::env::var("DATABASE_NAME").expect("DATABASE_NAME must be set");
    let client = Client::with_uri_str(&mongodb_uri).await.expect("Failed to connect to MongoDB");
    let db: Database = client.database(&database_name);

    let targets = std::env::var("PURGE_COLLECTIONS").unwrap_or_else(|_| "centers,attendance,fees".to_string());
    for name in targets.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()) {
        let coll = db.collection::<Document>(name);
        let before = coll.count_documents(doc! {}, None).await.unwrap_or(0);
        let _ = coll.delete_many(doc! {}, None).await;
        let after = coll.count_documents(doc! {}, None).await.unwrap_or(0);
        println!("purged {}: {} -> {}", name, before, after);
    }
}
