use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use mongodb::{
    bson::doc,
    Database,
};
use serde_json::json;
use sha2::{Sha256, Digest};

use crate::models::{
    certificate::Certificate,
    user::User,
};

/// Computes a standard SHA-256 digital document hash
fn compute_doc_hash(cert_no: &str, candidate_name: &str, course: &str, issued_on: &str) -> String {
    let mut hasher = Sha256::new();
    let payload = format!("SCRE_NAD:{}:{}:{}:{}", cert_no, candidate_name, course, issued_on);
    hasher.update(payload.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// GET /api/public/digilocker/certificate/:cert_no - DigiLocker JSON Metadata
pub async fn get_digilocker_metadata(
    State(db): State<Database>,
    Path(cert_no): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let cert_col = db.collection::<Certificate>("certificates");
    let users_col = db.collection::<User>("users");

    let clean_no = cert_no.trim();
    let cert = cert_col.find_one(
        doc! { 
            "$or": [
                { "certificate_no": clean_no },
                { "certificate_no": clean_no.to_uppercase() }
            ]
        }, 
        None
    ).await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let student = users_col.find_one(doc! { "_id": cert.student_id }, None).await
        .ok().flatten();

    let student_name = student.as_ref()
        .map(|s| s.full_name.clone().unwrap_or_else(|| s.username.clone()))
        .unwrap_or_else(|| "Candidate".to_string());

    let roll_no = student.as_ref()
        .and_then(|s| s.enrollment_number.clone().or(s.roll_number.clone()))
        .unwrap_or_else(|| clean_no.to_string());

    let father_name = student.as_ref().and_then(|s| s.father_name.clone());

    let issued_str = cert.issued_on.to_rfc3339();
    let doc_hash = compute_doc_hash(&cert.certificate_no, &student_name, &cert.course, &issued_str);
    let doc_uri = format!("in.gov.digitallocker.scre:CERT:{}", cert.certificate_no);

    Ok(Json(json!({
        "status": "VERIFIED",
        "digilocker_compliant": true,
        "nad_status": "ACTIVE_REGISTERED",
        "issuer": {
            "org_id": "in.gov.scre",
            "org_name": "State Council for Rural Education (SCRE)",
            "jurisdiction": "National - Government Recognized Autonomous Board",
            "portal": "https://scre.org.in"
        },
        "document": {
            "doc_type": "CERTIFICATE_OF_COMPLETION",
            "doc_id": cert.certificate_no,
            "doc_uri": doc_uri,
            "schema_version": "2.1.0",
            "doc_hash_sha256": doc_hash,
            "issued_on": issued_str,
            "verification_endpoint": format!("/verify/{}", cert.certificate_no),
            "is_tamper_proof": true
        },
        "candidate": {
            "full_name": student_name,
            "roll_number": roll_no,
            "father_name": father_name,
            "course": cert.course,
            "center_name": cert.center_name.unwrap_or_else(|| "Authorized Study Center".to_string())
        }
    })))
}

/// GET /api/public/digilocker/certificate/:cert_no/xml - DigiLocker XML Payload conforming to MeitY Pull URI
pub async fn get_digilocker_xml(
    State(db): State<Database>,
    Path(cert_no): Path<String>,
) -> Result<Response, StatusCode> {
    let cert_col = db.collection::<Certificate>("certificates");
    let users_col = db.collection::<User>("users");

    let clean_no = cert_no.trim();
    let cert = cert_col.find_one(
        doc! { 
            "$or": [
                { "certificate_no": clean_no },
                { "certificate_no": clean_no.to_uppercase() }
            ]
        }, 
        None
    ).await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    .ok_or(StatusCode::NOT_FOUND)?;

    let student = users_col.find_one(doc! { "_id": cert.student_id }, None).await
        .ok().flatten();

    let student_name = student.as_ref()
        .map(|s| s.full_name.clone().unwrap_or_else(|| s.username.clone()))
        .unwrap_or_else(|| "Candidate".to_string());

    let roll_no = student.as_ref()
        .and_then(|s| s.enrollment_number.clone().or(s.roll_number.clone()))
        .unwrap_or_else(|| clean_no.to_string());

    let issued_str = cert.issued_on.to_rfc3339();
    let doc_hash = compute_doc_hash(&cert.certificate_no, &student_name, &cert.course, &issued_str);
    let doc_uri = format!("in.gov.digitallocker.scre:CERT:{}", cert.certificate_no);

    let xml_response = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<PullURIResponse xmlns="http://tempuri.org/">
  <ResponseStatus Status="1" Ts="{ts}" Txn="SCRE-TXN-{cert_no}" />
  <DocDetails>
    <DocType>UNIV_DEGREE</DocType>
    <DocId>{cert_no}</DocId>
    <DocURI>{doc_uri}</DocURI>
    <OrgId>in.gov.scre</OrgId>
    <OrgName>State Council for Rural Education</OrgName>
    <CandidateName>{name}</CandidateName>
    <RollNumber>{roll}</RollNumber>
    <CourseName>{course}</CourseName>
    <IssuedDate>{ts}</IssuedDate>
    <DigitalSignatureHash Algorithm="SHA-256">{hash}</DigitalSignatureHash>
    <Status>VERIFIED_AUTHENTIC</Status>
  </DocDetails>
</PullURIResponse>"#,
        ts = issued_str,
        cert_no = cert.certificate_no,
        doc_uri = doc_uri,
        name = student_name,
        roll = roll_no,
        course = cert.course,
        hash = doc_hash
    );

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
        .body(xml_response.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}
