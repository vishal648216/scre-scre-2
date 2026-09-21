
use mongodb::{bson, Client, Database};
use futures_util::stream::StreamExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let mongodb_uri = std::env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".into());
    let database_name = std::env::var("DATABASE_NAME").unwrap_or_else(|_| "scre_db".into());
    let client = Client::with_uri_str(&mongodb_uri).await?;
    let db = client.database(&database_name);

    let coll = db.collection::<bson::Document>("blogs");
    let mut cursor = coll.find(bson::doc! {}, None).await?;
    while let Some(Ok(mut doc)) = cursor.next().await {
        let mut update = bson::doc! {};
        if let Some(created_at_str) = doc.get_str("created_at").ok() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(created_at_str) {
                update.insert("created_at", bson::DateTime::from_chrono(dt.with_timezone(&chrono::Utc)));
            }
        }
        if let Some(updated_at_str) = doc.get_str("updated_at").ok() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(updated_at_str) {
                update.insert("updated_at", bson::DateTime::from_chrono(dt.with_timezone(&chrono::Utc)));
            }
        }
        if let Some(published_at_str) = doc.get_str("published_at").ok() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(published_at_str) {
                update.insert("published_at", bson::DateTime::from_chrono(dt.with_timezone(&chrono::Utc)));
            }
        }

        if !update.is_empty() {
            let id = doc.get_object_id("_id")?;
            eprintln!("Updating blog {:?} with {:?}", id, update);
            coll.update_one(bson::doc! { "_id": id }, bson::doc! { "$set": update }, None).await?;
        }
    }

    let news_coll = db.collection::<bson::Document>("news");
    let mut news_cursor = news_coll.find(bson::doc! {}, None).await?;
    while let Some(Ok(mut doc)) = news_cursor.next().await {
        let mut update = bson::doc! {};
        if let Some(created_at_str) = doc.get_str("created_at").ok() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(created_at_str) {
                update.insert("created_at", bson::DateTime::from_chrono(dt.with_timezone(&chrono::Utc)));
            }
        }
        if let Some(updated_at_str) = doc.get_str("updated_at").ok() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(updated_at_str) {
                update.insert("updated_at", bson::DateTime::from_chrono(dt.with_timezone(&chrono::Utc)));
            }
        }
        if let Some(published_at_str) = doc.get_str("published_at").ok() {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(published_at_str) {
                update.insert("published_at", bson::DateTime::from_chrono(dt.with_timezone(&chrono::Utc)));
            }
        }

        if !update.is_empty() {
            let id = doc.get_object_id("_id")?;
            eprintln!("Updating news {:?} with {:?}", id, update);
            news_coll.update_one(bson::doc! { "_id": id }, bson::doc! { "$set": update }, None).await?;
        }
    }

    eprintln!("Done!");
    Ok(())
}
