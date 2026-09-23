use mongodb::{Database, bson::{doc, oid::ObjectId}};
use crate::models::center::{Center, CenterKeyDocuments};
use crate::models::course::Course;

pub async fn update_scrc_placeholders(db: &Database) {
    let center_coll = db.collection::<Center>("centers");
    
    // 1. Update Center SCRE-0001 with placeholder stamp and signature
    let placeholder_signature = "https://via.placeholder.com/150x50?text=Signature";
    let placeholder_stamp = "https://via.placeholder.com/100?text=Stamp";
    
    let filter = doc! { "code": "SCRE-0001" };
    let update = doc! {
        "$set": {
            "key_documents.owner_signature_url": placeholder_signature,
            "key_documents.center_stamp_url": placeholder_stamp
        }
    };
    
    match center_coll.update_one(filter, update, None).await {
        Ok(res) => println!("Center SCRE-0001 update result: matched={}, modified={}", res.matched_count, res.modified_count),
        Err(e) => eprintln!("Failed to update center SCRE-0001: {}", e),
    }

    // 2. Update ADCA course duration
    let course_coll = db.collection::<Course>("courses");
    let course_filter = doc! { "short_code": "ADCA" };
    let course_update = doc! {
        "$set": {
            "duration_months": 12,
            "duration_value": 1,
            "duration_unit": "years"
        }
    };
    
    match course_coll.update_one(course_filter, course_update, None).await {
        Ok(res) => println!("ADCA course update result: matched={}, modified={}", res.matched_count, res.modified_count),
        Err(e) => eprintln!("Failed to update ADCA course: {}", e),
    }
}
