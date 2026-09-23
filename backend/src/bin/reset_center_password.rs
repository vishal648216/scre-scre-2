use backend::db::connect_db;
use backend::models::center::Center;
use backend::models::user::User;
use mongodb::bson::doc;
use bcrypt::{hash, DEFAULT_COST};
use std::env;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 3 {
        eprintln!("Usage: cargo run --bin reset_center_password <center_code> <new_password>");
        std::process::exit(1);
    }
    
    let center_code = &args[1];
    let new_password = &args[2];
    
    let (_client, db) = connect_db().await;
    
    let centers_coll = db.collection::<Center>("centers");
    let center = match centers_coll.find_one(doc! { "code": center_code }, None).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            eprintln!("Center with code {} not found", center_code);
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("Error finding center: {}", e);
            std::process::exit(1);
        }
    };
    
    let users_coll = db.collection::<User>("users");
    let password_hash = hash(new_password, DEFAULT_COST).expect("Failed to hash password");
    
    let update_result = users_coll.update_one(
        doc! { "_id": center.user_id },
        doc! { 
            "$set": { 
                "password_hash": password_hash,
                "raw_password": Some(new_password),
                "updated_at": mongodb::bson::DateTime::now()
            } 
        },
        None
    ).await;
    
    match update_result {
        Ok(result) if result.modified_count > 0 => {
            println!("Successfully reset password for center: {} ({})", center.name, center_code);
            println!("New username: {}", center_code);
            println!("New password: {}", new_password);
        }
        Ok(_) => {
            eprintln!("No user found for center's user_id");
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("Error updating user: {}", e);
            std::process::exit(1);
        }
    }
}
