use mongodb::{Database, bson::{doc, oid::ObjectId}};
use futures_util::StreamExt;
use crate::models::exam_engine_v2::ExamV2Question;
use crate::models::subject::Subject;

pub async fn migrate_questions_to_tags(db: &Database) -> Result<String, String> {
    Ok("Migration disabled: Question model has changed to MCQ-only with options_pool.".to_string())
}
