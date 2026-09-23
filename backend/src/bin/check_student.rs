
use backend::db::connect_db;
use backend::models::center::Center;
use backend::models::user::User;
use bson::doc;
use futures_util::StreamExt;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let (_client, db) = connect_db().await;

    let centers_coll = db.collection::<Center>("centers");
    let mut cursor = centers_coll.find(doc! { "code": "SCRE-0004" }, None).await.unwrap();
    while let Some(Ok(center)) = cursor.next().await {
        println!("Center: name={}, code={}, user_id={}", center.name, center.code, center.user_id);
    }

    let users_coll = db.collection::<User>("users");
    let mut students_cursor = users_coll.find(doc! { "username": "teststudent1" }, None).await.unwrap();
    while let Some(Ok(student)) = students_cursor.next().await {
        println!("Test student: id={}, username={}, parent_id={:?}, role={:?}", 
            student.id.unwrap(), student.username, student.parent_id, student.role);
    }
}
