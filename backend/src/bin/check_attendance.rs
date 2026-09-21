use mongodb::{Client, Database};
use mongodb::bson::doc;
use futures_util::StreamExt;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let mongodb_uri = std::env::var("MONGODB_URI").expect("MONGODB_URI must be set");
    let database_name = std::env::var("DATABASE_NAME").expect("DATABASE_NAME must be set");
    let client = Client::with_uri_str(&mongodb_uri).await.expect("Failed to connect to MongoDB");
    let db: Database = client.database(&database_name);
    let coll = db.collection::<mongodb::bson::Document>("attendance");
    let count = coll.count_documents(doc! {}, None).await.unwrap_or(0);
    println!("attendance_count={}", count);
    if let Ok(mut cursor) = coll.find(doc! {}, None).await {
        while let Some(Ok(doc)) = cursor.next().await {
            println!("{}", doc);
        }
    }
}
