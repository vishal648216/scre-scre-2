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

    let book = Book {
        id: None,
        title: payload.title,
        author: payload.author,
        category: payload.category,
        description: payload.description,
        cover_url: payload.cover_url,
        pdf_url: payload.pdf_url,
        total_pages: payload.total_pages,
        is_published: payload.is_published.unwrap_or(true),
        course_id: course_oid,
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

    let update_doc = doc! {
        "$set": {
            "title": payload.title,
            "author": payload.author,
            "category": payload.category,
            "description": payload.description,
            "cover_url": payload.cover_url,
            "pdf_url": payload.pdf_url,
            "total_pages": payload.total_pages,
            "is_published": payload.is_published.unwrap_or(true),
            "course_id": course_oid,
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

            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(ReadingStats {
                        total_minutes: total_seconds / 60,
                        books_count: records.len(),
                        records,
                    }),
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
