use crate::db::get_next_sequence;
use crate::models::center::Center;
use crate::models::user::User;
use chrono::Utc;
use mongodb::{
    Database,
    bson::{doc, oid::ObjectId},
};
use rand::Rng;

async fn get_center_student_count(db: &Database, center_user_id: &ObjectId) -> u64 {
    let user_coll = db.collection::<User>("users");
    user_coll
        .count_documents(
            doc! { "parent_id": center_user_id, "role": "student", "is_deleted": false },
            None,
        )
        .await
        .unwrap_or(0)
}

async fn get_total_student_count(db: &Database) -> u64 {
    let user_coll = db.collection::<User>("users");
    user_coll
        .count_documents(doc! { "role": "student", "is_deleted": false }, None)
        .await
        .unwrap_or(0)
}

fn generate_random_digits(length: usize) -> String {
    let mut rng = rand::thread_rng();
    (0..length)
        .map(|_| rng.gen_range(0..10).to_string())
        .collect()
}

pub async fn generate_unique_center_code(db: &Database) -> String {
    let center_coll = db.collection::<Center>("centers");
    for _ in 0..1000 {
        let random_num: u32 = rand::thread_rng().gen_range(1000..9999);
        let code = format!("SCRE-{}", random_num);
        if center_coll
            .find_one(doc! { "code": &code }, None)
            .await
            .ok()
            .flatten()
            .is_none()
        {
            return code;
        }
    }
    format!("SCRE-{}", Utc::now().format("%Y%m%d%H%M%S"))
}

pub async fn generate_unique_enrollment_number(
    db: &Database,
    registration_year: i32,
    course_code: &str,
) -> String {
    let user_coll = db.collection::<User>("users");
    let total_students = get_total_student_count(db).await;

    let mut attempts = 0;
    loop {
        attempts += 1;
        if attempts > 1000 {
            return format!(
                "{}-{}-{}",
                registration_year,
                course_code,
                Utc::now().timestamp_millis()
            );
        }
        let random_length = if total_students >= 99999 {
            6
        } else if total_students >= 9999 {
            5
        } else {
            4
        };
        let random_digits = generate_random_digits(random_length);
        let candidate = format!("{}-{}-{}", registration_year, course_code, random_digits);
        if user_coll
            .find_one(doc! { "enrollment_number": &candidate }, None)
            .await
            .ok()
            .flatten()
            .is_none()
        {
            return candidate;
        }
    }
}

pub async fn generate_unique_serial_number(
    db: &Database,
    center_user_id: &ObjectId,
    full_center_code: &str,
) -> String {
    let user_coll = db.collection::<User>("users");
    let center_students = get_center_student_count(db, center_user_id).await;

    let mut attempts = 0;
    loop {
        attempts += 1;
        if attempts > 1000 {
            return format!("{}-{}", full_center_code, Utc::now().timestamp_millis());
        }
        let random_length = if center_students >= 9999 { 5 } else { 4 };
        let random_digits = generate_random_digits(random_length);
        let candidate = format!("{}-{}", full_center_code, random_digits);
        if user_coll
            .find_one(doc! { "serial_number": &candidate }, None)
            .await
            .ok()
            .flatten()
            .is_none()
        {
            return candidate;
        }
    }
}

pub async fn generate_roll_number(db: &Database, _course_id: Option<&ObjectId>) -> Option<String> {
    let now = Utc::now();
    let year_month = now.format("%Y%m").to_string();
    let seq = get_next_sequence(db, "roll_no").await;

    Some(format!("{}{:04}", year_month, seq))
}

pub async fn generate_enrollment_number(
    db: &Database,
    registration_year: i32,
    course_code: &str,
) -> String {
    generate_unique_enrollment_number(db, registration_year, course_code).await
}

pub async fn generate_serial_number(
    db: &Database,
    center_user_id: &ObjectId,
    full_center_code: &str,
) -> String {
    generate_unique_serial_number(db, center_user_id, full_center_code).await
}

pub async fn generate_referral_code(_db: &Database, user_id: &ObjectId) -> String {
    let hash = &user_id.to_hex()[..6].to_uppercase();
    let ts = Utc::now().format("%M%S").to_string();
    format!("REF-{}-{}", hash, ts)
}

/// Backward compatibility: old function signature for generate_enrollment_number
pub async fn generate_enrollment_number_old(db: &Database, center_id: &ObjectId) -> String {
    let center_coll = db.collection::<Center>("centers");
    let center = if let Ok(Some(c)) = center_coll
        .find_one(doc! { "user_id": center_id }, None)
        .await
    {
        Some(c)
    } else {
        center_coll
            .find_one(doc! { "_id": center_id }, None)
            .await
            .ok()
            .flatten()
    };
    let center_code = center.map(|c| c.code).unwrap_or_else(|| "UNK".to_string());

    let user_coll = db.collection::<User>("users");

    let mut attempts = 0;
    loop {
        attempts += 1;
        if attempts > 1000 {
            return format!("SCRE-{}-{}", center_code, Utc::now().timestamp_millis());
        }
        let total_students = get_total_student_count(db).await;
        let random_length = if total_students >= 99999 {
            6
        } else if total_students >= 9999 {
            5
        } else {
            4
        };
        let random_digits = generate_random_digits(random_length);
        let candidate = format!("SCRE-{}-{}", center_code, random_digits);
        if user_coll
            .find_one(doc! { "enrollment_number": &candidate }, None)
            .await
            .ok()
            .flatten()
            .is_none()
        {
            return candidate;
        }
    }
}

/// Backward compatibility: old function signature for generate_serial_number
pub async fn generate_serial_number_old(db: &Database, center_user_id: &ObjectId) -> String {
    let center_coll = db.collection::<Center>("centers");
    let center = if let Ok(Some(c)) = center_coll
        .find_one(doc! { "user_id": center_user_id }, None)
        .await
    {
        Some(c)
    } else {
        center_coll
            .find_one(doc! { "_id": center_user_id }, None)
            .await
            .ok()
            .flatten()
    };
    let center_code = center.map(|c| c.code).unwrap_or_else(|| "UNK".to_string());

    let user_coll = db.collection::<User>("users");

    let mut attempts = 0;
    loop {
        attempts += 1;
        if attempts > 1000 {
            return format!("SCRE-{}-{}", center_code, Utc::now().timestamp_millis());
        }
        let center_students = get_center_student_count(db, center_user_id).await;
        let random_length = if center_students >= 9999 { 5 } else { 4 };
        let random_digits = generate_random_digits(random_length);
        let candidate = format!("SCRE-{}-{}", center_code, random_digits);
        if user_coll
            .find_one(doc! { "serial_number": &candidate }, None)
            .await
            .ok()
            .flatten()
            .is_none()
        {
            return candidate;
        }
    }
}
