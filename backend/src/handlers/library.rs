use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Duration;
use futures_util::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, DateTime},
    Database,
};
use serde::{Deserialize, Serialize};

use crate::models::library::{
    Book, BookIssuePayload, BookIssueRecord, BookPayload, BookReadingRecord,
    ReadingHeartbeatPayload, ReturnBookPayload,
};
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

#[derive(Deserialize)]
pub struct IssueFilter {
    pub status: Option<String>,
    pub student_id: Option<String>,
    pub center_id: Option<String>,
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
            query_doc.insert(
                "$or",
                vec![
                    doc! { "category": &cat },
                    doc! { "categories": &cat },
                ],
            );
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
                    doc! { "categories": { "$regex": &s, "$options": "i" } },
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

    let total_copies = payload.total_copies.unwrap_or(1);
    let damaged_copies = payload.damaged_copies.unwrap_or(0);

    let book = Book {
        id: None,
        title: payload.title,
        author: payload.author,
        category: payload.category,
        categories: payload.categories,
        description: payload.description,
        cover_url: payload.cover_url,
        pdf_url: payload.pdf_url,
        youtube_url: payload.youtube_url,
        external_url: payload.external_url,
        price: payload.price,
        isbn: payload.isbn,
        edition: payload.edition,
        is_physical: payload.is_physical,
        total_copies: Some(total_copies),
        available_copies: Some(total_copies - damaged_copies),
        damaged_copies: Some(damaged_copies),
        shelf_location: payload.shelf_location,
        rack_number: payload.rack_number,
        procurement_needed: payload.procurement_needed,
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
    let clean_id = id.trim();
    let filter = if let Ok(oid) = ObjectId::parse_str(clean_id) {
        doc! { "$or": [ doc! { "_id": oid }, doc! { "_id": clean_id }, doc! { "id": clean_id } ] }
    } else {
        doc! { "$or": [ doc! { "_id": clean_id }, doc! { "id": clean_id } ] }
    };

    let course_oid = payload
        .course_id
        .and_then(|c| ObjectId::parse_str(&c).ok());

    let mut set_doc = doc! {
        "title": payload.title,
        "author": payload.author,
        "category": payload.category,
        "description": payload.description,
        "cover_url": payload.cover_url,
        "pdf_url": payload.pdf_url,
        "youtube_url": payload.youtube_url,
        "external_url": payload.external_url,
        "price": payload.price,
        "isbn": payload.isbn,
        "edition": payload.edition,
        "is_physical": payload.is_physical,
        "shelf_location": payload.shelf_location,
        "rack_number": payload.rack_number,
        "damaged_copies": payload.damaged_copies.unwrap_or(0),
        "procurement_needed": payload.procurement_needed.unwrap_or(false),
        "total_pages": payload.total_pages,
        "is_published": payload.is_published.unwrap_or(true),
        "course_id": course_oid,
        "updated_at": DateTime::now()
    };

    if let Some(cats) = payload.categories {
        set_doc.insert("categories", cats);
    }

    if let Some(tc) = payload.total_copies {
        set_doc.insert("total_copies", tc);
        set_doc.insert("available_copies", tc);
    }

    match coll.update_one(filter, doc! { "$set": set_doc }, None).await {
        Ok(res) if res.matched_count > 0 => (
            StatusCode::OK,
            Json(LibraryResponse {
                success: true,
                data: Some(clean_id.to_string()),
                message: Some("Book updated successfully".to_string()),
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some("Book not found for update".to_string()),
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
    let clean_id = id.trim();
    let filter = if let Ok(oid) = ObjectId::parse_str(clean_id) {
        doc! { "$or": [ doc! { "_id": oid }, doc! { "_id": clean_id }, doc! { "id": clean_id } ] }
    } else {
        doc! { "$or": [ doc! { "_id": clean_id }, doc! { "id": clean_id } ] }
    };

    match coll.delete_one(filter, None).await {
        Ok(res) if res.deleted_count > 0 => (
            StatusCode::OK,
            Json(LibraryResponse {
                success: true,
                data: Some(clean_id.to_string()),
                message: Some("Book deleted successfully".to_string()),
            }),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some("Book not found".to_string()),
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

// POST /api/library/issue (Issue a book to student)
pub async fn issue_book(
    State(db): State<Database>,
    Json(payload): Json<BookIssuePayload>,
) -> impl IntoResponse {
    let clean_book_id = payload.book_id.trim();
    let clean_student_id = payload.student_id.trim();

    if clean_book_id.is_empty() || clean_student_id.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some("Book ID and Student ID are required".to_string()),
            }),
        );
    }

    let book_oid_opt = ObjectId::parse_str(clean_book_id).ok();
    let books_coll = db.collection::<Book>("library_books");
    let book_filter = match book_oid_opt {
        Some(oid) => doc! { "$or": [ doc! { "_id": oid }, doc! { "_id": clean_book_id }, doc! { "id": clean_book_id }, doc! { "title": clean_book_id } ] },
        None => doc! { "$or": [ doc! { "_id": clean_book_id }, doc! { "id": clean_book_id }, doc! { "title": clean_book_id } ] },
    };

    let book_doc = books_coll.find_one(book_filter, None).await.ok().flatten();

    let book_oid = book_doc.as_ref().and_then(|b| b.id).unwrap_or_else(|| book_oid_opt.unwrap_or_else(ObjectId::new));
    let book_title = match book_doc {
        Some(ref b) => b.title.clone(),
        None => clean_book_id.to_string(),
    };
    let is_physical = book_doc.as_ref().and_then(|b| b.is_physical).unwrap_or(false);

    let student_oid_opt = ObjectId::parse_str(clean_student_id).ok();
    let users_coll = db.collection::<mongodb::bson::Document>("users");
    let students_coll = db.collection::<mongodb::bson::Document>("students");

    let student_doc = match student_oid_opt {
        Some(oid) => match users_coll.find_one(doc! { "_id": oid }, None).await {
            Ok(Some(d)) => Some(d),
            _ => students_coll.find_one(doc! { "_id": oid }, None).await.ok().flatten(),
        },
        None => match users_coll.find_one(doc! {
            "$or": [
                doc! { "_id": clean_student_id },
                doc! { "id": clean_student_id },
                doc! { "username": clean_student_id },
                doc! { "enrollment_number": clean_student_id }
            ]
        }, None).await {
            Ok(Some(d)) => Some(d),
            _ => students_coll.find_one(doc! {
                "$or": [
                    doc! { "_id": clean_student_id },
                    doc! { "id": clean_student_id },
                    doc! { "username": clean_student_id },
                    doc! { "enrollment_no": clean_student_id }
                ]
            }, None).await.ok().flatten(),
        },
    };

    let s_oid = student_doc.as_ref().and_then(|d| d.get_object_id("_id").ok()).unwrap_or_else(|| student_oid_opt.unwrap_or_else(ObjectId::new));
    let s_name = student_doc.as_ref()
        .and_then(|d| d.get_str("full_name").or_else(|_| d.get_str("fullName")).or_else(|_| d.get_str("name")).ok())
        .unwrap_or("Student")
        .to_string();

    let s_user = student_doc.as_ref()
        .and_then(|d| d.get_str("username").or_else(|_| d.get_str("enrollment_number")).or_else(|_| d.get_str("enrollment_no")).ok())
        .unwrap_or(clean_student_id)
        .to_string();

    let center_oid = student_doc.as_ref().and_then(|d| d.get_object_id("center_id").or_else(|_| d.get_object_id("parent_id")).ok());

    let now_dt = chrono::Utc::now();
    let due_days = payload.due_days.unwrap_or(14);
    let due_dt = now_dt + Duration::days(due_days);

    let issue_date_dt = if let Some(ref d_str) = payload.issue_date {
        DateTime::parse_rfc3339_str(d_str).unwrap_or_else(|_| DateTime::from_chrono(now_dt))
    } else {
        DateTime::from_chrono(now_dt)
    };

    let due_date_dt = if let Some(ref d_str) = payload.due_date {
        DateTime::parse_rfc3339_str(d_str).unwrap_or_else(|_| DateTime::from_chrono(due_dt))
    } else {
        DateTime::from_chrono(due_dt)
    };

    let student_photo = payload.student_photo_url.or_else(|| {
        student_doc.as_ref().and_then(|d| d.get_str("profile_image").or_else(|_| d.get_str("avatar")).ok().map(|s| s.to_string()))
    });

    let issue_rec = BookIssueRecord {
        id: None,
        book_id: book_oid,
        book_title: book_title.clone(),
        student_id: s_oid,
        student_name: s_name,
        student_username: s_user,
        center_id: center_oid,
        issue_date: issue_date_dt,
        due_date: due_date_dt,
        return_date: None,
        status: "Issued".to_string(),
        fine_amount: None,
        initial_condition: payload.initial_condition.or_else(|| Some("Good Condition".to_string())),
        condition_on_return: None,
        doc_verified: payload.doc_verified.or(Some(true)),
        student_photo_url: student_photo,
        issue_doc_url: payload.issue_doc_url,
        student_rating: None,
        student_feedback: None,
        remarks: payload.remarks,
        created_at: Some(DateTime::now()),
        updated_at: Some(DateTime::now()),
    };

    let issues_coll = db.collection::<BookIssueRecord>("book_issues");
    match issues_coll.insert_one(issue_rec, None).await {
        Ok(res) => {
            if is_physical {
                let _ = books_coll.update_one(
                    doc! { "_id": book_oid, "available_copies": { "$gt": 0 } },
                    doc! { "$inc": { "available_copies": -1 } },
                    None,
                ).await;
            }

            if let Some(res_id) = payload.reservation_id {
                let res_coll = db.collection::<crate::models::library::BookReservation>("book_reservations");
                let res_oid = ObjectId::parse_str(&res_id).ok();
                let res_filter = match res_oid {
                    Some(oid) => doc! { "$or": [ doc! { "_id": oid }, doc! { "_id": &res_id }, doc! { "id": &res_id } ] },
                    None => doc! { "$or": [ doc! { "_id": &res_id }, doc! { "id": &res_id } ] },
                };
                let _ = res_coll.update_one(res_filter, doc! { "$set": { "status": "Fulfilled" } }, None).await;
            }

            (
                StatusCode::CREATED,
                Json(LibraryResponse {
                    success: true,
                    data: Some(res.inserted_id.to_string()),
                    message: Some("Book issued successfully to student".to_string()),
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

// GET /api/library/issued (List issued books for admin/center)
pub async fn list_issued_books(
    State(db): State<Database>,
    Query(filter): Query<IssueFilter>,
) -> impl IntoResponse {
    let coll = db.collection::<BookIssueRecord>("book_issues");
    let mut query_doc = doc! {};

    if let Some(st) = filter.status {
        if !st.is_empty() && st != "all" {
            query_doc.insert("status", st);
        }
    }

    if let Some(s_id) = filter.student_id {
        if let Ok(oid) = ObjectId::parse_str(&s_id) {
            query_doc.insert("student_id", oid);
        }
    }

    if let Some(c_id) = filter.center_id {
        if let Ok(oid) = ObjectId::parse_str(&c_id) {
            query_doc.insert("center_id", oid);
        }
    }

    let now_dt = chrono::Utc::now();

    match coll.find(query_doc, None).await {
        Ok(mut cursor) => {
            let mut records = Vec::new();
            while let Some(Ok(mut rec)) = cursor.next().await {
                // Auto-mark overdue if past due_date and return_date is None
                if rec.status == "Issued" {
                    let due_chrono = rec.due_date.to_chrono();
                    if now_dt > due_chrono {
                        rec.status = "Overdue".to_string();
                    }
                }
                records.push(rec);
            }
            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(records),
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

// PUT /api/library/issued/:id/return (Mark book as returned)
pub async fn return_book(
    State(db): State<Database>,
    Path(id): Path<String>,
    Json(payload): Json<ReturnBookPayload>,
) -> impl IntoResponse {
    let coll = db.collection::<BookIssueRecord>("book_issues");
    let issue_oid = ObjectId::parse_str(&id).unwrap_or_else(|_| ObjectId::new());

    let filter = doc! {
        "$or": [
            doc! { "_id": issue_oid },
            doc! { "_id": &id },
            doc! { "id": &id }
        ]
    };

    let existing = match coll.find_one(filter.clone(), None).await {
        Ok(Some(rec)) => rec,
        _ => {
            return (
                StatusCode::NOT_FOUND,
                Json(LibraryResponse {
                    success: false,
                    data: None,
                    message: Some("Issue record not found".to_string()),
                }),
            );
        }
    };

    let update = doc! {
        "$set": {
            "status": "Returned",
            "return_date": DateTime::now(),
            "fine_amount": payload.fine_amount.unwrap_or(0.0),
            "condition_on_return": payload.condition_on_return.unwrap_or_else(|| "Good Condition".to_string()),
            "student_rating": payload.student_rating.unwrap_or(5),
            "student_feedback": payload.student_feedback,
            "remarks": payload.remarks,
            "updated_at": DateTime::now()
        }
    };

    match coll.update_one(filter, update, None).await {
        Ok(_) => {
            let books_coll = db.collection::<Book>("library_books");
            if payload.mark_as_damaged.unwrap_or(false) {
                let _ = books_coll.update_one(
                    doc! { "_id": existing.book_id },
                    doc! { 
                        "$inc": { "damaged_copies": 1 },
                        "$set": { "procurement_needed": true }
                    },
                    None,
                ).await;
            } else {
                let _ = books_coll.update_one(
                    doc! { "_id": existing.book_id },
                    doc! { "$inc": { "available_copies": 1 } },
                    None,
                ).await;
            }

            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(id),
                    message: Some("Book marked as returned successfully".to_string()),
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

// POST /api/library/reserve (Reserve a book)
pub async fn reserve_book(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<crate::models::library::BookReservationPayload>,
) -> impl IntoResponse {
    let target_student_str = payload.student_id.as_deref().unwrap_or(&claims.sub);
    let student_oid = ObjectId::parse_str(target_student_str).unwrap_or_else(|_| ObjectId::new());
    let book_oid = ObjectId::parse_str(&payload.book_id).unwrap_or_else(|_| ObjectId::new());

    let books_coll = db.collection::<Book>("library_books");
    let book_doc = match books_coll.find_one(doc! { "_id": book_oid }, None).await {
        Ok(Some(b)) => Some(b),
        _ => {
            let filter = doc! { "$or": [ doc! { "_id": &payload.book_id }, doc! { "id": &payload.book_id } ] };
            books_coll.find_one(filter, None).await.ok().flatten()
        }
    };

    let book_title = match book_doc {
        Some(ref b) => b.title.clone(),
        None => if !payload.book_id.is_empty() { payload.book_id.clone() } else { "Library Book".to_string() },
    };

    let users_coll = db.collection::<mongodb::bson::Document>("users");
    let students_coll = db.collection::<mongodb::bson::Document>("students");

    let student_doc = match users_coll.find_one(doc! { "_id": student_oid }, None).await {
        Ok(Some(d)) => Some(d),
        _ => match users_coll.find_one(doc! {
            "$or": [
                doc! { "_id": target_student_str },
                doc! { "id": target_student_str },
                doc! { "username": target_student_str }
            ]
        }, None).await {
            Ok(Some(d)) => Some(d),
            _ => match students_coll.find_one(doc! { "_id": student_oid }, None).await {
                Ok(Some(d)) => Some(d),
                _ => students_coll.find_one(doc! {
                    "$or": [
                        doc! { "_id": target_student_str },
                        doc! { "id": target_student_str },
                        doc! { "username": target_student_str },
                        doc! { "enrollment_no": target_student_str }
                    ]
                }, None).await.ok().flatten(),
            },
        },
    };

    let s_name = student_doc.as_ref()
        .and_then(|d| d.get_str("full_name").or_else(|_| d.get_str("fullName")).or_else(|_| d.get_str("name")).ok())
        .unwrap_or("Student")
        .to_string();

    let s_user = student_doc.as_ref()
        .and_then(|d| d.get_str("username").or_else(|_| d.get_str("enrollment_no")).ok())
        .unwrap_or_else(|| if !target_student_str.is_empty() { target_student_str } else { "student" })
        .to_string();

    let center_oid = student_doc.as_ref().and_then(|d| d.get_object_id("center_id").or_else(|_| d.get_object_id("parent_id")).ok());

    let reservation = crate::models::library::BookReservation {
        id: None,
        book_id: book_oid,
        book_title,
        student_id: student_oid,
        student_name: s_name,
        student_username: s_user,
        center_id: center_oid,
        reserved_at: DateTime::now(),
        status: "Pending".to_string(),
    };

    let res_coll = db.collection::<crate::models::library::BookReservation>("book_reservations");
    match res_coll.insert_one(reservation, None).await {
        Ok(res) => (
            StatusCode::CREATED,
            Json(LibraryResponse {
                success: true,
                data: Some(res.inserted_id.to_string()),
                message: Some("Book reserved successfully. You are in the queue for next issue!".to_string()),
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

// GET /api/library/reservations (List pending reservations)
pub async fn list_reservations(
    State(db): State<Database>,
) -> impl IntoResponse {
    let coll = db.collection::<crate::models::library::BookReservation>("book_reservations");
    match coll.find(doc! { "status": "Pending" }, None).await {
        Ok(mut cursor) => {
            let mut list = Vec::new();
            while let Some(Ok(rec)) = cursor.next().await {
                list.push(rec);
            }
            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(list),
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

// PUT /api/library/reservations/:id/cancel
pub async fn cancel_reservation(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let coll = db.collection::<crate::models::library::BookReservation>("book_reservations");
    let res_oid = ObjectId::parse_str(&id).unwrap_or_else(|_| ObjectId::new());
    let filter = doc! { "$or": [ doc! { "_id": res_oid }, doc! { "_id": &id }, doc! { "id": &id } ] };

    match coll.update_one(filter, doc! { "$set": { "status": "Cancelled" } }, None).await {
        Ok(res) if res.matched_count > 0 => (
            StatusCode::OK,
            Json(LibraryResponse {
                success: true,
                data: Some(id),
                message: Some("Reservation cancelled successfully".to_string()),
            }),
        ),
        _ => (
            StatusCode::NOT_FOUND,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some("Reservation not found".to_string()),
            }),
        ),
    }
}

// PUT /api/library/reservations/:id/fulfill
pub async fn fulfill_reservation(
    State(db): State<Database>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let coll = db.collection::<crate::models::library::BookReservation>("book_reservations");
    let res_oid = ObjectId::parse_str(&id).unwrap_or_else(|_| ObjectId::new());
    let filter = doc! { "$or": [ doc! { "_id": res_oid }, doc! { "_id": &id }, doc! { "id": &id } ] };

    match coll.update_one(filter, doc! { "$set": { "status": "Fulfilled" } }, None).await {
        Ok(res) if res.matched_count > 0 => (
            StatusCode::OK,
            Json(LibraryResponse {
                success: true,
                data: Some(id),
                message: Some("Reservation fulfilled successfully".to_string()),
            }),
        ),
        _ => (
            StatusCode::NOT_FOUND,
            Json(LibraryResponse {
                success: false,
                data: None,
                message: Some("Reservation not found".to_string()),
            }),
        ),
    }
}

// GET /api/library/analytics (Popular books, issue counts, fine revenue, damaged audit, procurement)
pub async fn get_library_analytics(
    State(db): State<Database>,
) -> impl IntoResponse {
    let issues_coll = db.collection::<BookIssueRecord>("book_issues");
    let books_coll = db.collection::<Book>("library_books");

    let mut total_issued = 0;
    let mut total_overdue = 0;
    let mut total_returned = 0;
    let mut total_fines = 0.0;
    let mut book_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut unique_students: std::collections::HashSet<String> = std::collections::HashSet::new();

    if let Ok(mut cursor) = issues_coll.find(doc! {}, None).await {
        while let Some(Ok(rec)) = cursor.next().await {
            match rec.status.as_str() {
                "Issued" => total_issued += 1,
                "Overdue" => total_overdue += 1,
                "Returned" => total_returned += 1,
                _ => {}
            }
            if let Some(fine) = rec.fine_amount {
                total_fines += fine;
            }
            unique_students.insert(rec.student_id.to_string());
            *book_counts.entry(rec.book_title).or_insert(0) += 1;
        }
    }

    let mut total_damaged_copies: i32 = 0;
    let mut procurement_needed_count: usize = 0;

    if let Ok(mut cursor) = books_coll.find(doc! {}, None).await {
        while let Some(Ok(b)) = cursor.next().await {
            if let Some(d) = b.damaged_copies {
                total_damaged_copies += d;
            }
            if b.procurement_needed.unwrap_or(false) || (b.available_copies.unwrap_or(0) == 0 && b.is_physical.unwrap_or(false)) {
                procurement_needed_count += 1;
            }
        }
    }

    let mut popular_books: Vec<(String, usize)> = book_counts.into_iter().collect();
    popular_books.sort_by(|a, b| b.1.cmp(&a.1));
    popular_books.truncate(10);

    #[derive(Serialize)]
    struct PopularBookItem {
        title: String,
        count: usize,
    }

    let popular_items: Vec<PopularBookItem> = popular_books
        .into_iter()
        .map(|(title, count)| PopularBookItem { title, count })
        .collect();

    #[derive(Serialize)]
    struct AnalyticsResult {
        pub total_issued: usize,
        pub total_overdue: usize,
        pub total_returned: usize,
        pub total_fines: f64,
        pub total_damaged_copies: i32,
        pub procurement_needed_count: usize,
        pub total_unique_borrowers: usize,
        pub popular_books: Vec<PopularBookItem>,
    }

    (
        StatusCode::OK,
        Json(LibraryResponse {
            success: true,
            data: Some(AnalyticsResult {
                total_issued,
                total_overdue,
                total_returned,
                total_fines,
                total_damaged_copies,
                procurement_needed_count,
                total_unique_borrowers: unique_students.len(),
                popular_books: popular_items,
            }),
            message: None,
        }),
    )
}

// GET /api/library/my-issued (For logged-in student)
pub async fn get_my_issued_books(
    State(db): State<Database>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let student_oid = match ObjectId::parse_str(&claims.sub) {
        Ok(o) => o,
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

    let coll = db.collection::<BookIssueRecord>("book_issues");
    let now_dt = chrono::Utc::now();

    match coll.find(doc! { "student_id": student_oid }, None).await {
        Ok(mut cursor) => {
            let mut records = Vec::new();
            while let Some(Ok(mut rec)) = cursor.next().await {
                if rec.status == "Issued" && now_dt > rec.due_date.to_chrono() {
                    rec.status = "Overdue".to_string();
                }
                records.push(rec);
            }
            (
                StatusCode::OK,
                Json(LibraryResponse {
                    success: true,
                    data: Some(records),
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

