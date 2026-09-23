use backend::db::connect_db;
use backend::handlers::auth::seed_super_admin;

#[tokio::main]
async fn main() {
    let (_client, db) = connect_db().await;
    seed_super_admin(&db).await;
    println!("Super Admin created successfully");
}
