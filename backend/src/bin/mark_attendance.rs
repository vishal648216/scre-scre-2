use mongodb::{bson::doc, Database, Client, bson::oid::ObjectId};
use std::env;
use chrono::Utc;

#[tokio::main]
async fn main() {
    let uri = env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".into());
    let client = Client::with_uri_str(uri).await.unwrap();
    let db = client.database("scre_db");

    let student_id = "69e3303f320a91ee7a8de667";
    let sid = ObjectId::parse_str(student_id).unwrap();
    let center_id = "69b83909ff0e34c7c2353549";
    let cid = ObjectId::parse_str(center_id).unwrap();

    let coll = db.collection::<mongodb::bson::Document>("attendances");
    
    // Create attendance for today (UTC range)
    let now = Utc::now();
    let today_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
    
    let attendance = doc! {
        "student_id": sid,
        "center_id": cid,
        "date": mongodb::bson::DateTime::from_millis(today_start.timestamp_millis()),
        "status": "present",
        "remarks": "Auto-marked for testing"
    };

    let filter = doc! {
        "student_id": sid,
        "date": {
            "$gte": mongodb::bson::DateTime::from_millis(today_start.timestamp_millis()),
            "$lt": mongodb::bson::DateTime::from_millis(today_start.timestamp_millis() + 86400000)
        }
    };
    
    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
    match coll.update_one(filter, doc! { "$set": attendance }, options).await {
        Ok(_) => println!("Successfully marked attendance for today"),
        Err(e) => println!("Failed to mark attendance: {}", e),
    }
}
