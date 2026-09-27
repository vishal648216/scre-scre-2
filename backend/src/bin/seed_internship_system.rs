use mongodb::{
    bson::{doc, oid::ObjectId, DateTime as BsonDateTime},
    Client,
};
use bcrypt::{hash, DEFAULT_COST};
use chrono::Utc;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mongo_uri = env::var("MONGODB_URI").unwrap_or_else(|_| {
        "mongodb+srv://scre_admin:Scre%40123456@cluster0.fbbdcja.mongodb.net/scre_db?w=majority&appName=Cluster0&retryWrites=false".to_string()
    });

    println!("Connecting to MongoDB: {}", mongo_uri);
    let client = Client::with_uri_str(&mongo_uri).await?;
    let db = client.database("scre_db");

    println!("🚀 Seeding Internship System Data...");

    // 1. Seed Internship Postings
    let postings_coll = db.collection::<mongodb::bson::Document>("internship_postings");
    postings_coll.delete_many(doc! {}, None).await?;

    let now_bson = BsonDateTime::from_millis(Utc::now().timestamp_millis());

    let postings = vec![
        doc! {
            "title": "Full-Stack Web Engineering Intern",
            "company_name": "SCREduc Tech Labs",
            "domain": "Web Development",
            "location_type": "Remote",
            "city": "National",
            "duration_months": 3,
            "stipend_amount": 6000.0,
            "skills_required": ["React.js", "JavaScript", "HTML/CSS", "Node.js", "REST APIs"],
            "total_openings": 5,
            "description": "Work on live client portals, build responsive web pages, and collaborate with senior engineering teams.",
            "status": "Open",
            "created_at": now_bson,
        },
        doc! {
            "title": "Digital Growth & Performance Marketing Intern",
            "company_name": "Apex Media Solutions",
            "domain": "Digital Marketing",
            "location_type": "Hybrid",
            "city": "Gurugram / NCR",
            "duration_months": 3,
            "stipend_amount": 4500.0,
            "skills_required": ["Google Ads", "Meta Ads", "SEO", "Canva", "Analytics"],
            "total_openings": 4,
            "description": "Manage active campaigns, optimize organic rankings, and create high-conversion educational content.",
            "status": "Open",
            "created_at": now_bson,
        },
        doc! {
            "title": "Office Automation & Tally Accounting Executive",
            "company_name": "Global Accounts & Audit Corp",
            "domain": "Office Automation",
            "location_type": "On-site",
            "city": "Rohtak Center",
            "duration_months": 6,
            "stipend_amount": 7000.0,
            "skills_required": ["Tally Prime", "Advanced Excel", "GST Filing", "MIS Reporting"],
            "total_openings": 6,
            "description": "Maintain digital records, automate report generation, and coordinate GST voucher entries with accounting faculties.",
            "status": "Open",
            "created_at": now_bson,
        },
        doc! {
            "title": "Junior UI/UX & Graphic Design Intern",
            "company_name": "Creative Edge Studio",
            "domain": "Graphic Design",
            "location_type": "Remote",
            "city": "National",
            "duration_months": 3,
            "stipend_amount": 5000.0,
            "skills_required": ["Photoshop", "CorelDraw", "Figma", "Illustrator"],
            "total_openings": 3,
            "description": "Design promotional banners, course brochures, certificates, and student learning assets.",
            "status": "Open",
            "created_at": now_bson,
        },
        doc! {
            "title": "AI & Machine Learning Assistant",
            "company_name": "Cognitive AI Systems",
            "domain": "Hardware & AI",
            "location_type": "Remote",
            "city": "National",
            "duration_months": 6,
            "stipend_amount": 8000.0,
            "skills_required": ["Python", "TensorFlow", "Pandas", "Scikit-Learn"],
            "total_openings": 3,
            "description": "Assist in training educational AI tutors, data preprocessing pipelines, and automated grading evaluation.",
            "status": "Open",
            "created_at": now_bson,
        },
        doc! {
            "title": "Human Resource & Talent Acquisition Trainee",
            "company_name": "SCREduc Placement Cell",
            "domain": "Business Admin",
            "location_type": "Hybrid",
            "city": "Delhi NCR",
            "duration_months": 3,
            "stipend_amount": 4000.0,
            "skills_required": ["Screening", "Interview Scheduling", "LinkedIn Recruiter", "Communication"],
            "total_openings": 4,
            "description": "Source candidate profiles, coordinate campus placement drives, and maintain intern onboarding compliance.",
            "status": "Open",
            "created_at": now_bson,
        },
    ];

    let post_res = postings_coll.insert_many(postings, None).await?;
    println!("✅ Inserted {} internship postings", post_res.inserted_ids.len());

    let first_post_id = post_res.inserted_ids.get(&0).and_then(|id| id.as_object_id()).unwrap_or_else(ObjectId::new);

    // 2. Seed Intern Candidates (users collection with role="intern")
    let users_coll = db.collection::<mongodb::bson::Document>("users");
    
    let password_hash = hash("Intern@123", DEFAULT_COST)?;

    let interns = vec![
        doc! {
            "username": "intern.aditya",
            "password_hash": &password_hash,
            "raw_password": "Intern@123",
            "role": "intern",
            "full_name": "Aditya Sharma",
            "email": "aditya.intern@example.com",
            "phone": "9876543210",
            "active": true,
            "is_deleted": false,
            "approval_status": "approved",
            "enrollment_number": "SCRE-INT-2026-001",
            "serial_number": "INT001",
            "registration_date": "2026-01-15",
            "highest_qualification": "B.Tech (Computer Science)",
            "college": "State Institute of Engineering & Technology, Rohtak",
            "internship_domain": "Web Development",
            "internship_mode": "Remote",
            "address": "House No. 42, Model Town",
            "city": "Rohtak",
            "district": "Rohtak",
            "state": "Haryana",
            "country": "India",
            "pincode": "124001",
            "created_at": now_bson,
        },
        doc! {
            "username": "intern.pooja",
            "password_hash": &password_hash,
            "raw_password": "Intern@123",
            "role": "intern",
            "full_name": "Pooja Verma",
            "email": "pooja.intern@example.com",
            "phone": "9812345678",
            "active": true,
            "is_deleted": false,
            "approval_status": "approved",
            "enrollment_number": "SCRE-INT-2026-002",
            "serial_number": "INT002",
            "registration_date": "2026-02-01",
            "highest_qualification": "MBA (Marketing)",
            "college": "Delhi University South Campus",
            "internship_domain": "Digital Marketing",
            "internship_mode": "Hybrid",
            "address": "Flat 102, Sector 14",
            "city": "Gurugram",
            "district": "Gurugram",
            "state": "Haryana",
            "country": "India",
            "pincode": "122001",
            "created_at": now_bson,
        },
        doc! {
            "username": "intern.rahul",
            "password_hash": &password_hash,
            "raw_password": "Intern@123",
            "role": "intern",
            "full_name": "Rahul Mehra",
            "email": "rahul.intern@example.com",
            "phone": "9729012345",
            "active": true,
            "is_deleted": false,
            "approval_status": "approved",
            "enrollment_number": "SCRE-INT-2026-003",
            "serial_number": "INT003",
            "registration_date": "2026-02-10",
            "highest_qualification": "B.Com (Honours)",
            "college": "Government PG College, Jind",
            "internship_domain": "Office Automation",
            "internship_mode": "On-site",
            "address": "Main Market Jeweler Line",
            "city": "Jind",
            "district": "Jind",
            "state": "Haryana",
            "country": "India",
            "pincode": "126102",
            "created_at": now_bson,
        },
        doc! {
            "username": "intern.sneha",
            "password_hash": &password_hash,
            "raw_password": "Intern@123",
            "role": "intern",
            "full_name": "Sneha Gupta",
            "email": "sneha.intern@example.com",
            "phone": "9991122334",
            "active": true,
            "is_deleted": false,
            "approval_status": "approved",
            "enrollment_number": "SCRE-INT-2026-004",
            "serial_number": "INT004",
            "registration_date": "2026-03-01",
            "highest_qualification": "B.Des (UI/UX Graphic Design)",
            "college": "Jaipur National University",
            "internship_domain": "Graphic Design",
            "internship_mode": "Remote",
            "address": "Malviya Nagar Sector 3",
            "city": "Jaipur",
            "district": "Jaipur",
            "state": "Rajasthan",
            "country": "India",
            "pincode": "302017",
            "created_at": now_bson,
        },
    ];

    let user_res = users_coll.insert_many(interns, None).await?;
    println!("✅ Inserted {} intern accounts", user_res.inserted_ids.len());

    let first_student_id = user_res.inserted_ids.get(&0).and_then(|id| id.as_object_id()).unwrap_or_else(ObjectId::new);

    // 3. Seed Applications
    let apps_coll = db.collection::<mongodb::bson::Document>("internship_applications");
    apps_coll.delete_many(doc! {}, None).await?;

    let applications = vec![
        doc! {
            "internship_id": first_post_id,
            "internship_title": "Full-Stack Web Engineering Intern",
            "company_name": "SCREduc Tech Labs",
            "student_id": first_student_id,
            "student_name": "Aditya Sharma",
            "student_email": "aditya.intern@example.com",
            "student_phone": "9876543210",
            "enrollment_no": "SCRE-INT-2026-001",
            "resume_url": "https://drive.google.com/sample_resume_aditya.pdf",
            "cover_note": "Eager to contribute to live React and REST API portals.",
            "status": "Selected",
            "applied_at": now_bson,
            "updated_at": now_bson,
        },
        doc! {
            "internship_id": first_post_id,
            "internship_title": "Digital Growth & Performance Marketing Intern",
            "company_name": "Apex Media Solutions",
            "student_id": first_student_id,
            "student_name": "Pooja Verma",
            "student_email": "pooja.intern@example.com",
            "student_phone": "9812345678",
            "enrollment_no": "SCRE-INT-2026-002",
            "resume_url": "https://drive.google.com/sample_resume_pooja.pdf",
            "cover_note": "Skilled in Google Ads and Canva social media campaigns.",
            "status": "Shortlisted",
            "applied_at": now_bson,
            "updated_at": now_bson,
        },
    ];

    let app_res = apps_coll.insert_many(applications, None).await?;
    println!("✅ Inserted {} internship applications", app_res.inserted_ids.len());

    // 4. Seed Colleges
    let colleges_coll = db.collection::<mongodb::bson::Document>("colleges");
    colleges_coll.delete_many(doc! {}, None).await?;

    let colleges = vec![
        doc! { "name": "State Institute of Engineering & Technology, Rohtak", "city": "Rohtak", "state": "Haryana" },
        doc! { "name": "Government PG College, Jind", "city": "Jind", "state": "Haryana" },
        doc! { "name": "Delhi University South Campus", "city": "New Delhi", "state": "Delhi" },
        doc! { "name": "Jaipur National University", "city": "Jaipur", "state": "Rajasthan" },
        doc! { "name": "Chandigarh Group of Colleges", "city": "Mohali", "state": "Punjab" },
        doc! { "name": "Apex IT Placement Partner Hub", "city": "Gurugram", "state": "Haryana" },
    ];

    let col_res = colleges_coll.insert_many(colleges, None).await?;
    println!("✅ Inserted {} colleges & corporate partners", col_res.inserted_ids.len());

    // 5. Seed Internship Contacts / Enquiries
    let contact_coll = db.collection::<mongodb::bson::Document>("contacts");
    let enquiries = vec![
        doc! {
            "name": "Vikas Choudhary",
            "phone": "9876123456",
            "email": "vikas.c@example.com",
            "qualification": "BCA",
            "branch": "Computer Applications",
            "passing_year": "2026",
            "internship_domain": "Web Development",
            "internship_mode": "Remote",
            "duration": "3 Months",
            "college": "SIET Rohtak",
            "enquiry_type": "internship",
            "course": "Internship - Web Development",
            "subject": "Internship Enquiry: Web Development (Remote)",
            "message": "Looking for a 3-month web development internship with stipend.",
            "created_at": now_bson,
        },
        doc! {
            "name": "Meenakshi Saini",
            "phone": "9812998877",
            "email": "meenakshi@example.com",
            "qualification": "B.Com",
            "branch": "Commerce & Tally",
            "passing_year": "2025",
            "internship_domain": "Office Automation",
            "internship_mode": "On-site",
            "duration": "6 Months",
            "college": "Govt PG College Jind",
            "enquiry_type": "internship",
            "course": "Internship - Office Automation",
            "subject": "Internship Enquiry: Office Automation (On-site)",
            "message": "Need practical Tally Prime and GST filing experience.",
            "created_at": now_bson,
        },
    ];

    let contact_res = contact_coll.insert_many(enquiries, None).await?;
    println!("✅ Inserted {} internship enquiry leads", contact_res.inserted_ids.len());

    println!("🎉 Database Seeding Completed Successfully!");
    Ok(())
}
