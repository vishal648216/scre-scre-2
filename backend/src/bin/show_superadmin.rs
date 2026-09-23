use mongodb::{bson::doc, Client, Database};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let mongodb_uri = std::env::var("MONGODB_URI").expect("MONGODB_URI must be set");
    let database_name = std::env::var("DATABASE_NAME").expect("DATABASE_NAME must be set");
    let client = Client::with_uri_str(&mongodb_uri)
        .await
        .expect("Failed to connect to MongoDB");
    let db: Database = client.database(&database_name);

    let users = db.collection::<mongodb::bson::Document>("users");
    match users.find_one(doc! { "role": "superadmin" }, None).await {
        Ok(Some(doc)) => {
            println!("{}", serde_json::to_string_pretty(&doc).unwrap());
        }
        Ok(None) => {
            println!("No superadmin found in users collection.");
        }
        Err(e) => {
            eprintln!("Mongo error: {}", e);
            std::process::exit(1);
        }
    }
}

