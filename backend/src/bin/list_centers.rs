use backend::db::connect_db;
use backend::models::center::Center;
use futures_util::StreamExt;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    let (_client, db) = connect_db().await;
    let centers_coll = db.collection::<Center>("centers");
    
    let mut cursor = centers_coll.find(None, None).await.expect("Failed to list centers");
    
    println!("All centers:");
    println!("=============");
    
    while let Some(result) = cursor.next().await {
        if let Ok(center) = result {
            println!("Name: {}, Code: {}, ID: {}", center.name, center.code, center.id.unwrap());
        }
    }
}
