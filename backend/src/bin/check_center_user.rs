use backend::db::connect_db;
use backend::models::center::Center;
use backend::models::user::User;
use mongodb::bson::doc;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    let (_client, db) = connect_db().await;
    let centers_coll = db.collection::<Center>("centers");
    let users_coll = db.collection::<User>("users");
    
    let center = centers_coll.find_one(doc! { "code": "SCRE-0004" }, None).await
        .expect("Failed to find center")
        .expect("Center not found");
    
    let user = users_coll.find_one(doc! { "_id": center.user_id }, None).await
        .expect("Failed to find user")
        .expect("User not found");
    
    println!("Center User Details:");
    println!("Username: {}", user.username);
    println!("Role: {:?}", user.role);
    println!("Raw password (if stored): {:?}", user.raw_password);
}
