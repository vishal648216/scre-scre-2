use std::env;
use backend::db;
use backend::services::bulk_translate::bulk_translate_all_content;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let args: Vec<String> = env::args().collect();
    
    if args.contains(&"bulk-translate".to_string()) {
        let (_client, db) = db::connect_db().await;
        bulk_translate_all_content(&db).await;
        return;
    }

    backend::run_server().await;
}
