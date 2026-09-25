use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use futures_util::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, DateTime},
    Database,
};
use serde::{Deserialize, Serialize};

use crate::models::library::{Book, BookPayload, BookReadingRecord, ReadingHeartbeatPayload};
use crate::models::user::Claims;

#[derive(Serialize)]
pub struct LibraryResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
}

#[derive(Deserialize)]
pub struct BookFilter {
    pub category: Option<String>,
    pub course_id: Option<String>,
    pub search: Option<String>,
}

// GET /api/library/books
pub async fn get_books(
    State(db): State<Database>,
    Query(filter): Query<BookFilter>,
) -> impl IntoResponse {
    let coll = db.collection::<Book>("library_books");
    let mut query_doc = doc! { "is_published": true };

    if let Some(cat) = filter.category {
        if !cat.is_empty() && cat != "all" {
            query_doc.insert("category", cat);
        }
    }

    if let Some(c_id) = filter.course_id {
        if let Ok(oid) = ObjectId::parse_str(&c_id) {
            query_doc.insert("course_id", oid);
        }
    }

    if let Some(s) = filter.search {
        if !s.is_empty() {
            query_doc.insert(
                "$or",
                vec![
                    doc! { "title": { "$regex": &s, "$options": "i" } },
                    doc! { "author": { "$regex": &s, "$options": "i" } },
                    doc! { "category": { "$regex": &s, "$options": "i" } },
                ],
            );
        }
    }

    match coll.find(query_doc, None).await {
        Ok(mut cursor) => {
            let mut books = Vec::new();
            while let Some(Ok(book)) = cursor.next().await {
                books.push(book);
            }
            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(books),
                    message: None,
                }),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some(e.to_string()),
            }),
        ),
    }
}

// GET /api/library/admin/books (includes unpublished)
pub async fn get_all_books_admin(
    State(db): State<Database>,
) -> impl IntoResponse {
    let coll = db.collection::<Book>("library_books");
    match coll.find(doc! {}, None).await {
        Ok(mut cursor) => {
            let mut books = Vec::new();
            while let Some(Ok(book)) = cursor.next().await {
                books.push(book);
            }
            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(books),
                    message: None,
                }),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some(e.to_string()),
            }),
        ),
    }
}

// POST /api/library/books
pub async fn create_book(
    State(db): State<Database>,
    Json(payload): Json<BookPayload>,
) -> impl IntoResponse {
    let coll = db.collection::<Book>("library_books");
    let now = DateTime::now();

    let course_oid = payload
        .course_id
        .and_then(|c| ObjectId::parse_str(&c).ok());
    let center_oid = payload
        .center_id
        .and_then(|c| ObjectId::parse_str(&c).ok());

    let book = Book {
        id: None,
        title: payload.title.clone(),
        author: payload.author.clone(),
        category: payload.category.clone(),
        isbn: payload.isbn.clone(),
        publisher: payload.publisher.clone(),
        edition: payload.edition.clone(),
        volume_part: payload.volume_part.clone(),
        registered_date: payload.registered_date.clone(),
        shelf_location: payload.shelf_location.clone(),
        physical_copies: payload.physical_copies,
        available_copies: payload.available_copies,
        fine_per_day: payload.fine_per_day,
        description: payload.description.clone(),
        cover_url: payload.cover_url.clone(),
        pdf_url: payload.pdf_url.clone(),
        video_url: payload.video_url.clone(),
        total_pages: payload.total_pages,
        is_published: payload.is_published.unwrap_or(true),
        course_id: course_oid,
        center_id: center_oid,
        center_name: payload.center_name.clone(),
        created_at: Some(now),
        updated_at: Some(now),
    };

    match coll.insert_one(book, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(LibraryResponse {
                success: true,
                data: Some(res.inserted_id.to_string()),
                message: Some("Book created successfully".to_string()),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some(e.to_string()),
            }),
        ),
    }
}

// PUT /api/library/books/:id
pub async fn update_book(
    State(db): State<Database>,
    Path(id): Path<String>,
    Json(payload): Json<BookPayload>,
) -> impl IntoResponse {
    let coll = db.collection::<Book>("library_books");
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(LibraryResponse {
                    success: false,
                    data: None,
                    message: Some("Invalid book ID".to_string()),
                }),
            );
        }
    };

    let course_oid = payload
        .course_id
        .and_then(|c| ObjectId::parse_str(&c).ok());
    let center_oid = payload
        .center_id
        .and_then(|c| ObjectId::parse_str(&c).ok());

    let update_doc = doc! {
        "$set": {
            "title": payload.title,
            "author": payload.author,
            "category": payload.category,
            "isbn": payload.isbn,
            "publisher": payload.publisher,
            "edition": payload.edition,
            "volume_part": payload.volume_part,
            "registered_date": payload.registered_date,
            "shelf_location": payload.shelf_location,
            "physical_copies": payload.physical_copies,
            "available_copies": payload.available_copies,
            "fine_per_day": payload.fine_per_day,
            "description": payload.description,
            "cover_url": payload.cover_url,
            "pdf_url": payload.pdf_url,
            "video_url": payload.video_url,
            "total_pages": payload.total_pages,
            "is_published": payload.is_published.unwrap_or(true),
            "course_id": course_oid,
            "center_id": center_oid,
            "center_name": payload.center_name,
            "updated_at": DateTime::now()
        }
    };

    match coll.update_one(doc! { "_id": oid }, update_doc, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(LibraryResponse {
                success: true,
                data: Some(id),
                message: Some("Book updated successfully".to_string()),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some(e.to_string()),
            }),
        ),
    }
}

// DELETE /api/library/books/:id
pub async fn delete_book(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let coll = db.collection::<Book>("library_books");
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(LibraryResponse {
                    success: false,
                    data: None,
                    message: Some("Invalid book ID".to_string()),
                }),
            );
        }
    };

    match coll.delete_one(doc! { "_id": oid }, None).await {
        Ok(_) => (
            StatusCode::OK,
            Json(LibraryResponse {
                success: true,
                data: Some(id),
                message: Some("Book deleted successfully".to_string()),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some(e.to_string()),
            }),
        ),
    }
}

// POST /api/library/reading/heartbeat
pub async fn record_heartbeat(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<ReadingHeartbeatPayload>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(LibraryResponse {
                    success: false,
                    data: None,
                    message: Some("Invalid token subject".to_string()),
                }),
            );
        }
    };

    let book_oid = match ObjectId::parse_str(&payload.book_id) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(LibraryResponse {
                    success: false,
                    data: None,
                    message: Some("Invalid book ID".to_string()),
                }),
            );
        }
    };

    let coll = db.collection::<BookReadingRecord>("book_reading_records");
    let filter = doc! { "student_id": student_oid, "book_id": book_oid };

    let inc_seconds = if payload.seconds > 0 && payload.seconds <= 300 {
        payload.seconds
    } else {
        30 // default heartbeat pulse
    };

    let page = payload.current_page.unwrap_or(1);

    let update = doc! {
        "$inc": { "total_seconds_read": inc_seconds },
        "$set": {
            "last_page": page,
            "last_read_at": DateTime::now()
        }
    };

    let options = mongodb::options::UpdateOptions::builder()
        .upsert(true)
        .build();

    match coll.update_one(filter, update, options).await {
        Ok(_) => (
            StatusCode::OK,
            Json(LibraryResponse {
                success: true,
                data: Some(true),
                message: Some("Heartbeat recorded".to_string()),
            }),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some(e.to_string()),
            }),
        ),
    }
}

// GET /api/library/reading/my-stats
pub async fn get_my_reading_stats(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => oid,
        Err(_) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(LibraryResponse {
                    success: false,
                    data: None,
                    message: Some("Invalid token".to_string()),
                }),
            );
        }
    };

    let coll = db.collection::<BookReadingRecord>("book_reading_records");
    match coll.find(doc! { "student_id": student_oid }, None).await {
        Ok(mut cursor) => {
            let mut records = Vec::new();
            let mut total_seconds: i64 = 0;
            while let Some(Ok(rec)) = cursor.next().await {
                total_seconds += rec.total_seconds_read;
                records.push(rec);
            }

            #[derive(Serialize)]
            struct ReadingStats {
                pub total_minutes: i64,
                pub books_count: usize,
                pub records: Vec<BookReadingRecord>,
            }

            let stats = ReadingStats {
                total_minutes: total_seconds / 60,
                books_count: records.len(),
                records,
            };
            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(serde_json::to_value(stats).unwrap_or_default()),
                    message: None,
                }),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some(e.to_string()),
            }),
        ),
    }
}

// POST /api/library/issues - Issue physical book to student
pub async fn issue_book(
    State(db): State<Database>,
    Json(payload): Json<crate::models::library::IssueBookPayload>,
) -> impl IntoResponse {
    let book_oid = match ObjectId::parse_str(&payload.book_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse { success: false, data: None, message: Some("Invalid Book ID".into()) })),
    };
    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse { success: false, data: None, message: Some("Invalid Student ID".into()) })),
    };

    let books_coll = db.collection::<mongodb::bson::Document>("library_books");
    let users_coll = db.collection::<mongodb::bson::Document>("users");

    let book_doc = match books_coll.find_one(doc! { "_id": book_oid }, None).await {
        Ok(Some(b)) => b,
        _ => return (StatusCode::NOT_FOUND, Json(LibraryResponse { success: false, data: None, message: Some("Book not found".into()) })),
    };

    let student_doc = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, Json(LibraryResponse { success: false, data: None, message: Some("Student not found".into()) })),
    };

    let book_title = book_doc.get_str("title").unwrap_or("Untitled Book").to_string();
    let student_name = payload
        .student_name
        .as_deref()
        .filter(|s| !s.trim().is_empty() && *s != "Unknown Student")
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            student_doc.get_str("full_name").or_else(|_| student_doc.get_str("username")).unwrap_or("Student").to_string()
        });
    let enrollment_number = student_doc.get_str("enrollment_number").ok().map(|s| s.to_string());

    let center_oid = payload.center_id.as_deref().and_then(|c| ObjectId::parse_str(c).ok());
    let center_name = payload.center_name.clone().or_else(|| {
        book_doc.get_str("center_name").ok().map(|s| s.to_string())
    });

    let issues_coll = db.collection::<mongodb::bson::Document>("library_book_issues");
    let now = DateTime::now();
    let due_dt = if !payload.due_date.trim().is_empty() {
        if let Ok(ndt) = chrono::NaiveDate::parse_from_str(&payload.due_date, "%Y-%m-%d") {
            let dt = ndt.and_hms_opt(23, 59, 59).unwrap_or_default();
            DateTime::from_chrono(chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(dt, chrono::Utc))
        } else {
            DateTime::from_millis(now.timestamp_millis() + 14 * 86400 * 1000)
        }
    } else {
        DateTime::from_millis(now.timestamp_millis() + 14 * 86400 * 1000)
    };

    let issue_doc = doc! {
        "book_id": book_oid,
        "student_id": student_oid,
        "book_title": book_title,
        "student_name": student_name,
        "enrollment_number": enrollment_number,
        "student_address": payload.student_address.or_else(|| student_doc.get_str("address").ok().map(|s| s.to_string())),
        "student_phone": payload.student_phone.or_else(|| student_doc.get_str("phone").or_else(|_| student_doc.get_str("mobile")).ok().map(|s| s.to_string())),
        "student_gov_id": payload.student_gov_id.or_else(|| student_doc.get_str("aadhaar_number").or_else(|_| student_doc.get_str("id_proof")).ok().map(|s| s.to_string())),
        "center_id": center_oid,
        "center_name": center_name,
        "librarian_name": payload.librarian_name,
        "document_number": payload.document_number,
        "document_url": payload.document_url,
        "issue_date": now,
        "due_date": due_dt,
        "status": "Issued",
        "fine_amount": 0.0,
        "fine_paid": false,
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    };

    match issues_coll.insert_one(issue_doc, None).await {
        Ok(_) => {
            let current_avail = book_doc.get_i32("available_copies").unwrap_or(5);
            let new_avail = (current_avail - 1).max(0);
            let _ = books_coll.update_one(
                doc! { "_id": book_oid },
                doc! { "$set": { "available_copies": new_avail } },
                None
            ).await;
            (StatusCode::CREATED, Json(LibraryResponse { success: true, data: Some("Book issued successfully".to_string()), message: None }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LibraryResponse { success: false, data: None, message: Some(e.to_string()) })),
    }
}

// POST /api/library/issues/:id/send-reminder - Send 2-day due reminder notification
pub async fn send_issue_reminder(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse { success: false, data: None, message: Some("Invalid issue ID".into()) })),
    };

    let issues_coll = db.collection::<mongodb::bson::Document>("library_book_issues");
    let issue_doc = match issues_coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(d)) => d,
        _ => return (StatusCode::NOT_FOUND, Json(LibraryResponse { success: false, data: None, message: Some("Issue record not found".into()) })),
    };

    let student_oid = issue_doc.get_object_id("student_id").ok();
    let book_title = issue_doc.get_str("book_title").unwrap_or("Library Book");
    let due_date = issue_doc.get_str("due_date").unwrap_or("due date");

    if let Some(s_oid) = student_oid {
        let notifs_coll = db.collection::<mongodb::bson::Document>("notifications");
        let now = DateTime::now();
        let notif = doc! {
            "user_id": s_oid,
            "title": format!("⏰ Library Reminder: Book Return Due for {}", book_title),
            "message": format!("Reminder: Please return '{}' by {} to avoid late penalty fees.", book_title, due_date),
            "type": "library_reminder",
            "read": false,
            "created_at": now,
        };
        let _ = notifs_coll.insert_one(notif, None).await;
        let _ = issues_coll.update_one(doc! { "_id": oid }, doc! { "$set": { "reminder_sent_at": now } }, None).await;
    }

    (StatusCode::OK, Json(LibraryResponse { success: true, data: Some("Reminder sent to student portal".to_string()), message: None }))
}

// PUT /api/library/issues/:id/reissue - Extend book due date
pub async fn reissue_book(
    State(db): State<Database>,
    Path(id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse { success: false, data: None, message: Some("Invalid issue ID".into()) })),
    };

    let new_due = payload.get("new_due_date").and_then(|v| v.as_str()).unwrap_or("");
    let notes = payload.get("notes").and_then(|v| v.as_str());

    let issues_coll = db.collection::<mongodb::bson::Document>("library_book_issues");
    let update = doc! {
        "$set": {
            "status": "Issued",
            "due_date": new_due,
            "notes": notes,
            "reissued_at": DateTime::now(),
            "updated_at": DateTime::now()
        }
    };

    match issues_coll.update_one(doc! { "_id": oid }, update, None).await {
        Ok(_) => (StatusCode::OK, Json(LibraryResponse { success: true, data: Some("Book re-issued with extended due date".to_string()), message: None })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LibraryResponse { success: false, data: None, message: Some(e.to_string()) })),
    }
}

// POST /api/library/reservations/:id/convert-to-issue - Convert reservation to active issue
pub async fn convert_reservation_to_issue(
    State(db): State<Database>,
    Path(id): Path<String>,
    Json(payload): Json<crate::models::library::IssueBookPayload>,
) -> impl IntoResponse {
    let res_oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse::<Option<String>> { success: false, data: None, message: Some("Invalid reservation ID".into()) })).into_response(),
    };

    let res_coll = db.collection::<mongodb::bson::Document>("library_reservations");

    // Fulfill reservation
    let _ = res_coll.update_one(doc! { "_id": res_oid }, doc! { "$set": { "status": "Fulfilled", "updated_at": DateTime::now() } }, None).await;

    // Issue book
    issue_book(State(db), Json(payload)).await.into_response()
}

// GET /api/library/issues - List all issued books
pub async fn get_book_issues(
    State(db): State<Database>,
) -> impl IntoResponse {
    let coll = db.collection::<mongodb::bson::Document>("library_book_issues");
    match coll.find(None, None).await {
        Ok(mut cursor) => {
            let mut list = Vec::new();
            while let Some(Ok(doc)) = cursor.next().await {
                list.push(doc);
            }
            (StatusCode::OK, Json(LibraryResponse { success: true, data: Some(list), message: None }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LibraryResponse { success: false, data: None, message: Some(e.to_string()) })),
    }
}

// PUT /api/library/issues/:id/return - Return issued book
pub async fn return_book(
    State(db): State<Database>,
    Path(id): Path<String>,
    Json(payload): Json<crate::models::library::ReturnBookPayload>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse { success: false, data: None, message: Some("Invalid issue ID".into()) })),
    };

    let issues_coll = db.collection::<mongodb::bson::Document>("library_book_issues");
    let issue_doc = match issues_coll.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(d)) => d,
        _ => return (StatusCode::NOT_FOUND, Json(LibraryResponse { success: false, data: None, message: Some("Issue record not found".into()) })),
    };

    let book_oid = issue_doc.get_object_id("book_id").ok();

    let update = doc! {
        "$set": {
            "status": "Returned",
            "return_date": DateTime::now(),
            "fine_amount": payload.fine_amount.unwrap_or(0.0),
            "fine_paid": payload.fine_paid.unwrap_or(true),
            "book_condition": payload.book_condition.unwrap_or("Good".to_string()),
            "librarian_name": payload.librarian_name,
            "document_url": payload.document_url,
            "penalty_reason": payload.penalty_reason,
            "notes": payload.notes,
            "updated_at": DateTime::now()
        }
    };

    match issues_coll.update_one(doc! { "_id": oid }, update, None).await {
        Ok(_) => {
            if let Some(b_oid) = book_oid {
                let books_coll = db.collection::<mongodb::bson::Document>("library_books");
                let _ = books_coll.update_one(doc! { "_id": b_oid }, doc! { "$inc": { "available_copies": 1 } }, None).await;
            }
            (StatusCode::OK, Json(LibraryResponse { success: true, data: Some("Book returned successfully".to_string()), message: None }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LibraryResponse { success: false, data: None, message: Some(e.to_string()) })),
    }
}

// GET /api/library/student/my-issues
pub async fn get_my_issued_books(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
        Err(_) => return (StatusCode::UNAUTHORIZED, Json(LibraryResponse { success: false, data: None, message: Some("Invalid token".into()) })),
    };
    let coll = db.collection::<mongodb::bson::Document>("library_book_issues");
    match coll.find(doc! { "student_id": student_oid }, None).await {
        Ok(mut cursor) => {
            let mut list = Vec::new();
            while let Some(Ok(doc)) = cursor.next().await {
                list.push(doc);
            }
            (StatusCode::OK, Json(LibraryResponse { success: true, data: Some(list), message: None }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LibraryResponse { success: false, data: None, message: Some(e.to_string()) })),
    }
}

// POST /api/library/reservations
pub async fn reserve_book(
    State(db): State<Database>,
    Json(payload): Json<crate::models::library::ReserveBookPayload>,
) -> impl IntoResponse {
    let book_oid = match ObjectId::parse_str(&payload.book_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse { success: false, data: None, message: Some("Invalid Book ID".into()) })),
    };
    let student_oid = match ObjectId::parse_str(&payload.student_id) {
        Ok(o) => o,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(LibraryResponse { success: false, data: None, message: Some("Invalid Student ID".into()) })),
    };

    let books_coll = db.collection::<mongodb::bson::Document>("library_books");
    let users_coll = db.collection::<mongodb::bson::Document>("users");

    let book_doc = match books_coll.find_one(doc! { "_id": book_oid }, None).await {
        Ok(Some(b)) => b,
        _ => return (StatusCode::NOT_FOUND, Json(LibraryResponse { success: false, data: None, message: Some("Book not found".into()) })),
    };

    let student_doc = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(s)) => s,
        _ => return (StatusCode::NOT_FOUND, Json(LibraryResponse { success: false, data: None, message: Some("Student not found".into()) })),
    };

    let book_title = book_doc.get_str("title").unwrap_or("Untitled Book").to_string();
    let student_name = student_doc.get_str("full_name").or_else(|_| student_doc.get_str("username")).unwrap_or("Student").to_string();
    let enrollment_number = student_doc.get_str("enrollment_number").ok().map(|s| s.to_string());

    let res_coll = db.collection::<mongodb::bson::Document>("library_reservations");
    let now = DateTime::now();

    let res_doc = doc! {
        "book_id": book_oid,
        "student_id": student_oid,
        "book_title": book_title,
        "student_name": student_name,
        "enrollment_number": enrollment_number,
        "reservation_date": now,
        "status": "Pending",
        "notes": payload.notes,
    };

    match res_coll.insert_one(res_doc, None).await {
        Ok(_) => (StatusCode::CREATED, Json(LibraryResponse { success: true, data: Some("Book reserved successfully".to_string()), message: None })),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LibraryResponse { success: false, data: None, message: Some(e.to_string()) })),
    }
}

// GET /api/library/reservations
pub async fn get_reservations(
    State(db): State<Database>,
) -> impl IntoResponse {
    let coll = db.collection::<mongodb::bson::Document>("library_reservations");
    match coll.find(None, None).await {
        Ok(mut cursor) => {
            let mut list = Vec::new();
            while let Some(Ok(doc)) = cursor.next().await {
                list.push(doc);
            }
            (StatusCode::OK, Json(LibraryResponse { success: true, data: Some(list), message: None }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(LibraryResponse { success: false, data: None, message: Some(e.to_string()) })),
    }
}

// POST /api/library/purge-test-data
pub async fn purge_library_test_data(
    State(db): State<Database>,
) -> impl IntoResponse {
    let books_coll = db.collection::<mongodb::bson::Document>("library_books");
    let issues_coll = db.collection::<mongodb::bson::Document>("library_book_issues");
    let res_coll = db.collection::<mongodb::bson::Document>("library_reservations");

    // Clear old bogus records
    let _ = books_coll.delete_many(doc! {}, None).await;
    let _ = issues_coll.delete_many(doc! {}, None).await;
    let _ = res_coll.delete_many(doc! {}, None).await;

    // Seed realistic Amazon-style catalog books
    let now = DateTime::now();
    let seed_books = vec![
        doc! {
            "title": "Computer Fundamentals & Office Automation (DCA)",
            "author": "Dr. P.K. Sinha & Preeti Sinha",
            "category": "Computer Science",
            "isbn": "978-81-7656-752-7",
            "publisher": "BPB Publications",
            "edition": "6th Revised Edition",
            "volume_part": "Vol 1",
            "registered_date": "2026-01-15",
            "shelf_location": "Rack A / Shelf 1",
            "physical_copies": 10,
            "available_copies": 8,
            "fine_per_day": 10.0,
            "description": "Comprehensive guide covering hardware, operating systems, MS Office suite, internet essentials, and digital literacy.",
            "cover_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
            "pdf_url": "/uploads/sample_computer_fundamentals.pdf",
            "total_pages": 420,
            "center_name": "Main Central Library",
            "is_published": true,
            "created_at": now,
            "updated_at": now,
        },
        doc! {
            "title": "Tally Prime & GST Accounting Masterclass",
            "author": "CA Official Tally Academy",
            "category": "Accounting & Tally",
            "isbn": "978-93-8984-512-1",
            "publisher": "Taxmann Publications",
            "edition": "2nd Edition (2026)",
            "volume_part": "Vol 1",
            "registered_date": "2026-02-10",
            "shelf_location": "Rack B / Shelf 3",
            "physical_copies": 8,
            "available_copies": 6,
            "fine_per_day": 15.0,
            "description": "Step-by-step practical manual for computerized accounting, GST returns, e-invoicing, inventory management, and payroll in Tally Prime.",
            "cover_url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80",
            "pdf_url": "/uploads/sample_tally_prime.pdf",
            "total_pages": 350,
            "center_name": "Main Central Library",
            "is_published": true,
            "created_at": now,
            "updated_at": now,
        },
        doc! {
            "title": "Python Programming & Data Structures",
            "author": "Reema Thareja",
            "category": "Programming & Web Dev",
            "isbn": "978-01-9948-017-3",
            "publisher": "Oxford University Press",
            "edition": "3rd Edition",
            "volume_part": "Vol 2",
            "registered_date": "2026-03-01",
            "shelf_location": "Rack C / Shelf 2",
            "physical_copies": 12,
            "available_copies": 10,
            "fine_per_day": 10.0,
            "description": "In-depth treatment of core Python concepts, object-oriented programming, algorithms, data structures, and web API development.",
            "cover_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
            "pdf_url": "/uploads/sample_python_ds.pdf",
            "total_pages": 580,
            "center_name": "Main Central Library",
            "is_published": true,
            "created_at": now,
            "updated_at": now,
        },
        doc! {
            "title": "Modern Web Development (HTML5, CSS3, JS & React)",
            "author": "Jon Duckett",
            "category": "Programming & Web Dev",
            "isbn": "978-11-1887-164-5",
            "publisher": "Wiley Publishing",
            "edition": "1st Edition",
            "volume_part": "Vol 1",
            "registered_date": "2026-03-12",
            "shelf_location": "Rack C / Shelf 4",
            "physical_copies": 6,
            "available_copies": 4,
            "fine_per_day": 10.0,
            "description": "Visual guide to front-end web development, responsive web design principles, UI UX components, and modern Javascript frameworks.",
            "cover_url": "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80",
            "pdf_url": "/uploads/sample_web_dev.pdf",
            "total_pages": 490,
            "center_name": "Main Central Library",
            "is_published": true,
            "created_at": now,
            "updated_at": now,
        },
        doc! {
            "title": "Graphic Design & Adobe Photoshop Masterguide",
            "author": "Robin Williams & John Tollett",
            "category": "Graphic & UI/UX Design",
            "isbn": "978-01-3430-802-9",
            "publisher": "Peachpit Press",
            "edition": "2026 Edition",
            "volume_part": "Vol 1",
            "registered_date": "2026-03-20",
            "shelf_location": "Rack D / Shelf 1",
            "physical_copies": 5,
            "available_copies": 5,
            "fine_per_day": 12.0,
            "description": "Design principles, typography, color theory, digital artwork editing, photo retouching, and vector graphics creation.",
            "cover_url": "https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&w=600&q=80",
            "pdf_url": "/uploads/sample_graphic_design.pdf",
            "total_pages": 310,
            "center_name": "Main Central Library",
            "is_published": true,
            "created_at": now,
            "updated_at": now,
        },
    ];

    let _ = books_coll.insert_many(seed_books, None).await;

    (
        StatusCode::OK,
        Json(LibraryResponse {
            success: true,
            data: Some("Purged test data and seeded 5 realistic library catalog books successfully".to_string()),
            message: None,
        }),
    )
}
