
use backend::db::connect_db;
use backend::services::exam_auto_scheduler::run_auto_exam_allotment_cycle;

#[tokio::main]
async fn main() {
    let (_client, db) = connect_db().await;
    eprintln!("[driver] DB connected. Calling run_auto_exam_allotment_cycle(db, force=true)...");
    run_auto_exam_allotment_cycle(&db, true).await;
    eprintln!("[driver] cycle returned. All scheduler eprintln output is visible above.");
}
