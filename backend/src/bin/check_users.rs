
use mongodb::{bson::doc, bson::Document, Client};
use futures::stream::StreamExt;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct User {
    username: String,
    password_hash: String,
    #[serde(default)]
    active: bool,
    #[serde(default)]
    is_deleted: bool,
}

#[tokio::main]
async fn main() -> mongodb::error::Result<()> {
    let client = Client::with_uri_str("mongodb://localhost:27017").await?;
    let db = client.database("scre_db");
    let users = db.collection::<Document>("users");

    println!("=== All raw users ===");
    let mut cursor = users.find(None, None).await?;
    while let Some(doc) = cursor.next().await {
        match doc {
            Ok(raw_doc) => {
                println!("\nRaw user doc:");
                println!("{:#?}", raw_doc);
                let user_result = mongodb::bson::from_document::<User>(raw_doc.clone());
                match user_result {
                    Ok(user) => println!(
                        "username: {}, active: {}, is_deleted: {}",
                        user.username, user.active, user.is_deleted
                    ),
                    Err(e) => println!("Error deserializing: {}", e),
                }
            }
            Err(e) => println!("Error: {}", e),
        }
    }

    Ok(())
}
