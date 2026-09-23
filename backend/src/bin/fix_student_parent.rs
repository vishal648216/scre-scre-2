
use backend::db::connect_db;
use backend::models::user::User;
use bson::doc;
use bson::oid::ObjectId;
use futures_util::StreamExt;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let (_client, db) = connect_db().await;
    let users_coll = db.collection::<User>("users");

    let correct_center_id = ObjectId::parse_str("6a00b7ece2a8130b1a507dac").unwrap();

    let update_result = users_coll.update_one(
        doc! { "username": "teststudent1" },
        doc! { "$set": { "parent_id": correct_center_id } },
        None
    ).await;

    match update_result {
        Ok(res) if res.modified_count > 0 => {
            println!("Successfully fixed test student's parent_id!");
        }
        Ok(_) => println!("No updates needed!"),
        Err(e) => println!("Error updating student: {}", e)
    }
}
