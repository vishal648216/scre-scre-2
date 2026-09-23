use mongodb::{Client, bson::{doc, oid::ObjectId, Document}};
use backend::services::certificate_automation::process_student_certificate;
use std::env;

#[tokio::main]
async fn main() {
    let uri = env::var("MONGODB_URI").unwrap_or_else(|_| "mongodb://localhost:27017".into());
    let client = Client::with_uri_str(uri).await.unwrap();
    let db = client.database("scre_db");
    
    let users_coll = db.collection::<Document>("users");
    
    let student = users_coll.find_one(doc! { "username": { "$regex": "052", "$options": "i" }, "role": "student" }, None).await;
    
    match student {
        Ok(Some(s)) => {
            let student_id = s.get_object_id("_id").unwrap();
            let username = s.get_str("username").unwrap_or("unknown");
            println!("Found student: {} (ID: {})", username, student_id);
            println!("Generating certificate...");
            process_student_certificate(&db, student_id).await;
            println!("Certificate generation initiated!");
            println!("Please wait a few seconds for PDF generation to complete...");
            tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
            println!("Done! Check the uploads/certificates/ folder for the PDF.");
        }
        Ok(None) => {
            println!("Student with '052' not found! Let's try any student...");
            let student = users_coll.find_one(doc! { "role": "student" }, None).await;
            match student {
                Ok(Some(s)) => {
                    let student_id = s.get_object_id("_id").unwrap();
                    let username = s.get_str("username").unwrap_or("unknown");
                    println!("Found student: {} (ID: {})", username, student_id);
                    println!("Generating certificate...");
                    process_student_certificate(&db, student_id).await;
                    println!("Certificate generation initiated!");
                    println!("Please wait a few seconds for PDF generation to complete...");
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                    println!("Done! Check the uploads/certificates/ folder for the PDF.");
                }
                _ => {
                    println!("No students found in the database!");
                }
            }
        }
        Err(e) => {
            eprintln!("Error finding student: {}", e);
        }
    }
}
