use backend::db::connect_db;
use futures_util::StreamExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (_client, db) = connect_db().await;

    println!("===========================================");
    println!("🔍 CHECKING DATABASE CONTENT SUMMARY...");
    println!("===========================================");

    let collections = vec![
        "users", "centers", "courses", "certificates", 
        "announcements", "internship_postings", "internship_applications", 
        "colleges", "contacts"
    ];

    for name in collections {
        let coll = db.collection::<mongodb::bson::Document>(name);
        let count = coll.count_documents(None, None).await.unwrap_or(0);
        println!("Collection [{}] -> {} documents", name, count);
    }

    // Print sample users
    let users_coll = db.collection::<mongodb::bson::Document>("users");
    let mut cursor = users_coll.find(None, None).await?;
    println!("\nUser Accounts found:");
    while let Some(Ok(u)) = cursor.next().await {
        let username = u.get_str("username").unwrap_or("N/A");
        let role = u.get_str("role").unwrap_or("N/A");
        println!("  • Username: {}, Role: {}", username, role);
    }

    // Print sample centers
    let centers_coll = db.collection::<mongodb::bson::Document>("centers");
    let mut c_cursor = centers_coll.find(None, None).await?;
    println!("\nCenters found:");
    while let Some(Ok(c)) = c_cursor.next().await {
        let name = c.get_str("name").unwrap_or("N/A");
        let code = c.get_str("code").unwrap_or("N/A");
        println!("  • Center: {}, Code: {}", name, code);
    }

    Ok(())
}
