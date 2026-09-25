//! Paper generation: **HMAC-derived seeds** + **ChaCha8** (deterministic, non–weak RNG),
//! **no duplicate** questions across sections, **immutable** MCQ option snapshots.
//!
//! ## Algorithm (summary)
//! 1. **Master seed** = HMAC-SHA256(server secret, `exam_id ‖ student_id ‖ attempt`) → 32 bytes.
//! 2. **Per-section subseed** = HMAC(secret, `master ‖ "sec" ‖ section_index ‖ marks ‖ count`) → shuffle pool, take **k** without replacement.
//! 3. **Exclude** already-used question ids across sections (`$nin` in Mongo filter).
//! 4. **Marks filter** uses a tight float band (`$gte` / `$lte`) so BSON doubles stay matchable.
//! 5. **MCQ options** shuffled with per-question subseed = HMAC(secret, `master ‖ "opt" ‖ question_id`).
//! 6. **Order** = sections in template order; within each section, order follows the **section shuffle** (random
//!    permutation of the chosen `k` questions).
//!
//! Same `(exam, student, attempt)` → same master seed → same paper. Different students → different seeds →
//! different permutations / subsets → **lower overlap** than “always take globally least-used”.

use crate::models::exam_engine_v2::{ExamV2PaperQuestion, ExamV2PaperTemplate, ExamV2Question};
use futures_util::StreamExt;
use hmac::{Hmac, Mac};
use mongodb::bson::oid::ObjectId;
use mongodb::Database;
use rand::seq::SliceRandom;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

/// Max distance from nominal marks for MongoDB `f64` matching.
const MARKS_EPS: f64 = 1e-6;

/// Decay constant for usage score (e.g., usage count weight decays over 30 days)
#[allow(dead_code)]
const DECAY_DAYS: i64 = 30;

fn hmac_secret() -> Result<Vec<u8>, String> {
    if let Ok(s) = std::env::var("EXAM_V2_PAPER_SECRET") {
        if !s.trim().is_empty() {
            return Ok(s.into_bytes());
        }
    }
    std::env::var("JWT_SECRET")
        .map(|s| s.into_bytes())
        .map_err(|_| "Set EXAM_V2_PAPER_SECRET or JWT_SECRET for exam v2 paper seeds".to_string())
}

/// Deterministic 32-byte seed for (exam, student, attempt).
pub fn derive_paper_seed(exam_id: ObjectId, student_id: ObjectId, attempt: i32) -> Result<[u8; 32], String> {
    let secret = hmac_secret()?;
    let mut mac = HmacSha256::new_from_slice(&secret).map_err(|e| e.to_string())?;
    mac.update(b"exam_v2_paper_v2");
    mac.update(exam_id.to_hex().as_bytes());
    mac.update(student_id.to_hex().as_bytes());
    mac.update(format!("{attempt}").as_bytes());
    let out = mac.finalize().into_bytes();
    let mut seed = [0u8; 32];
    seed.copy_from_slice(&out[..32]);
    Ok(seed)
}

/// Derive a secondary 32-byte seed (section RNG, global shuffle, per-question option shuffle).
#[allow(dead_code)]
fn derive_subseed(master: &[u8; 32], label: &[u8], extra: &[u8]) -> Result<[u8; 32], String> {
    let secret = hmac_secret()?;
    let mut mac = HmacSha256::new_from_slice(&secret).map_err(|e| e.to_string())?;
    mac.update(b"exam_v2_subseed");
    mac.update(master);
    mac.update(label);
    mac.update(extra);
    let out = mac.finalize().into_bytes();
    let mut s = [0u8; 32];
    s.copy_from_slice(&out[..32]);
    Ok(s)
}

pub fn seed_hex(seed: &[u8; 32]) -> String {
    hex::encode(seed)
}

#[allow(dead_code)]
fn chacha_from_seed(seed: &[u8; 32]) -> ChaCha8Rng {
    ChaCha8Rng::from_seed(*seed)
}

/// Fisher–Yates shuffle then take first `k` — uniform random k-subset without replacement, deterministic from `seed`.
#[allow(dead_code)]
fn pick_questions_uniform_without_replacement(
    mut eligible: Vec<ExamV2Question>,
    k: usize,
    seed: &[u8; 32],
) -> Result<Vec<ExamV2Question>, String> {
    if eligible.len() < k {
        return Err(format!(
            "insufficient questions: need {}, have {} (after excluding duplicates across sections)",
            k,
            eligible.len()
        ));
    }
    let mut rng = chacha_from_seed(seed);
    eligible.shuffle(&mut rng);
    eligible.truncate(k);
    Ok(eligible)
}

/// Sum of marks × count — must align with `template.total_marks` at creation time.
pub fn template_computed_total(template: &ExamV2PaperTemplate) -> f64 {
    let _sections_sum: f64 = template
        .sections
        .iter()
        .map(|s| s.marks * s.count as f64)
        .sum();
    
    // total = practical + assignment + exam
    let erp_total = template.practical_marks + template.assignment_marks + template.exam_marks;
    
    // For validation purposes, we return the ERP total. 
    // The handler should verify that sections_sum == template.exam_marks.
    erp_total
}

pub fn validate_template_structure(template: &ExamV2PaperTemplate) -> Result<(), String> {
    if template.sections.is_empty() {
        return Err("paper template has no sections".into());
    }
    
    let sections_sum: f64 = template
        .sections
        .iter()
        .map(|s| s.marks * s.count as f64)
        .sum();
        
    if (sections_sum - template.exam_marks).abs() > MARKS_EPS {
        return Err(format!(
            "Sum of section marks ({}) must match exam_marks ({})",
            sections_sum, template.exam_marks
        ));
    }
    
    let erp_total = template.practical_marks + template.assignment_marks + template.exam_marks;
    if (erp_total - template.total_marks).abs() > MARKS_EPS {
        return Err(format!(
            "Total marks ({}) must match sum of Practical ({}) + Assignment ({}) + Exam ({})",
            template.total_marks, template.practical_marks, template.assignment_marks, template.exam_marks
        ));
    }

    for (i, s) in template.sections.iter().enumerate() {
        if s.count == 0 {
            return Err(format!("section {}: count must be > 0", i));
        }
        if s.marks <= 0.0 || !s.marks.is_finite() {
            return Err(format!("section {}: marks must be finite and > 0", i));
        }
    }
    Ok(())
}

/// Build attempt questions from **paper template** + question bank. Snapshot is **immutable** once persisted on `ExamV2Paper`.
// --- Question Bank Module logic REMOVED for rebuild ---

pub async fn build_paper_questions(
    _db: &Database,
    _template: &ExamV2PaperTemplate,
    _seed: &[u8; 32],
    _student_id: ObjectId,
) -> Result<Vec<ExamV2PaperQuestion>, String> {
    Err("Question Bank is under reconstruction. Paper generation disabled.".into())
}

pub async fn bump_usage_counts(_db: &Database, _question_ids: &[ObjectId]) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Once;

    static TEST_SECRET: Once = Once::new();

    fn ensure_test_secret() {
        TEST_SECRET.call_once(|| {
            // SAFETY: tests only; single-threaded Once; required for HMAC seed helpers that read JWT_SECRET.
            unsafe {
                std::env::set_var("JWT_SECRET", "unit-test-jwt-secret-for-exam-v2-paper-seeds");
            }
        });
    }

    #[test]
    fn same_seed_same_master() {
        ensure_test_secret();
        let e = ObjectId::new();
        let s = ObjectId::new();
        let a = derive_paper_seed(e, s, 1).unwrap();
        let b = derive_paper_seed(e, s, 1).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn different_attempt_different_seed() {
        ensure_test_secret();
        let e = ObjectId::new();
        let s = ObjectId::new();
        let a = derive_paper_seed(e, s, 1).unwrap();
        let b = derive_paper_seed(e, s, 2).unwrap();
        assert_ne!(a, b);
    }
}
