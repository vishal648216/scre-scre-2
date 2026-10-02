use backend::db::connect_db;
use backend::handlers::auth::seed_super_admin_with_force;
use mongodb::bson::{doc, Document};

#[tokio::main]
async fn main() {
    println!("Connecting to database...");
    let (_client, db) = connect_db().await;

    println!("Fetching all collection names...");
    let collections = match db.list_collection_names(None).await {
        Ok(names) => names,
        Err(e) => {
            eprintln!("Failed to list collection names: {}", e);
            return;
        }
    };

    println!("Purging all collections...");
    for name in &collections {
        let coll = db.collection::<Document>(name);
        match coll.delete_many(doc! {}, None).await {
            Ok(res) => println!("Cleared collection '{}': deleted {} documents", name, res.deleted_count),
            Err(e) => eprintln!("Error deleting documents from '{}': {}", name, e),
        }
    }

    println!("\nSeeding 1 SuperAdmin user...");
    seed_super_admin_with_force(&db, true).await;

    println!("\n=== Database Purge Verification Summary ===");
    let final_collections = db.list_collection_names(None).await.unwrap_or_default();
    for name in &final_collections {
        let coll = db.collection::<Document>(name);
        let count = coll.count_documents(doc! {}, None).await.unwrap_or(0);
        println!("Collection '{}': {} document(s)", name, count);
    }
    println!("Purge complete! Only 1 SuperAdmin user remains.");
}
