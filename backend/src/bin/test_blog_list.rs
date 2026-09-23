
use mongodb::{bson::doc, Client, Database};
use chrono::Utc;
use futures_util::StreamExt;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let mongodb_uri = std::env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".into());
    let database_name = std::env::var("DATABASE_NAME").unwrap_or_else(|_| "scre_db".into());
    let client = Client::with_uri_str(&mongodb_uri)
        .await
        .expect("Failed to connect to MongoDB");
    let db: Database = client.database(&database_name);
    
    let coll = db.collection::<mongodb::bson::Document>("blogs");
    let mut filter = doc! { "status": "published" };
    filter.insert("$or", vec![
        doc! { "published_at": { "$lte": Utc::now() } },
        doc! { "published_at": { "$exists": false } },
        doc! { "published_at": mongodb::bson::Bson::Null },
    ]);
    
    println!("DEBUG: filter = {:?}", filter);
    
    let mut cursor = coll.find(filter.clone(), None).await.expect("find failed");
    let mut count = 0;
    while let Some(Ok(doc)) = cursor.next().await {
        println!("--- Blog {} ---", count +1);
        
        // Try to deserialize as the actual Blog struct!
        let blog_result: Result<backend::models::blog::Blog, _> = mongodb::bson::from_document(doc.clone());
        match blog_result {
            Ok(b) => println!("✅ Real Blog deserialized OK: {:?}", b),
            Err(e) => println!("❌ Real Blog deserialization error: {:?}", e)
        }
        
        count += 1;
    }
    println!("Total blogs found: {}", count);
}
