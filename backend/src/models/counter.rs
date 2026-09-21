use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Counter {
    pub _id: String, // sequence name, e.g., "course_code", "subject_code"
    pub seq: i64,
}
