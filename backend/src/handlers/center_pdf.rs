use crate::models::center::Center;
use crate::models::course::Course;
use crate::models::user::{Claims, UserRole};
use axum::{
    extract::{Path, State},
    http::{StatusCode, header},
    response::IntoResponse,
};
use base64::{Engine as _, engine::general_purpose};
use chrono::Utc;
use futures_util::StreamExt;
use mongodb::{Database, bson::doc, bson::oid::ObjectId};
use std::fs;
use std::process::Command;

pub async fn get_center_preview(
    State(db): State<Database>,
    claims: Claims,
    Path(center_id): Path<String>,
) -> impl IntoResponse {
    let oid = match ObjectId::parse_str(&center_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid center ID").into_response(),
    };

    let collection = db.collection::<Center>("centers");
    let center = match collection.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, "Center not found").into_response(),
    };

    if claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Admin
        && claims.sub != center.user_id.to_hex()
    {
        eprintln!(
            "Unauthorized PDF preview attempt by user {} with role {:?}",
            claims.sub, claims.role
        );
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let course_names = resolve_course_names(&db, &center.course_allotment).await;
    eprintln!(
        "[DEBUG] Preview center {} courses: {:?}",
        center_id, course_names
    );
    let html = generate_center_html(&center, course_names);

    (StatusCode::OK, [(header::CONTENT_TYPE, "text/html")], html).into_response()
}

pub async fn generate_center_details_pdf(
    State(db): State<Database>,
    claims: Claims,
    Path(center_id): Path<String>,
) -> impl IntoResponse {
    // Only Admin or the Center itself can print details
    let oid = match ObjectId::parse_str(&center_id) {
        Ok(oid) => oid,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid center ID").into_response(),
    };

    let collection = db.collection::<Center>("centers");
    let center = match collection.find_one(doc! { "_id": oid }, None).await {
        Ok(Some(c)) => c,
        _ => return (StatusCode::NOT_FOUND, "Center not found").into_response(),
    };

    if claims.role != UserRole::SuperAdmin
        && claims.role != UserRole::Admin
        && claims.sub != center.user_id.to_hex()
    {
        eprintln!(
            "Unauthorized PDF download attempt by user {} with role {:?}",
            claims.sub, claims.role
        );
        return (StatusCode::FORBIDDEN, "Unauthorized").into_response();
    }

    let course_names = resolve_course_names(&db, &center.course_allotment).await;
    eprintln!(
        "[DEBUG] PDF generation for center {} courses: {:?}",
        center_id, course_names
    );
    let html = generate_center_html(&center, course_names);

    // Use chromium to generate PDF
    let temp_dir = std::env::temp_dir();

    let timestamp = Utc::now().timestamp();
    let html_filename = format!("center_{}_{}.html", center.code, timestamp);
    let pdf_filename = format!("center_{}_{}.pdf", center.code, timestamp);

    let abs_html_path = temp_dir.join(&html_filename);
    let abs_pdf_path = temp_dir.join(&pdf_filename);

    if let Err(e) = fs::write(&abs_html_path, &html) {
        eprintln!("Failed to write temp HTML: {}", e);
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to write temporary HTML file",
        )
            .into_response();
    }

    // Try multiple possible chromium paths, prioritizing non-snap versions & Windows paths
    let chromium_paths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "google-chrome-stable",
        "google-chrome",
        "chromium-browser",
        "chromium",
        "chrome",
        "msedge",
    ];

    let mut pdf_generated = false;
    let mut last_error = String::new();

    for path in chromium_paths {
        let input_url = format!("file://{}", abs_html_path.display());
        println!(
            "Attempting PDF generation with {} for URL {}",
            path, input_url
        );

        let output = Command::new(path)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--allow-file-access-from-files",
                &format!("--print-to-pdf={}", abs_pdf_path.display()),
                &input_url,
            ])
            .output();

        match output {
            Ok(out) if out.status.success() => {
                if abs_pdf_path.exists() {
                    pdf_generated = true;
                    println!("Successfully generated PDF with {}", path);
                    break;
                } else {
                    last_error = format!(
                        "Chromium at {} reported success but PDF file not found at {}",
                        path,
                        abs_pdf_path.display()
                    );
                    eprintln!("{}", last_error);
                }
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                last_error = format!(
                    "Chromium at {} failed. Stderr: {}. Stdout: {}",
                    path, err, stdout
                );
                eprintln!("{}", last_error);
            }
            Err(e) => {
                last_error = format!("Failed to run chromium at {}: {}", path, e);
                eprintln!("{}", last_error);
            }
        }
    }

    if pdf_generated {
        let pdf_content = match fs::read(&abs_pdf_path) {
            Ok(content) => {
                if content.is_empty() {
                    eprintln!("PDF generated but is empty at {}", abs_pdf_path.display());
                    return (StatusCode::INTERNAL_SERVER_ERROR, "Generated PDF is empty")
                        .into_response();
                }
                content
            }
            Err(e) => {
                eprintln!("Failed to read generated PDF: {}", e);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to read generated PDF",
                )
                    .into_response();
            }
        };

        // Cleanup
        let _ = fs::remove_file(&abs_html_path);
        let _ = fs::remove_file(&abs_pdf_path);

        (
            StatusCode::OK,
            [
                (header::CONTENT_TYPE, "application/pdf"),
                (
                    header::CONTENT_DISPOSITION,
                    &format!("attachment; filename=\"center_{}.pdf\"", center.code),
                ),
            ],
            pdf_content,
        )
            .into_response()
    } else {
        // Fallback: return printable HTML directly if headless PDF generation failed
        eprintln!("Headless PDF failed: {}. Falling back to printable HTML.", last_error);
        let printable_html = format!(
            "{}\n<script>window.onload = function() {{ window.print(); }};</script>",
            html
        );
        let _ = fs::remove_file(&abs_html_path);
        (
            StatusCode::OK,
            [(header::CONTENT_TYPE, "text/html")],
            printable_html,
        )
            .into_response()
    }
}

fn generate_center_html(center: &Center, course_names: Vec<String>) -> String {
    let logo_html = if let Some(media) = &center.branding_media {
        if let Some(logo) = &media.center_logo_url {
            format!(
                r#"<img src="{}" style="max-height: 80px; margin-bottom: 20px;">"#,
                get_image_base64(logo)
            )
        } else {
            "".to_string()
        }
    } else {
        "".to_string()
    };

    let courses_html = if course_names.is_empty() {
        "<p style='color: #999; font-style: italic;'>No courses allotted</p>".to_string()
    } else {
        course_names.iter().map(|c| {
            format!(r#"<span style="display: inline-block; padding: 5px 10px; background: #f0f2f5; margin: 2px; border: 1px solid #ddd; font-size: 11px; font-weight: bold; text-transform: uppercase;">{}</span>"#, c)
        }).collect::<Vec<_>>().join("")
    };

    let docs_html = if center.documents.is_empty() {
        "<p style='color: #999; font-style: italic;'>No documents uploaded</p>".to_string()
    } else {
        center
            .documents
            .iter()
            .map(|d| {
                format!(
                    r#"
                <div style="padding: 8px; border-bottom: 1px solid #eee;">
                    <span style="font-weight: bold; font-size: 12px;">{}</span>
                    <span style="color: #666; font-size: 11px; margin-left: 10px;">{}</span>
                </div>
            "#,
                    d.name,
                    d.number.as_deref().unwrap_or("—")
                )
            })
            .collect::<Vec<_>>()
            .join("")
    };

    let owner_photo = center
        .key_documents
        .as_ref()
        .and_then(|k| k.owner_photo_url.as_ref());

    format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; color: #333; line-height: 1.6; }}
                .header {{ text-align: center; border-bottom: 3px solid #0F172A; padding-bottom: 20px; margin-bottom: 30px; position: relative; }}
                .owner-photo {{ position: absolute; top: 0; right: 0; width: 100px; height: 120px; border: 1px solid #ddd; object-fit: cover; }}
                .center-name {{ font-size: 28px; font-weight: 900; text-transform: uppercase; margin: 10px 0; color: #0F172A; width: 80%; margin-left: auto; margin-right: auto; }}
                .section {{ margin-bottom: 25px; }}
                .section-title {{ font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #fff; background: #0F172A; padding: 8px 15px; margin-bottom: 15px; display: flex; align-items: center; }}
                .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
                .field {{ margin-bottom: 10px; border-bottom: 1px solid #f9f9f9; padding-bottom: 5px; }}
                .label {{ font-size: 10px; font-weight: 900; text-transform: uppercase; color: #999; display: block; }}
                .value {{ font-size: 13px; font-weight: bold; color: #111; }}
                .status-badge {{ display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 900; text-transform: uppercase; border: 1px solid; }}
                .status-active {{ background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }}
                .status-suspended {{ background: #fef2f2; color: #dc2626; border-color: #fecaca; }}
                @media print {{
                    body {{ margin: 0; }}
                    @page {{ margin: 1cm; }}
                    .section-title {{ -webkit-print-color-adjust: exact; }}
                }}
            </style>
        </head>
        <body>
            <div class="header">
                {}
                {}
                <div class="center-name">{}</div>
                <div style="font-size: 14px; font-weight: bold; color: #666;">CENTER CODE: {}</div>
                <div style="margin-top: 10px;">
                    <span class="status-badge {}">{}</span>
                </div>
            </div>

            <div class="grid">
                <div class="section">
                    <div class="section-title">Center & Owner Profile</div>
                    <div class="field">
                        <span class="label">Owner Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Email Address</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Phone Number</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Street Address</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Country</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">State</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">District</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">City</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Pincode</span>
                        <span class="value">{}</span>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Infrastructure & Staff</div>
                    <div class="field">
                        <span class="label">Computers</span>
                        <span class="value">{} Nodes</span>
                    </div>
                    <div class="field">
                        <span class="label">Classrooms / Lab Type</span>
                        <span class="value">{} Classrooms / {}</span>
                    </div>
                    <div class="field">
                        <span class="label">Staff Strength</span>
                        <span class="value">{} Employees</span>
                    </div>
                    <div class="field">
                        <span class="label">Internet Connectivity</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Power Backup</span>
                        <span class="value">{}</span>
                    </div>
                </div>
            </div>

            <div class="grid">
                <div class="section">
                    <div class="section-title">Bank Account Details</div>
                    <div class="field">
                        <span class="label">Account Holder</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Bank Name</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Account Number</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">IFSC Code</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Branch Address</span>
                        <span class="value">{}</span>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Config & Validity</div>
                    <div class="field">
                        <span class="label">Franchise Fee / Royalty</span>
                        <span class="value">₹{} / {}%</span>
                    </div>
                    <div class="field">
                        <span class="label">Agreement Date</span>
                        <span class="value">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Validity Expiry</span>
                        <span class="value" style="color: #dc2626;">{}</span>
                    </div>
                    <div class="field">
                        <span class="label">Mock Test Status</span>
                        <span class="value">{} (Ends: {})</span>
                    </div>
                    <div class="field">
                        <span class="label">Working Hours</span>
                        <span class="value">{} to {}</span>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Allotted Courses</div>
                <div style="margin-top: 10px; padding: 10px; background: #fafafa; border: 1px solid #eee;">
                    {}
                </div>
            </div>

            <div class="section">
                <div class="section-title">Registered Documents</div>
                <div style="margin-top: 10px; border: 1px solid #eee;">
                    {}
                </div>
            </div>

            <div class="grid" style="margin-top: 30px;">
                <div style="text-align: center;">
                    <div style="height: 60px;">
                        {}
                    </div>
                    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 5px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                        Owner Signature
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="height: 60px;">
                        {}
                    </div>
                    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 5px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                        Center Stamp
                    </div>
                </div>
            </div>

            <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 20px;">
                This document is a system-generated profile for {} (Code: {}). 
                Issued on {}.
            </div>
        </body>
        </html>
        "#,
        logo_html,
        owner_photo
            .map(|url| format!(
                r#"<img src="{}" class="owner-photo">"#,
                get_image_base64(url)
            ))
            .unwrap_or_default(),
        center.name,
        center.code,
        if center.active {
            "status-active"
        } else {
            "status-suspended"
        },
        if center.active { "Active" } else { "Suspended" },
        center.owner_name,
        center.email,
        center.phone,
        center.address,
        center
            .location
            .as_ref()
            .and_then(|l| l.country.clone())
            .unwrap_or_else(|| "India".to_string()),
        center.state,
        center
            .location
            .as_ref()
            .and_then(|l| l.district.clone())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "—".to_string()),
        center.city,
        center
            .location
            .as_ref()
            .and_then(|l| l.pincode.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .infrastructure
            .as_ref()
            .and_then(|i| i.computers)
            .unwrap_or(0),
        center
            .infrastructure
            .as_ref()
            .and_then(|i| i.classrooms)
            .unwrap_or(0),
        center
            .infrastructure
            .as_ref()
            .and_then(|i| i.lab_type.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .infrastructure
            .as_ref()
            .and_then(|i| i.staff)
            .unwrap_or(0),
        if center
            .infrastructure
            .as_ref()
            .and_then(|i| i.internet_available)
            .unwrap_or(false)
        {
            "Available"
        } else {
            "Not Available"
        },
        if center
            .infrastructure
            .as_ref()
            .and_then(|i| i.power_backup)
            .unwrap_or(false)
        {
            "Available"
        } else {
            "Not Available"
        },
        center
            .bank_details
            .as_ref()
            .and_then(|b| b.account_holder.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .bank_details
            .as_ref()
            .and_then(|b| b.bank_name.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .bank_details
            .as_ref()
            .and_then(|b| b.account_number.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .bank_details
            .as_ref()
            .and_then(|b| b.ifsc_code.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .bank_details
            .as_ref()
            .and_then(|b| b.branch_address.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .config_validity
            .as_ref()
            .and_then(|v| v.franchise_fee)
            .unwrap_or(0.0),
        center
            .config_validity
            .as_ref()
            .and_then(|v| v.royalty_percent)
            .unwrap_or(0.0),
        center
            .config_validity
            .as_ref()
            .and_then(|v| v.creation_date.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .config_validity
            .as_ref()
            .and_then(|v| v.validity_date.clone())
            .unwrap_or_else(|| "—".to_string()),
        if center
            .config_validity
            .as_ref()
            .map(|v| v.mock_test_enabled)
            .unwrap_or(false)
        {
            "Enabled"
        } else {
            "Disabled"
        },
        center
            .config_validity
            .as_ref()
            .and_then(|v| v.mock_test_end_date.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .working_hours
            .as_ref()
            .and_then(|w| w.opening_time.clone())
            .unwrap_or_else(|| "—".to_string()),
        center
            .working_hours
            .as_ref()
            .and_then(|w| w.closing_time.clone())
            .unwrap_or_else(|| "—".to_string()),
        courses_html,
        docs_html,
        center
            .key_documents
            .as_ref()
            .and_then(|k| k.owner_signature_url.as_ref())
            .map(|url| format!(
                r#"<img src="{}" style="max-height: 50px;">"#,
                get_image_base64(url)
            ))
            .unwrap_or_default(),
        center
            .key_documents
            .as_ref()
            .and_then(|k| k.center_stamp_url.as_ref())
            .map(|url| format!(
                r#"<img src="{}" style="max-height: 50px;">"#,
                get_image_base64(url)
            ))
            .unwrap_or_default(),
        center.name,
        center.code,
        Utc::now().format("%d %B %Y, %H:%M")
    )
}

fn get_image_base64(url: &str) -> String {
    if url.starts_with("data:image") {
        return url.to_string();
    }

    // Handle both relative /uploads/ and absolute http://domain/uploads/
    let path_to_check = if url.starts_with("http") {
        if let Some(pos) = url.find("/uploads/") {
            &url[pos..]
        } else {
            return url.to_string();
        }
    } else {
        url
    };

    if path_to_check.starts_with("/uploads/") {
        let relative_path = path_to_check.trim_start_matches('/');

        // Try absolute path first, then relative paths
        let possible_paths = vec![
            std::path::PathBuf::from("/var/www/html/scre/backend").join(relative_path),
            std::path::PathBuf::from(".").join(relative_path),
            std::path::PathBuf::from("backend").join(relative_path),
        ];

        for path in possible_paths {
            if let Ok(bytes) = std::fs::read(&path) {
                let b64 = general_purpose::STANDARD.encode(bytes);
                let ext = url.rsplit('.').next().unwrap_or("png");
                let mime = match ext.to_lowercase().as_str() {
                    "jpg" | "jpeg" => "image/jpeg",
                    "png" => "image/png",
                    "gif" => "image/gif",
                    "webp" => "image/webp",
                    "svg" => "image/svg+xml",
                    _ => "image/png",
                };
                return format!("data:{};base64,{}", mime, b64);
            }
        }
    }

    url.to_string()
}

async fn resolve_course_names(db: &Database, course_allotment: &[String]) -> Vec<String> {
    if course_allotment.is_empty() {
        return Vec::new();
    }

    let course_collection = db.collection::<Course>("courses");
    let mut resolved_names = Vec::new();

    for id_or_name in course_allotment {
        // Specifically skip courses mentioned by the user as unwanted
        if id_or_name == "DIPLOMA IN SOFTWARE ENGINEERING"
            || id_or_name == "ADVANCE DIPLOMA IN COMPUTER APPLICATION"
        {
            continue;
        }

        // 1. Try resolving by ObjectId
        if let Ok(oid) = ObjectId::parse_str(id_or_name) {
            if let Ok(Some(course)) = course_collection
                .find_one(doc! { "_id": oid, "status": "active" }, None)
                .await
            {
                resolved_names.push(course.course_name);
                continue;
            } else {
                eprintln!(
                    "[WARN] Course ID {} not found or inactive for center allotment",
                    id_or_name
                );
                continue; // Skip invalid/deleted courses
            }
        }

        // 2. Fallback: If it's a name (migration path), verify it exists and is active
        let filter = doc! {
            "course_name": { "$regex": format!("^{}$", regex::escape(id_or_name)), "$options": "i" },
            "status": "active"
        };
        if let Ok(Some(course)) = course_collection.find_one(filter, None).await {
            resolved_names.push(course.course_name);
        } else {
            eprintln!(
                "[WARN] Course name '{}' not found or inactive for center allotment",
                id_or_name
            );
            // Skip invalid/deleted courses
        }
    }

    resolved_names
}
