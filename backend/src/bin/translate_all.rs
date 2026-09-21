use backend::db::connect_db;
use backend::services::bulk_translate::bulk_translate_all_content;
use dotenvy::dotenv;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    println!("Starting full site translation...");
    
    let (_client, db) = connect_db().await;
    bulk_translate_all_content(&db).await;
    
    println!("Translation process finished.");
    Ok(())
}
