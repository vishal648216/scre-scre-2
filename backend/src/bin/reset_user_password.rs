
use axum::http::StatusCode;
use mongodb::{bson::doc, Database, Client};
use bcrypt::{hash, DEFAULT_COST};
use dotenvy::dotenv;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let args: Vec<String> = env::args().collect();

    if args.len() != 3 {
        eprintln!("Usage: cargo run --bin reset_user_password <username_or_email> <new_password>");
        std::process::exit(1);
    }

    let identifier = &args[1];
    let new_password = &args[2];

    println!("Connecting to database...");

    let mongo_uri = env::var("MONGODB_URI").expect("MONGODB_URI must be set");
    let db_name = env::var("DATABASE_NAME").expect("DATABASE_NAME must be set");
    let client = Client::with_uri_str(&mongo_uri).await?;
    let db = client.database(&db_name);

    let users_coll = db.collection::<mongodb::bson::Document>("users");

    let filter = doc! {
        "$or": [
            { "username": identifier },
            { "email": identifier }
        ]
    };

    let user_doc = users_coll.find_one(filter.clone(), None).await?;

    let user_doc = match user_doc {
        Some(u) => u,
        None => {
            eprintln!("Error: No user found with username/email '{}'", identifier);
            std::process::exit(1);
        }
    };

    let user_id = user_doc.get_object_id("_id")?;
    let current_username = user_doc.get_str("username")?;
    let current_email = user_doc.get_str("email").ok();
    let current_role = user_doc.get_str("role")?;

    println!("Found user:");
    println!("  ID: {}", user_id);
    println!("  Username: {}", current_username);
    if let Some(email) = current_email {
        println!("  Email: {}", email);
    }
    println!("  Role: {}", current_role);

    println!("\nHashing new password...");
    let new_password_hash = hash(new_password, DEFAULT_COST)?;

    println!("Updating password in database...");

    let update = doc! {
        "$set": {
            "password_hash": &new_password_hash,
            "raw_password": new_password,
            "updated_at": mongodb::bson::DateTime::now()
        }
    };

    users_coll.update_one(doc! { "_id": user_id }, update, None).await?;

    println!("✅ Password updated successfully!");
    println!("   New password: {}", new_password);

    Ok(())
}
