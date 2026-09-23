// //! Backend eligibility checks for exam allotment, reappear, and marks entry.
// use chrono::{NaiveDate, Utc};
// use chrono_tz::Asia::Kolkata;
// use futures_util::StreamExt;
// use mongodb::{
//     bson::{doc, oid::ObjectId, Document},
//     Database,
// };
// use crate::models::exam_workflow::CourseExamAttempt;
// use crate::models::user::User;

// pub fn is_online_exam_mode(exam_mode: &Option<String>) -> bool {
//     match exam_mode.as_deref() {
//         Some(m) => {
//             let lower = m.to_lowercase();
//             lower.contains("online") || lower.contains("cbt") || lower == "computer based test (cbt)"
//         }
//         None => false,
//     }
// }

// pub fn is_course_end_passed(session_end_date: &Option<String>) -> bool {
//     let Some(raw) = session_end_date.as_ref() else {
//         return false;
//     };
//     let trimmed = raw.trim();
//     if trimmed.is_empty() {
//         return false;
//     }
//     let today_ist = Utc::now().with_timezone(&Kolkata).date_naive();
//     if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
//         return d <= today_ist;
//     }
//     if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(trimmed) {
//         return dt.with_timezone(&Kolkata).date_naive() <= today_ist;
//     }
//     false
// }

// pub fn student_belongs_to_course(student: &User, course_id: &ObjectId, course_name: Option<&str>) -> bool {
//     if student.course_id.as_ref() == Some(course_id) {
//         return true;
//     }
//     if let (Some(cn), Some(sc)) = (course_name, student.course.as_deref()) {
//         return cn.eq_ignore_ascii_case(sc);
//     }
//     false
// }

// pub fn is_student_active_eligible(student: &User) -> bool {
//     if !student.active || student.is_deleted {
//         return false;
//     }
//     match student.approval_status.as_deref() {
//         Some(s) => s.eq_ignore_ascii_case("approved"),
//         None => true,
//     }
// }

// /// Whether student has any allotted exam papers for course subjects.
// pub async fn has_exam_allotment_for_course(
//     db: &Database,
//     student_id: &ObjectId,
//     subject_ids: &[ObjectId],
// ) -> bool {
//     if subject_ids.is_empty() {
//         return false;
//     }
//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// /// Whether student already has an active or completed allotment for course subjects.
// pub async fn has_existing_allotment_for_course(
//     db: &Database,
//     student_id: &ObjectId,
//     subject_ids: &[ObjectId],
// ) -> bool {
//     if subject_ids.is_empty() {
//         return false;
//     }
//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//                 "status": { "$in": ["Generated", "InProgress", "Submitted", "Evaluated", "submitted", "evaluated"] }
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// /// Whether student was allotted papers for a specific attempt number.
// pub async fn has_allotment_for_attempt(
//     db: &Database,
//     student_id: &ObjectId,
//     subject_ids: &[ObjectId],
//     attempt_number: i32,
// ) -> bool {
//     if subject_ids.is_empty() {
//         return false;
//     }
//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//                 "attempt_number": attempt_number,
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// pub async fn max_course_attempt_number(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> i32 {
//     latest_course_attempt(db, student_id, course_id)
//         .await
//         .map(|a| a.attempt_number)
//         .unwrap_or(1)
// }

// pub async fn latest_submitted_course_attempt(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> Option<CourseExamAttempt> {
//     let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
//     let mut cursor = coll
//         .find(
//             doc! {
//                 "student_id": student_id,
//                 "course_id": course_id,
//                 "marks_submitted": true,
//             },
//             mongodb::options::FindOptions::builder()
//                 .sort(doc! { "attempt_number": -1 })
//                 .limit(1)
//                 .build(),
//         )
//         .await
//         .ok()?;
//     if let Some(Ok(a)) = cursor.next().await {
//         return Some(a);
//     }
//     None
// }

// /// Latest course exam attempt for a student, if any.
// pub async fn latest_course_attempt(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> Option<CourseExamAttempt> {
//     let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
//     let mut cursor = coll
//         .find(
//             doc! { "student_id": student_id, "course_id": course_id },
//             mongodb::options::FindOptions::builder()
//                 .sort(doc! { "attempt_number": -1 })
//                 .limit(1)
//                 .build(),
//         )
//         .await
//         .ok()?;
//     if let Some(Ok(a)) = cursor.next().await {
//         return Some(a);
//     }
//     None
// }

// /// Whether student has ever appeared in any course examination (papers started/submitted or attempt.appeared).
// pub async fn has_appeared_for_course(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
//     subject_ids: &[ObjectId],
// ) -> bool {
//     if let Some(latest) = latest_course_attempt(db, student_id, course_id).await {
//         if latest.appeared {
//             return true;
//         }
//     }

//     if subject_ids.is_empty() {
//         return false;
//     }

//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//                 "status": { "$in": ["InProgress", "Submitted", "Evaluated", "submitted", "evaluated"] }
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// /// Overall course result failed on the latest submitted attempt.
// pub async fn has_failed_overall_course(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> bool {
//     let Some(latest) = latest_course_attempt(db, student_id, course_id).await else {
//         return false;
//     };
//     latest.marks_submitted
//         && latest
//             .overall_result
//             .as_deref()
//             .map(|r| r.eq_ignore_ascii_case("fail"))
//             .unwrap_or(false)
// }

// /// Center has allowed reappear on the latest failed attempt.
// pub async fn is_reappear_approved(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> bool {
//     let Some(latest) = latest_course_attempt(db, student_id, course_id).await else {
//         return false;
//     };
//     latest.allow_reappear
//         && !latest.marks_submitted
//         && latest.attempt_number > 1
// }

// pub struct EligibilityResult {
//     pub eligible: bool,
//     pub reason: Option<String>,
// }

// /// First-attempt allotment eligibility (toggle OFF).
// pub async fn check_first_attempt_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
//     subject_ids: &[ObjectId],
// ) -> EligibilityResult {
//     if !student_belongs_to_course(student, course_id, course_name) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student does not belong to selected course".into()),
//         };
//     }
//     if !is_course_end_passed(&student.session_end_date) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Course not completed or end date has not passed".into()),
//         };
//     }
//     let sid = student.id.unwrap();
//     if has_appeared_for_course(db, &sid, course_id, subject_ids).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student has already appeared for this course examination".into()),
//         };
//     }
//     if has_existing_allotment_for_course(db, &sid, subject_ids).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student already has exam allotment for this course".into()),
//         };
//     }
//     if let Some(latest) = latest_course_attempt(db, &sid, course_id).await {
//         if latest.marks_submitted || latest.appeared {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Student has already appeared for this course examination".into()),
//             };
//         }
//     }
//     if !is_student_active_eligible(student) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student is not active or not approved".into()),
//         };
//     }
//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Reappear allotment eligibility (toggle ON).
// pub async fn check_reappear_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
//     _subject_ids: &[ObjectId],
// ) -> EligibilityResult {
//     let sid = match student.id {
//         Some(id) => id,
//         None => {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Invalid student".into()),
//             }
//         }
//     };

//     if !student_belongs_to_course(student, course_id, course_name) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student does not belong to selected course".into()),
//         };
//     }
//     if !is_course_end_passed(&student.session_end_date) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Course not completed or end date has not passed".into()),
//         };
//     }
//     let latest_submitted = latest_submitted_course_attempt(db, &sid, course_id).await;
//     let prev_attempt_no = latest_submitted
//         .as_ref()
//         .map(|a| a.attempt_number)
//         .unwrap_or(0);
//     let had_previous_allotment = if prev_attempt_no > 0 {
//         has_allotment_for_attempt(db, &sid, _subject_ids, prev_attempt_no).await
//     } else {
//         false
//     };
//     if !has_appeared_for_course(db, &sid, course_id, _subject_ids).await && !had_previous_allotment {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student has never appeared for this course examination".into()),
//         };
//     }
//     if !has_failed_overall_course(db, &sid, course_id).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student has not failed overall course result".into()),
//         };
//     }
//     if !is_reappear_approved(db, &sid, course_id).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Reappear not approved by center for current attempt".into()),
//         };
//     }
//     if !is_student_active_eligible(student) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student is not active or not approved".into()),
//         };
//     }

//     // No active generated/in-progress papers for this course reappear cycle
//     let paper_coll = db.collection::<Document>("student_papers");
//     let active = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": sid,
//                 "subject_id": { "$in": _subject_ids },
//                 "status": { "$in": ["Generated", "InProgress"] }
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     if active > 0 {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student already has an active allotted exam for this course".into()),
//         };
//     }

//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Marks entry list eligibility — student stays visible after marks submission.
// pub async fn check_marks_entry_list_visibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
// ) -> EligibilityResult {
//     if !student_belongs_to_course(student, course_id, course_name) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student does not belong to course".into()),
//         };
//     }
//     if !is_course_end_passed(&student.session_end_date) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Course not completed or end date has not passed".into()),
//         };
//     }
//     if !is_student_active_eligible(student) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student not active".into()),
//         };
//     }

//     let sid = match student.id {
//         Some(id) => id,
//         None => {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Invalid student".into()),
//             };
//         }
//     };

//     let subject_ids = {
//         let coll = db.collection::<Document>("course_subjects");
//         let mut ids = Vec::new();
//         if let Ok(mut cursor) = coll.find(doc! { "course_id": course_id }, None).await {
//             while let Some(Ok(d)) = cursor.next().await {
//                 if let Ok(oid) = d.get_object_id("subject_id") {
//                     ids.push(oid);
//                 }
//             }
//         }
//         ids
//     };

//     if !has_exam_allotment_for_course(db, &sid, &subject_ids).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("No exam allotment found for this student".into()),
//         };
//     }

//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Marks entry submit eligibility — can enter/edit marks now.
// pub async fn check_marks_entry_submit_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
//     attempt_number: i32,
// ) -> EligibilityResult {
//     let base = check_marks_entry_list_visibility(db, student, course_id, course_name).await;
//     if !base.eligible {
//         return base;
//     }

//     let sid = student.id.unwrap();
//     let current_attempt = max_course_attempt_number(db, &sid, course_id).await;
//     if attempt_number > current_attempt {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Invalid attempt number".into()),
//         };
//     }

//     let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
//     let attempt = coll
//         .find_one(
//             doc! {
//                 "student_id": sid,
//                 "course_id": course_id,
//                 "attempt_number": attempt_number
//             },
//             None,
//         )
//         .await
//         .ok()
//         .flatten();

//     let edit_unlocked = attempt.as_ref().map(|a| a.marks_edit_unlocked).unwrap_or(false);

//     if attempt_number < current_attempt && !edit_unlocked {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Previous attempts are read-only".into()),
//         };
//     }

//     if attempt_number > 1 {
//         let allow = attempt.as_ref().map(|a| a.allow_reappear).unwrap_or(false);
//         if !allow && !edit_unlocked {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Reappear not approved by center for current attempt".into()),
//             };
//         }
//     }

//     if let Some(a) = attempt {
//         if a.marks_submitted && !a.marks_edit_unlocked {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Marks locked — request changes from admin".into()),
//             };
//         }
//     }

//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Legacy alias used by bulk allot — kept for compatibility.
// pub async fn check_marks_entry_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
// ) -> EligibilityResult {
//     check_marks_entry_list_visibility(db, student, course_id, course_name).await
// }
//! Backend eligibility checks for exam allotment, reappear, and marks entry.
// use chrono::{NaiveDate, Utc};
// use chrono_tz::Asia::Kolkata;
// use futures_util::StreamExt;
// use mongodb::{
//     bson::{doc, oid::ObjectId, Document},
//     Database,
// };
// use crate::models::exam_workflow::CourseExamAttempt;
// use crate::models::user::User;

// pub fn is_online_exam_mode(exam_mode: &Option<String>) -> bool {
//     match exam_mode.as_deref() {
//         Some(m) => {
//             let lower = m.to_lowercase();
//             lower.contains("online") || lower.contains("cbt") || lower == "computer based test (cbt)"
//         }
//         None => false,
//     }
// }

// /// Whether the student's course session has ended (or no end date restriction applies).
// ///
// /// FIX: Previously, a missing/empty/unparseable `session_end_date` returned `false`,
// /// silently blocking students without that field from ever being eligible — even
// /// though the frontend's own `filteredStudents` logic already treats a missing
// /// `session_end_date` as "not blocked" (AdminExamAllotPage.tsx:
// /// `if (!s.session_end_date) return true;`). This caused "N in course / 0 eligible"
// /// whenever `session_end_date` was not populated on student records.
// ///
// /// New behavior: missing/empty/unparseable `session_end_date` is treated as
// /// "no completion restriction" -> passed (true), matching frontend behavior.
// /// If you want to strictly REQUIRE session_end_date before allotment, populate
// /// it reliably at student creation/import time instead of reverting this.
// pub fn is_course_end_passed(session_end_date: &Option<String>) -> bool {
//     let Some(raw) = session_end_date.as_ref() else {
//         return true; // no end date set -> don't block eligibility
//     };
//     let trimmed = raw.trim();
//     if trimmed.is_empty() {
//         return true; // empty string -> don't block eligibility
//     }
//     let today_ist = Utc::now().with_timezone(&Kolkata).date_naive();
//     if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
//         return d <= today_ist;
//     }
//     if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(trimmed) {
//         return dt.with_timezone(&Kolkata).date_naive() <= today_ist;
//     }
//     // Unparseable format -> don't silently block eligibility over a bad date string.
//     true
// }

// pub fn student_belongs_to_course(student: &User, course_id: &ObjectId, course_name: Option<&str>) -> bool {
//     if student.course_id.as_ref() == Some(course_id) {
//         return true;
//     }
//     if let (Some(cn), Some(sc)) = (course_name, student.course.as_deref()) {
//         return cn.eq_ignore_ascii_case(sc);
//     }
//     false
// }

// pub fn is_student_active_eligible(student: &User) -> bool {
//     if !student.active || student.is_deleted {
//         return false;
//     }
//     match student.approval_status.as_deref() {
//         Some(s) => s.eq_ignore_ascii_case("approved"),
//         None => true,
//     }
// }

// /// Whether student has any allotted exam papers for course subjects.
// pub async fn has_exam_allotment_for_course(
//     db: &Database,
//     student_id: &ObjectId,
//     subject_ids: &[ObjectId],
// ) -> bool {
//     if subject_ids.is_empty() {
//         return false;
//     }
//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// /// Whether student already has an active or completed allotment for course subjects.
// pub async fn has_existing_allotment_for_course(
//     db: &Database,
//     student_id: &ObjectId,
//     subject_ids: &[ObjectId],
// ) -> bool {
//     if subject_ids.is_empty() {
//         return false;
//     }
//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//                 "status": { "$in": ["Generated", "InProgress", "Submitted", "Evaluated", "submitted", "evaluated"] }
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// /// Whether student was allotted papers for a specific attempt number.
// pub async fn has_allotment_for_attempt(
//     db: &Database,
//     student_id: &ObjectId,
//     subject_ids: &[ObjectId],
//     attempt_number: i32,
// ) -> bool {
//     if subject_ids.is_empty() {
//         return false;
//     }
//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//                 "attempt_number": attempt_number,
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// pub async fn max_course_attempt_number(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> i32 {
//     latest_course_attempt(db, student_id, course_id)
//         .await
//         .map(|a| a.attempt_number)
//         .unwrap_or(1)
// }

// pub async fn latest_submitted_course_attempt(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> Option<CourseExamAttempt> {
//     let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
//     let mut cursor = coll
//         .find(
//             doc! {
//                 "student_id": student_id,
//                 "course_id": course_id,
//                 "marks_submitted": true,
//             },
//             mongodb::options::FindOptions::builder()
//                 .sort(doc! { "attempt_number": -1 })
//                 .limit(1)
//                 .build(),
//         )
//         .await
//         .ok()?;
//     if let Some(Ok(a)) = cursor.next().await {
//         return Some(a);
//     }
//     None
// }

// /// Latest course exam attempt for a student, if any.
// pub async fn latest_course_attempt(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> Option<CourseExamAttempt> {
//     let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
//     let mut cursor = coll
//         .find(
//             doc! { "student_id": student_id, "course_id": course_id },
//             mongodb::options::FindOptions::builder()
//                 .sort(doc! { "attempt_number": -1 })
//                 .limit(1)
//                 .build(),
//         )
//         .await
//         .ok()?;
//     if let Some(Ok(a)) = cursor.next().await {
//         return Some(a);
//     }
//     None
// }

// /// Whether student has ever appeared in any course examination (papers started/submitted or attempt.appeared).
// pub async fn has_appeared_for_course(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
//     subject_ids: &[ObjectId],
// ) -> bool {
//     if let Some(latest) = latest_course_attempt(db, student_id, course_id).await {
//         if latest.appeared {
//             return true;
//         }
//     }

//     if subject_ids.is_empty() {
//         return false;
//     }

//     let paper_coll = db.collection::<Document>("student_papers");
//     let count = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": student_id,
//                 "subject_id": { "$in": subject_ids },
//                 "status": { "$in": ["InProgress", "Submitted", "Evaluated", "submitted", "evaluated"] }
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     count > 0
// }

// /// Overall course result failed on the latest submitted attempt.
// pub async fn has_failed_overall_course(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> bool {
//     let Some(latest) = latest_course_attempt(db, student_id, course_id).await else {
//         return false;
//     };
//     latest.marks_submitted
//         && latest
//             .overall_result
//             .as_deref()
//             .map(|r| r.eq_ignore_ascii_case("fail"))
//             .unwrap_or(false)
// }

// /// Center has allowed reappear on the latest failed attempt.
// ///
// /// FIX: Previously required `!latest.marks_submitted && latest.attempt_number > 1`,
// /// in addition to `allow_reappear`. But the center approves reappear ON the attempt
// /// the student just failed — which by definition already has `marks_submitted = true`,
// /// and for a student failing their FIRST attempt, `attempt_number == 1` (not > 1).
// /// That combination made this function return `false` for essentially every normal
// /// "student failed attempt 1, center approved reappear" case — the most common
// /// reappear scenario — which is why reappear allotment showed 0 eligible students
// /// even after the center approved it.
// ///
// /// Now: eligibility only requires that the latest attempt was submitted (i.e. it's
// /// a real completed attempt, not an in-progress one) and that the center flagged
// /// `allow_reappear` on it. `has_failed_overall_course` (checked separately in
// /// `check_reappear_eligibility`) already ensures the result was a fail.
// pub async fn is_reappear_approved(
//     db: &Database,
//     student_id: &ObjectId,
//     course_id: &ObjectId,
// ) -> bool {
//     let Some(latest) = latest_course_attempt(db, student_id, course_id).await else {
//         return false;
//     };
//     latest.marks_submitted && latest.allow_reappear
// }

// pub struct EligibilityResult {
//     pub eligible: bool,
//     pub reason: Option<String>,
// }

// /// First-attempt allotment eligibility (toggle OFF).
// pub async fn check_first_attempt_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
//     subject_ids: &[ObjectId],
// ) -> EligibilityResult {
//     if !student_belongs_to_course(student, course_id, course_name) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student does not belong to selected course".into()),
//         };
//     }
//     if !is_course_end_passed(&student.session_end_date) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Course not completed or end date has not passed".into()),
//         };
//     }
//     let sid = student.id.unwrap();
//     if has_appeared_for_course(db, &sid, course_id, subject_ids).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student has already appeared for this course examination".into()),
//         };
//     }
//     if has_existing_allotment_for_course(db, &sid, subject_ids).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student already has exam allotment for this course".into()),
//         };
//     }
//     if let Some(latest) = latest_course_attempt(db, &sid, course_id).await {
//         if latest.marks_submitted || latest.appeared {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Student has already appeared for this course examination".into()),
//             };
//         }
//     }
//     if !is_student_active_eligible(student) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student is not active or not approved".into()),
//         };
//     }
//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Reappear allotment eligibility (toggle ON).
// pub async fn check_reappear_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
//     _subject_ids: &[ObjectId],
// ) -> EligibilityResult {
//     let sid = match student.id {
//         Some(id) => id,
//         None => {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Invalid student".into()),
//             }
//         }
//     };

//     if !student_belongs_to_course(student, course_id, course_name) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student does not belong to selected course".into()),
//         };
//     }
//     if !is_course_end_passed(&student.session_end_date) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Course not completed or end date has not passed".into()),
//         };
//     }
//     let latest_submitted = latest_submitted_course_attempt(db, &sid, course_id).await;
//     let prev_attempt_no = latest_submitted
//         .as_ref()
//         .map(|a| a.attempt_number)
//         .unwrap_or(0);
//     let had_previous_allotment = if prev_attempt_no > 0 {
//         has_allotment_for_attempt(db, &sid, _subject_ids, prev_attempt_no).await
//     } else {
//         false
//     };
//     if !has_appeared_for_course(db, &sid, course_id, _subject_ids).await && !had_previous_allotment {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student has never appeared for this course examination".into()),
//         };
//     }
//     if !has_failed_overall_course(db, &sid, course_id).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student has not failed overall course result".into()),
//         };
//     }
//     if !is_reappear_approved(db, &sid, course_id).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Reappear not approved by center for current attempt".into()),
//         };
//     }
//     if !is_student_active_eligible(student) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student is not active or not approved".into()),
//         };
//     }

//     // No active generated/in-progress papers for this course reappear cycle
//     let paper_coll = db.collection::<Document>("student_papers");
//     let active = paper_coll
//         .count_documents(
//             doc! {
//                 "student_id": sid,
//                 "subject_id": { "$in": _subject_ids },
//                 "status": { "$in": ["Generated", "InProgress"] }
//             },
//             None,
//         )
//         .await
//         .unwrap_or(0);
//     if active > 0 {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student already has an active allotted exam for this course".into()),
//         };
//     }

//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Marks entry list eligibility — student stays visible after marks submission.
// pub async fn check_marks_entry_list_visibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
// ) -> EligibilityResult {
//     if !student_belongs_to_course(student, course_id, course_name) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student does not belong to course".into()),
//         };
//     }
//     if !is_course_end_passed(&student.session_end_date) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Course not completed or end date has not passed".into()),
//         };
//     }
//     if !is_student_active_eligible(student) {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Student not active".into()),
//         };
//     }

//     let sid = match student.id {
//         Some(id) => id,
//         None => {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Invalid student".into()),
//             };
//         }
//     };

//     let subject_ids = {
//         let coll = db.collection::<Document>("course_subjects");
//         let mut ids = Vec::new();
//         if let Ok(mut cursor) = coll.find(doc! { "course_id": course_id }, None).await {
//             while let Some(Ok(d)) = cursor.next().await {
//                 if let Ok(oid) = d.get_object_id("subject_id") {
//                     ids.push(oid);
//                 }
//             }
//         }
//         ids
//     };

//     if !has_exam_allotment_for_course(db, &sid, &subject_ids).await {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("No exam allotment found for this student".into()),
//         };
//     }

//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Marks entry submit eligibility — can enter/edit marks now.
// pub async fn check_marks_entry_submit_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
//     attempt_number: i32,
// ) -> EligibilityResult {
//     let base = check_marks_entry_list_visibility(db, student, course_id, course_name).await;
//     if !base.eligible {
//         return base;
//     }

//     let sid = student.id.unwrap();
//     let current_attempt = max_course_attempt_number(db, &sid, course_id).await;
//     if attempt_number > current_attempt {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Invalid attempt number".into()),
//         };
//     }

//     let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
//     let attempt = coll
//         .find_one(
//             doc! {
//                 "student_id": sid,
//                 "course_id": course_id,
//                 "attempt_number": attempt_number
//             },
//             None,
//         )
//         .await
//         .ok()
//         .flatten();

//     let edit_unlocked = attempt.as_ref().map(|a| a.marks_edit_unlocked).unwrap_or(false);

//     if attempt_number < current_attempt && !edit_unlocked {
//         return EligibilityResult {
//             eligible: false,
//             reason: Some("Previous attempts are read-only".into()),
//         };
//     }

//     if attempt_number > 1 {
//         let allow = attempt.as_ref().map(|a| a.allow_reappear).unwrap_or(false);
//         if !allow && !edit_unlocked {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Reappear not approved by center for current attempt".into()),
//             };
//         }
//     }

//     if let Some(a) = attempt {
//         if a.marks_submitted && !a.marks_edit_unlocked {
//             return EligibilityResult {
//                 eligible: false,
//                 reason: Some("Marks locked — request changes from admin".into()),
//             };
//         }
//     }

//     EligibilityResult {
//         eligible: true,
//         reason: None,
//     }
// }

// /// Legacy alias used by bulk allot — kept for compatibility.
// pub async fn check_marks_entry_eligibility(
//     db: &Database,
//     student: &User,
//     course_id: &ObjectId,
//     course_name: Option<&str>,
// ) -> EligibilityResult {
//     check_marks_entry_list_visibility(db, student, course_id, course_name).await
// }

//! Backend eligibility checks for exam allotment, reappear, and marks entry.
use chrono::{NaiveDate, Utc};
use chrono_tz::Asia::Kolkata;
use futures_util::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, Document},
    Database,
};
use crate::models::exam_workflow::CourseExamAttempt;
use crate::models::user::User;

pub fn is_online_exam_mode(exam_mode: &Option<String>) -> bool {
    match exam_mode.as_deref() {
        Some(m) => {
            let lower = m.to_lowercase();
            lower.contains("online") || lower.contains("cbt") || lower == "computer based test (cbt)"
        }
        None => false,
    }
}

/// Whether the student's course session has ended (or no end date restriction applies).
///
/// FIX: Previously, a missing/empty/unparseable `session_end_date` returned `false`,
/// silently blocking students without that field from ever being eligible — even
/// though the frontend's own `filteredStudents` logic already treats a missing
/// `session_end_date` as "not blocked" (AdminExamAllotPage.tsx:
/// `if (!s.session_end_date) return true;`). This caused "N in course / 0 eligible"
/// whenever `session_end_date` was not populated on student records.
///
/// New behavior: missing/empty/unparseable `session_end_date` is treated as
/// "no completion restriction" -> passed (true), matching frontend behavior.
/// If you want to strictly REQUIRE session_end_date before allotment, populate
/// it reliably at student creation/import time instead of reverting this.
pub fn is_course_end_passed(session_end_date: &Option<String>) -> bool {
    let Some(raw) = session_end_date.as_ref() else {
        return true; // no end date set -> don't block eligibility
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return true; // empty string -> don't block eligibility
    }
    let today_ist = Utc::now().with_timezone(&Kolkata).date_naive();
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, "%Y-%m-%d") {
        return d <= today_ist;
    }
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(trimmed) {
        return dt.with_timezone(&Kolkata).date_naive() <= today_ist;
    }
    // Unparseable format -> don't silently block eligibility over a bad date string.
    true
}

pub fn student_belongs_to_course(student: &User, course_id: &ObjectId, course_name: Option<&str>) -> bool {
    if student.course_id.as_ref() == Some(course_id) {
        return true;
    }
    if let (Some(cn), Some(sc)) = (course_name, student.course.as_deref()) {
        return cn.eq_ignore_ascii_case(sc);
    }
    false
}

pub fn is_student_active_eligible(student: &User) -> bool {
    if !student.active || student.is_deleted {
        return false;
    }
    match student.approval_status.as_deref() {
        Some(s) => s.eq_ignore_ascii_case("approved"),
        None => true,
    }
}

/// Whether student has any allotted exam papers for course subjects.
pub async fn has_exam_allotment_for_course(
    db: &Database,
    student_id: &ObjectId,
    subject_ids: &[ObjectId],
) -> bool {
    if subject_ids.is_empty() {
        return false;
    }
    let paper_coll = db.collection::<Document>("student_papers");
    let count = paper_coll
        .count_documents(
            doc! {
                "student_id": student_id,
                "subject_id": { "$in": subject_ids },
            },
            None,
        )
        .await
        .unwrap_or(0);
    count > 0
}

/// Whether student already has an active or completed allotment for course subjects.
pub async fn has_existing_allotment_for_course(
    db: &Database,
    student_id: &ObjectId,
    subject_ids: &[ObjectId],
) -> bool {
    if subject_ids.is_empty() {
        return false;
    }
    let paper_coll = db.collection::<Document>("student_papers");
    let count = paper_coll
        .count_documents(
            doc! {
                "student_id": student_id,
                "subject_id": { "$in": subject_ids },
                "status": { "$in": ["Generated", "InProgress", "Submitted", "Evaluated", "submitted", "evaluated"] }
            },
            None,
        )
        .await
        .unwrap_or(0);
    count > 0
}

/// Whether student was allotted papers for a specific attempt number.
pub async fn has_allotment_for_attempt(
    db: &Database,
    student_id: &ObjectId,
    subject_ids: &[ObjectId],
    attempt_number: i32,
) -> bool {
    if subject_ids.is_empty() {
        return false;
    }
    let paper_coll = db.collection::<Document>("student_papers");
    let count = paper_coll
        .count_documents(
            doc! {
                "student_id": student_id,
                "subject_id": { "$in": subject_ids },
                "attempt_number": attempt_number,
            },
            None,
        )
        .await
        .unwrap_or(0);
    count > 0
}

pub async fn max_course_attempt_number(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
) -> i32 {
    latest_course_attempt(db, student_id, course_id)
        .await
        .map(|a| a.attempt_number)
        .unwrap_or(1)
}

pub async fn latest_submitted_course_attempt(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
) -> Option<CourseExamAttempt> {
    let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let mut cursor = coll
        .find(
            doc! {
                "student_id": student_id,
                "course_id": course_id,
                "marks_submitted": true,
            },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "attempt_number": -1 })
                .limit(1)
                .build(),
        )
        .await
        .ok()?;
    if let Some(Ok(a)) = cursor.next().await {
        return Some(a);
    }
    None
}

/// Latest course exam attempt for a student, if any.
pub async fn latest_course_attempt(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
) -> Option<CourseExamAttempt> {
    let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let mut cursor = coll
        .find(
            doc! { "student_id": student_id, "course_id": course_id },
            mongodb::options::FindOptions::builder()
                .sort(doc! { "attempt_number": -1 })
                .limit(1)
                .build(),
        )
        .await
        .ok()?;
    if let Some(Ok(a)) = cursor.next().await {
        return Some(a);
    }
    None
}

/// Whether student has ever appeared in any course examination (papers started/submitted or attempt.appeared).
pub async fn has_appeared_for_course(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
    subject_ids: &[ObjectId],
) -> bool {
    if let Some(latest) = latest_course_attempt(db, student_id, course_id).await {
        if latest.appeared {
            return true;
        }
    }

    if subject_ids.is_empty() {
        return false;
    }

    let paper_coll = db.collection::<Document>("student_papers");
    let count = paper_coll
        .count_documents(
            doc! {
                "student_id": student_id,
                "subject_id": { "$in": subject_ids },
                "status": { "$in": ["InProgress", "Submitted", "Evaluated", "submitted", "evaluated"] }
            },
            None,
        )
        .await
        .unwrap_or(0);
    count > 0
}

/// Overall course result failed on the latest submitted attempt.
pub async fn has_failed_overall_course(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
) -> bool {
    let Some(latest) = latest_course_attempt(db, student_id, course_id).await else {
        return false;
    };
    latest.marks_submitted
        && latest
            .overall_result
            .as_deref()
            .map(|r| r.eq_ignore_ascii_case("fail"))
            .unwrap_or(false)
}

/// Center has allowed reappear on the latest failed attempt.
///
/// FIX: Previously required `!latest.marks_submitted && latest.attempt_number > 1`,
/// in addition to `allow_reappear`. But the center approves reappear ON the attempt
/// the student just failed — which by definition already has `marks_submitted = true`,
/// and for a student failing their FIRST attempt, `attempt_number == 1` (not > 1).
/// That combination made this function return `false` for essentially every normal
/// "student failed attempt 1, center approved reappear" case — the most common
/// reappear scenario — which is why reappear allotment showed 0 eligible students
/// even after the center approved it.
///
/// Now: eligibility only requires that the latest attempt was submitted (i.e. it's
/// a real completed attempt, not an in-progress one) and that the center flagged
/// `allow_reappear` on it. `has_failed_overall_course` (checked separately in
/// `check_reappear_eligibility`) already ensures the result was a fail.
pub async fn is_reappear_approved(
    db: &Database,
    student_id: &ObjectId,
    course_id: &ObjectId,
) -> bool {
    let Some(latest) = latest_course_attempt(db, student_id, course_id).await else {
        return false;
    };
    latest.marks_submitted && latest.allow_reappear
}

pub struct EligibilityResult {
    pub eligible: bool,
    pub reason: Option<String>,
}

/// First-attempt allotment eligibility (toggle OFF).
pub async fn check_first_attempt_eligibility(
    db: &Database,
    student: &User,
    course_id: &ObjectId,
    course_name: Option<&str>,
    subject_ids: &[ObjectId],
) -> EligibilityResult {
    if !student_belongs_to_course(student, course_id, course_name) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student does not belong to selected course".into()),
        };
    }
    if !is_course_end_passed(&student.session_end_date) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Course not completed or end date has not passed".into()),
        };
    }
    let sid = student.id.unwrap();
    if has_appeared_for_course(db, &sid, course_id, subject_ids).await {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student has already appeared for this course examination".into()),
        };
    }
    if has_existing_allotment_for_course(db, &sid, subject_ids).await {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student already has exam allotment for this course".into()),
        };
    }
    if let Some(latest) = latest_course_attempt(db, &sid, course_id).await {
        if latest.marks_submitted || latest.appeared {
            return EligibilityResult {
                eligible: false,
                reason: Some("Student has already appeared for this course examination".into()),
            };
        }
    }
    if !is_student_active_eligible(student) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student is not active or not approved".into()),
        };
    }
    EligibilityResult {
        eligible: true,
        reason: None,
    }
}

/// Reappear allotment eligibility (toggle ON).
pub async fn check_reappear_eligibility(
    db: &Database,
    student: &User,
    course_id: &ObjectId,
    course_name: Option<&str>,
    _subject_ids: &[ObjectId],
) -> EligibilityResult {
    let sid = match student.id {
        Some(id) => id,
        None => {
            return EligibilityResult {
                eligible: false,
                reason: Some("Invalid student".into()),
            }
        }
    };

    if !student_belongs_to_course(student, course_id, course_name) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student does not belong to selected course".into()),
        };
    }
    if !is_course_end_passed(&student.session_end_date) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Course not completed or end date has not passed".into()),
        };
    }
    let latest_submitted = latest_submitted_course_attempt(db, &sid, course_id).await;
    let prev_attempt_no = latest_submitted
        .as_ref()
        .map(|a| a.attempt_number)
        .unwrap_or(0);
    let had_previous_allotment = if prev_attempt_no > 0 {
        has_allotment_for_attempt(db, &sid, _subject_ids, prev_attempt_no).await
    } else {
        false
    };
    if !has_appeared_for_course(db, &sid, course_id, _subject_ids).await && !had_previous_allotment {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student has never appeared for this course examination".into()),
        };
    }
    if !has_failed_overall_course(db, &sid, course_id).await {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student has not failed overall course result".into()),
        };
    }
    if !is_reappear_approved(db, &sid, course_id).await {
        return EligibilityResult {
            eligible: false,
            reason: Some("Reappear not approved by center for current attempt".into()),
        };
    }
    if !is_student_active_eligible(student) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student is not active or not approved".into()),
        };
    }

    // No active generated/in-progress papers for this course reappear cycle
    let paper_coll = db.collection::<Document>("student_papers");
    let active = paper_coll
        .count_documents(
            doc! {
                "student_id": sid,
                "subject_id": { "$in": _subject_ids },
                "status": { "$in": ["Generated", "InProgress"] }
            },
            None,
        )
        .await
        .unwrap_or(0);
    if active > 0 {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student already has an active allotted exam for this course".into()),
        };
    }

    EligibilityResult {
        eligible: true,
        reason: None,
    }
}

/// Marks entry list eligibility — student stays visible after marks submission.
pub async fn check_marks_entry_list_visibility(
    _db: &Database,
    student: &User,
    course_id: &ObjectId,
    course_name: Option<&str>,
) -> EligibilityResult {
    if !student_belongs_to_course(student, course_id, course_name) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student does not belong to course".into()),
        };
    }
    if !is_student_active_eligible(student) {
        return EligibilityResult {
            eligible: false,
            reason: Some("Student not active".into()),
        };
    }

    EligibilityResult {
        eligible: true,
        reason: None,
    }
}

/// Marks entry submit eligibility — can enter/edit marks now.
pub async fn check_marks_entry_submit_eligibility(
    db: &Database,
    student: &User,
    course_id: &ObjectId,
    course_name: Option<&str>,
    attempt_number: i32,
) -> EligibilityResult {
    let base = check_marks_entry_list_visibility(db, student, course_id, course_name).await;
    if !base.eligible {
        return base;
    }

    let sid = student.id.unwrap();
    let current_attempt = max_course_attempt_number(db, &sid, course_id).await;
    if attempt_number > current_attempt {
        return EligibilityResult {
            eligible: false,
            reason: Some("Invalid attempt number".into()),
        };
    }

    let coll = db.collection::<CourseExamAttempt>("course_exam_attempts");
    let attempt = coll
        .find_one(
            doc! {
                "student_id": sid,
                "course_id": course_id,
                "attempt_number": attempt_number
            },
            None,
        )
        .await
        .ok()
        .flatten();

    let edit_unlocked = attempt.as_ref().map(|a| a.marks_edit_unlocked).unwrap_or(false);

    if attempt_number < current_attempt && !edit_unlocked {
        return EligibilityResult {
            eligible: false,
            reason: Some("Previous attempts are read-only".into()),
        };
    }

    if attempt_number > 1 {
        let allow = attempt.as_ref().map(|a| a.allow_reappear).unwrap_or(false);
        if !allow && !edit_unlocked {
            return EligibilityResult {
                eligible: false,
                reason: Some("Reappear not approved by center for current attempt".into()),
            };
        }
    }

    if let Some(a) = attempt {
        if a.marks_submitted && !a.marks_edit_unlocked {
            return EligibilityResult {
                eligible: false,
                reason: Some("Marks locked — request changes from admin".into()),
            };
        }
    }

    EligibilityResult {
        eligible: true,
        reason: None,
    }
}

/// Legacy alias used by bulk allot — kept for compatibility.
pub async fn check_marks_entry_eligibility(
    db: &Database,
    student: &User,
    course_id: &ObjectId,
    course_name: Option<&str>,
) -> EligibilityResult {
    check_marks_entry_list_visibility(db, student, course_id, course_name).await
}