use axum::{
    extract::{State},
    http::StatusCode,
    Json,
};
use mongodb::{Database, bson::{doc, oid::ObjectId, Document}};
use serde::{Deserialize, Serialize};
use crate::models::user::{Claims};
use crate::models::resume::{ResumeExperience, ResumeEducation, ResumeProject};
use chrono::Utc;

#[derive(Debug, Deserialize, Default)]
pub struct SaveResumePayload {
    #[serde(default)]
    pub full_name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub linkedin: Option<String>,
    #[serde(default)]
    pub linkedin_url: Option<String>,
    #[serde(default)]
    pub github: Option<String>,
    #[serde(default)]
    pub github_url: Option<String>,
    #[serde(default)]
    pub portfolio_url: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub professional_summary: Option<String>,
    #[serde(default)]
    pub job_title: Option<String>,
    #[serde(default)]
    pub target_job_title: Option<String>,
    #[serde(default)]
    pub skills: Option<Vec<String>>,
    #[serde(default)]
    pub technical_skills: Option<Vec<String>>,
    #[serde(default)]
    pub soft_skills: Option<Vec<String>>,
    #[serde(default)]
    pub experience: Option<Vec<ResumeExperience>>,
    #[serde(default)]
    pub education: Option<Vec<ResumeEducation>>,
    #[serde(default)]
    pub projects: Option<Vec<ResumeProject>>,
    #[serde(default)]
    pub certifications: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct ResumeResponse {
    pub success: bool,
    pub message: String,
    pub resume: Option<serde_json::Value>,
    pub ats_score: u32,
    pub suggestions: Vec<String>,
}

fn calculate_ats_score(payload: &SaveResumePayload) -> (u32, Vec<String>) {
    let mut score = 0u32;
    let mut suggestions = Vec::new();

    if payload.full_name.as_ref().map_or(false, |s| !s.trim().is_empty()) {
        score += 10;
    } else {
        suggestions.push("Provide your full legal name.".to_string());
    }

    if payload.email.as_ref().map_or(false, |s| !s.trim().is_empty()) {
        score += 10;
    } else {
        suggestions.push("Add a professional contact email.".to_string());
    }

    if payload.phone.as_ref().map_or(false, |s| !s.trim().is_empty()) {
        score += 10;
    } else {
        suggestions.push("Add a phone number for recruiters.".to_string());
    }

    let summary = payload.summary.as_ref().or(payload.professional_summary.as_ref());
    if let Some(s) = summary {
        if s.trim().len() >= 50 {
            score += 15;
        } else if s.trim().len() > 10 {
            score += 8;
            suggestions.push("Expand your professional summary to at least 50 characters.".to_string());
        }
    } else {
        suggestions.push("Write a concise 2-3 line professional summary.".to_string());
    }

    let skills_list = payload.skills.as_ref().or(payload.technical_skills.as_ref());
    if let Some(skills) = skills_list {
        if skills.len() >= 5 {
            score += 20;
        } else if !skills.is_empty() {
            score += 10;
            suggestions.push("Add at least 5 key technical and soft skills.".to_string());
        }
    } else {
        suggestions.push("List key technical skills matching job descriptions.".to_string());
    }

    if let Some(exp) = &payload.experience {
        if !exp.is_empty() {
            score += 15;
        } else {
            suggestions.push("Include internship or practical project experience.".to_string());
        }
    }

    if let Some(edu) = &payload.education {
        if !edu.is_empty() {
            score += 10;
        } else {
            suggestions.push("Add your degree or diploma qualification.".to_string());
        }
    }

    if let Some(proj) = &payload.projects {
        if !proj.is_empty() {
            score += 10;
        }
    }

    (score.min(100), suggestions)
}

pub async fn get_student_resume(
    State(db): State<Database>,
    claims: Claims,
) -> (StatusCode, Json<serde_json::Value>) {
    let filter = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => doc! { "$or": [ { "user_id": oid }, { "user_id_str": &claims.sub } ] },
        Err(_) => doc! { "user_id_str": &claims.sub },
    };

    let resume_coll = db.collection::<Document>("resumes");

    let response_data: serde_json::Value = match resume_coll.find_one(filter, None).await {
        Ok(Some(doc)) => {
            let val = serde_json::to_value(&doc).unwrap_or(serde_json::json!({}));
            serde_json::json!({ "success": true, "resume": val })
        },
        _ => serde_json::json!({
            "success": true,
            "resume": {
                "user_id": claims.sub,
                "full_name": claims.username,
                "email": format!("{}@scre.in", claims.username),
                "phone": "9876543210",
                "professional_summary": "Motivated IT professional with hands-on software development training.",
                "target_job_title": "Full-Stack Web Developer",
                "technical_skills": ["React.js", "Node.js", "TypeScript", "MongoDB", "REST APIs"],
                "soft_skills": ["Problem Solving", "Team Collaboration", "Agile Communication"],
                "experience": [],
                "education": [],
                "projects": [],
                "certifications": [],
                "ats_score": 75
            }
        }),
    };

    (StatusCode::OK, Json(response_data))
}

pub async fn save_student_resume(
    State(db): State<Database>,
    claims: Claims,
    payload_res: Result<Json<SaveResumePayload>, axum::extract::rejection::JsonRejection>,
) -> (StatusCode, Json<ResumeResponse>) {
    let payload = match payload_res {
        Ok(Json(p)) => p,
        Err(err) => return (StatusCode::BAD_REQUEST, Json(ResumeResponse {
            success: false,
            message: format!("Invalid JSON payload: {}", err),
            resume: None,
            ats_score: 0,
            suggestions: vec![],
        })),
    };

    let (ats_score, suggestions) = calculate_ats_score(&payload);
    let resume_coll = db.collection::<Document>("resumes");

    let mut doc = doc! {
        "user_id_str": claims.sub.clone(),
        "full_name": payload.full_name.clone().unwrap_or_else(|| claims.username.clone()),
        "email": payload.email.clone().unwrap_or_default(),
        "phone": payload.phone.clone().unwrap_or_default(),
        "location": payload.location.clone().unwrap_or_default(),
        "linkedin_url": payload.linkedin.clone().or(payload.linkedin_url.clone()),
        "github_url": payload.github.clone().or(payload.github_url.clone()),
        "portfolio_url": payload.portfolio_url.clone(),
        "professional_summary": payload.summary.clone().or(payload.professional_summary.clone()).unwrap_or_default(),
        "target_job_title": payload.job_title.clone().or(payload.target_job_title.clone()).unwrap_or_default(),
        "technical_skills": mongodb::bson::to_bson(&payload.skills.clone().or(payload.technical_skills.clone()).unwrap_or_default()).unwrap(),
        "soft_skills": mongodb::bson::to_bson(&payload.soft_skills.clone().unwrap_or_default()).unwrap(),
        "experience": mongodb::bson::to_bson(&payload.experience.clone().unwrap_or_default()).unwrap(),
        "education": mongodb::bson::to_bson(&payload.education.clone().unwrap_or_default()).unwrap(),
        "projects": mongodb::bson::to_bson(&payload.projects.clone().unwrap_or_default()).unwrap(),
        "certifications": mongodb::bson::to_bson(&payload.certifications.clone().unwrap_or_default()).unwrap(),
        "ats_score": ats_score,
        "updated_at": Utc::now().to_rfc3339()
    };

    let filter = match ObjectId::parse_str(&claims.sub) {
        Ok(oid) => {
            doc.insert("user_id", oid);
            doc! { "$or": [ { "user_id": oid }, { "user_id_str": &claims.sub } ] }
        },
        Err(_) => doc! { "user_id_str": &claims.sub },
    };

    let update = doc! { "$set": doc.clone() };
    let options = mongodb::options::UpdateOptions::builder().upsert(true).build();

    match resume_coll.update_one(filter, update, options).await {
        Ok(_) => {
            let res_json = serde_json::to_value(&doc).unwrap_or(serde_json::json!({}));
            (StatusCode::OK, Json(ResumeResponse {
                success: true,
                message: format!("ATS Resume profile saved successfully! ATS Compatibility Score: {}%", ats_score),
                resume: Some(res_json),
                ats_score,
                suggestions,
            }))
        },
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(ResumeResponse {
            success: false,
            message: format!("Failed to save resume: {}", e),
            resume: None,
            ats_score: 0,
            suggestions: vec![],
        })),
    }
}

pub async fn calculate_ats_score_handler(
    payload_res: Result<Json<SaveResumePayload>, axum::extract::rejection::JsonRejection>,
) -> (StatusCode, Json<serde_json::Value>) {
    let payload = match payload_res {
        Ok(Json(p)) => p,
        Err(_) => SaveResumePayload::default(),
    };
    let (ats_score, suggestions) = calculate_ats_score(&payload);
    (StatusCode::OK, Json(serde_json::json!({
        "success": true,
        "ats_score": ats_score,
        "suggestions": suggestions
    })))
}
