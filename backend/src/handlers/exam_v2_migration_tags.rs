use mongodb::Database;

pub async fn migrate_questions_to_tags(_db: &Database) -> Result<String, String> {
    Ok("Migration disabled: Question model has changed to MCQ-only with options_pool.".to_string())
}
