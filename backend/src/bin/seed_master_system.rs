use backend::db::connect_db;
use bcrypt::{DEFAULT_COST, hash};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Connecting to MongoDB via connect_db()...");
    let (_client, db) = connect_db().await;

    println!("===========================================================");
    println!("🚀 STARTING MASTER SYSTEM SEEDING (FULL PLATFORM DATA) ...");
    println!("===========================================================");

    let now_bson = mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis());

    // 1. SEED USERS & ACCOUNTS
    let users_col = db.collection::<Document>("users");

    // Standard default password hashes for 'password', 'Admin@123', 'Center@123', 'Student@123', 'Intern@123'
    let pwd_default = hash("password", DEFAULT_COST)?;
    let pwd_admin = hash("Admin@123", DEFAULT_COST)?;
    let pwd_center = hash("Center@123", DEFAULT_COST)?;
    let pwd_student = hash("Student@123", DEFAULT_COST)?;
    let pwd_intern = hash("Intern@123", DEFAULT_COST)?;

    // Clear existing users collection to guarantee a fresh, consistent seed state
    let _ = users_col.delete_many(doc! {}, None).await;

    let admin_oid = ObjectId::new();
    let center1_user_oid = ObjectId::new();
    let center2_user_oid = ObjectId::new();
    let center3_user_oid = ObjectId::new();
    let student1_oid = ObjectId::new();
    let student2_oid = ObjectId::new();
    let student3_oid = ObjectId::new();
    let intern1_oid = ObjectId::new();
    let intern2_oid = ObjectId::new();
    let intern3_oid = ObjectId::new();
    let staff_oid = ObjectId::new();

    let users_docs = vec![
        // Super Admin
        doc! {
            "_id": admin_oid,
            "username": "admin",
            "password_hash": &pwd_admin,
            "raw_password": "Admin@123",
            "role": "admin",
            "full_name": "Super Administrator",
            "email": "admin@scre.in",
            "phone": "9876543210",
            "approval_status": "approved",
            "status": "active",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Center 1 (Ahmedabad)
        doc! {
            "_id": center1_user_oid,
            "username": "center",
            "password_hash": &pwd_center,
            "raw_password": "Center@123",
            "role": "center",
            "full_name": "Scre Central Academy Ahmedabad",
            "email": "center@scre.in",
            "phone": "9825012345",
            "center_code": "CENTRAL-001",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "district": "Ahmedabad",
            "approval_status": "approved",
            "status": "active",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Center 2 (Surat)
        doc! {
            "_id": center2_user_oid,
            "username": "center_surat",
            "password_hash": &pwd_center,
            "raw_password": "Center@123",
            "role": "center",
            "full_name": "Scre Excellence Center Surat",
            "email": "surat@scre.in",
            "phone": "9825099887",
            "center_code": "SURAT-002",
            "city": "Surat",
            "state": "Gujarat",
            "district": "Surat",
            "approval_status": "approved",
            "status": "active",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Center 3 (Vadodara)
        doc! {
            "_id": center3_user_oid,
            "username": "center_vadodara",
            "password_hash": &pwd_center,
            "raw_password": "Center@123",
            "role": "center",
            "full_name": "Scre Innovation Hub Vadodara",
            "email": "vadodara@scre.in",
            "phone": "9825077665",
            "center_code": "VADODARA-003",
            "city": "Vadodara",
            "state": "Gujarat",
            "district": "Vadodara",
            "approval_status": "approved",
            "status": "active",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Student 1 (Rohan Shah)
        doc! {
            "_id": student1_oid,
            "username": "student",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Rohan Shah",
            "first_name": "Rohan",
            "last_name": "Shah",
            "email": "student@scre.in",
            "phone": "9988776655",
            "enrollment_number": "EN2026001",
            "roll_number": "RL-101",
            "course": "Full Stack Web Development",
            "college": "Gujarat Technological University",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "district": "Ahmedabad",
            "pincode": "380015",
            "approval_status": "approved",
            "parent_id": center1_user_oid,
            "total_fees": 15000,
            "grand_total": 15000,
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Student 2 (Priya Patel)
        doc! {
            "_id": student2_oid,
            "username": "student_priya",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Priya Patel",
            "first_name": "Priya",
            "last_name": "Patel",
            "email": "priya.student@scre.in",
            "phone": "9988774433",
            "enrollment_number": "EN2026002",
            "roll_number": "RL-102",
            "course": "Cyber Security & Ethical Hacking",
            "college": "Parul University",
            "city": "Surat",
            "state": "Gujarat",
            "district": "Surat",
            "pincode": "395007",
            "approval_status": "approved",
            "parent_id": center2_user_oid,
            "total_fees": 18000,
            "grand_total": 18000,
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Student 3 (Amit Kumar)
        doc! {
            "_id": student3_oid,
            "username": "student_amit",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Amit Kumar",
            "first_name": "Amit",
            "last_name": "Kumar",
            "email": "amit.student@scre.in",
            "phone": "9988771122",
            "enrollment_number": "EN2026003",
            "roll_number": "RL-103",
            "course": "Diploma in Computer Applications (DCA)",
            "college": "Maharaja Sayajirao University",
            "city": "Vadodara",
            "state": "Gujarat",
            "district": "Vadodara",
            "pincode": "390002",
            "approval_status": "approved",
            "parent_id": center3_user_oid,
            "total_fees": 8000,
            "grand_total": 8000,
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Student 4 (Suresh Trivedi - Tally Prime)
        doc! {
            "_id": ObjectId::new(),
            "username": "student_suresh",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Suresh Trivedi",
            "first_name": "Suresh",
            "last_name": "Trivedi",
            "email": "suresh.t@scre.in",
            "phone": "9988773344",
            "enrollment_number": "EN2026004",
            "roll_number": "RL-104",
            "course": "Tally Prime & GST Accounting",
            "college": "Silver Oak University",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "district": "Ahmedabad",
            "pincode": "380015",
            "approval_status": "approved",
            "parent_id": center1_user_oid,
            "total_fees": 6000,
            "grand_total": 6000,
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Student 5 (Kavita Joshi - Cyber Security)
        doc! {
            "_id": ObjectId::new(),
            "username": "student_kavita",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Kavita Joshi",
            "first_name": "Kavita",
            "last_name": "Joshi",
            "email": "kavita.j@scre.in",
            "phone": "9988775566",
            "enrollment_number": "EN2026005",
            "roll_number": "RL-105",
            "course": "Cyber Security & Ethical Hacking",
            "college": "Nirma University",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "district": "Ahmedabad",
            "pincode": "380081",
            "approval_status": "approved",
            "parent_id": center1_user_oid,
            "total_fees": 18000,
            "grand_total": 18000,
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Pending Student Admission Request 1 (Rahul Verma)
        doc! {
            "_id": ObjectId::new(),
            "username": "student_pending_rahul",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Rahul Verma",
            "first_name": "Rahul",
            "last_name": "Verma",
            "email": "rahul.v@student.scre.in",
            "phone": "9879911223",
            "enrollment_number": "EN2026006",
            "course": "Full Stack Web Development",
            "college": "GTU Ahmedabad",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "district": "Ahmedabad",
            "pincode": "380015",
            "approval_status": "pending",
            "status": "pending",
            "priority_centers": ["Scre Central Academy Ahmedabad", "Scre Excellence Center Surat", "Scre Innovation Hub Vadodara"],
            "current_priority": 1,
            "total_fees": 15000,
            "grand_total": 15000,
            "active": false,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Pending Student Admission Request 2 (Neha Patel)
        doc! {
            "_id": ObjectId::new(),
            "username": "student_pending_neha",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Neha Patel",
            "first_name": "Neha",
            "last_name": "Patel",
            "email": "neha.p@student.scre.in",
            "phone": "9879944556",
            "enrollment_number": "EN2026007",
            "course": "Cyber Security & Ethical Hacking",
            "college": "Parul University Vadodara",
            "city": "Surat",
            "state": "Gujarat",
            "district": "Surat",
            "pincode": "395007",
            "approval_status": "pending",
            "status": "pending",
            "priority_centers": ["Scre Excellence Center Surat", "Scre Innovation Hub Vadodara", "Scre Central Academy Ahmedabad"],
            "current_priority": 1,
            "total_fees": 18000,
            "grand_total": 18000,
            "active": false,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Pending Student Admission Request 3 (Vikram Singh)
        doc! {
            "_id": ObjectId::new(),
            "username": "student_pending_vikram",
            "password_hash": &pwd_student,
            "raw_password": "Student@123",
            "role": "student",
            "full_name": "Vikram Singh",
            "first_name": "Vikram",
            "last_name": "Singh",
            "email": "vikram.s@student.scre.in",
            "phone": "9879977889",
            "enrollment_number": "EN2026008",
            "course": "Diploma in Computer Applications (DCA)",
            "college": "MSU Vadodara",
            "city": "Vadodara",
            "state": "Gujarat",
            "district": "Vadodara",
            "pincode": "390002",
            "approval_status": "pending",
            "status": "pending",
            "priority_centers": ["Scre Innovation Hub Vadodara", "Scre Central Academy Ahmedabad", "Scre Excellence Center Surat"],
            "current_priority": 1,
            "total_fees": 8000,
            "grand_total": 8000,
            "active": false,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Intern 1 (intern / Aditya Sharma)
        doc! {
            "_id": intern1_oid,
            "username": "intern",
            "password_hash": &pwd_intern,
            "raw_password": "Intern@123",
            "role": "intern",
            "full_name": "Aditya Sharma",
            "first_name": "Aditya",
            "last_name": "Sharma",
            "email": "intern@scre.in",
            "phone": "9876500111",
            "college": "GTU Ahmedabad",
            "internship_domain": "Full-Stack Web Development",
            "internship_mode": "Hybrid",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "approval_status": "approved",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Intern 2 (intern.aditya)
        doc! {
            "_id": intern2_oid,
            "username": "intern.aditya",
            "password_hash": &pwd_intern,
            "raw_password": "Intern@123",
            "role": "intern",
            "full_name": "Aditya Sharma",
            "first_name": "Aditya",
            "last_name": "Sharma",
            "email": "aditya.intern@scre.in",
            "phone": "9876500222",
            "college": "GTU Ahmedabad",
            "internship_domain": "Full-Stack Web Development",
            "internship_mode": "Hybrid",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "approval_status": "approved",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Intern 3 (intern.priya)
        doc! {
            "_id": intern3_oid,
            "username": "intern.priya",
            "password_hash": &pwd_intern,
            "raw_password": "Intern@123",
            "role": "intern",
            "full_name": "Priya Patel",
            "first_name": "Priya",
            "last_name": "Patel",
            "email": "priya.intern@scre.in",
            "phone": "9876500333",
            "college": "Parul University Vadodara",
            "internship_domain": "Data Analytics & AI Engineering",
            "internship_mode": "On-Site",
            "city": "Vadodara",
            "state": "Gujarat",
            "approval_status": "approved",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        },
        // Staff Coordinator
        doc! {
            "_id": staff_oid,
            "username": "staff",
            "password_hash": &pwd_default,
            "raw_password": "password",
            "role": "staff",
            "full_name": "Academic Staff Coordinator",
            "email": "staff@scre.in",
            "phone": "9876599999",
            "approval_status": "approved",
            "active": true,
            "is_deleted": false,
            "created_at": now_bson
        }
    ];

    users_col.insert_many(users_docs, None).await?;
    println!("✅ Users collection seeded (11 primary Accounts)");

    // 2. SEED CENTERS
    let centers_col = db.collection::<Document>("centers");
    let _ = centers_col.delete_many(doc! {}, None).await;

    let center1_rec_oid = ObjectId::new();
    let center2_rec_oid = ObjectId::new();
    let center3_rec_oid = ObjectId::new();

    let centers_docs = vec![
        doc! {
            "_id": center1_rec_oid,
            "name": "Scre Central Academy Ahmedabad",
            "code": "CENTRAL-001",
            "owner_name": "Dr. Rajesh Mehta",
            "about_center": "Premier IT & Vocational Excellence Center in SG Highway Ahmedabad",
            "phone": "9825012345",
            "email": "center@scre.in",
            "address": "401-405 Pinnacle Business Hub, SG Highway",
            "city": "Ahmedabad",
            "district": "Ahmedabad",
            "state": "Gujarat",
            "center_code": "CENTRAL-001",
            "location": {
                "country": "India",
                "state": "Gujarat",
                "district": "Ahmedabad",
                "city": "Ahmedabad",
                "address": "SG Highway, Ahmedabad",
                "pincode": "380015"
            },
            "infrastructure": {
                "computers": 45,
                "classrooms": 4,
                "staff": 12,
                "lab_type": "High-End i7 Workstations & GPU Rig",
                "internet_available": true,
                "power_backup": true
            },
            "admin_id": admin_oid,
            "user_id": center1_user_oid,
            "active": true,
            "is_deleted": false,
            "is_email_verified": true,
            "created_at": now_bson
        },
        doc! {
            "_id": center2_rec_oid,
            "name": "Scre Excellence Center Surat",
            "code": "SURAT-002",
            "owner_name": "Suresh Chandra Patel",
            "about_center": "Leading Cyber Security & Software Training Hub in Ring Road Surat",
            "phone": "9825099887",
            "email": "surat@scre.in",
            "address": "202 International Business Center, Ring Road",
            "city": "Surat",
            "district": "Surat",
            "state": "Gujarat",
            "center_code": "SURAT-002",
            "location": {
                "country": "India",
                "state": "Gujarat",
                "district": "Surat",
                "city": "Surat",
                "address": "Ring Road, Surat",
                "pincode": "395007"
            },
            "infrastructure": {
                "computers": 30,
                "classrooms": 3,
                "staff": 8,
                "lab_type": "Cisco & Networking Cyber Lab",
                "internet_available": true,
                "power_backup": true
            },
            "admin_id": admin_oid,
            "user_id": center2_user_oid,
            "active": true,
            "is_deleted": false,
            "is_email_verified": true,
            "created_at": now_bson
        },
        doc! {
            "_id": center3_rec_oid,
            "name": "Scre Innovation Hub Vadodara",
            "code": "VADODARA-003",
            "owner_name": "Vikramaditya Solanki",
            "about_center": "Advanced Industrial Robotics & Data Analytics Training Center",
            "phone": "9825077665",
            "email": "vadodara@scre.in",
            "address": "105 Sayajiganj Tech Complex, RC Dutt Road",
            "city": "Vadodara",
            "district": "Vadodara",
            "state": "Gujarat",
            "center_code": "VADODARA-003",
            "location": {
                "country": "India",
                "state": "Gujarat",
                "district": "Vadodara",
                "city": "Vadodara",
                "address": "RC Dutt Road, Vadodara",
                "pincode": "390002"
            },
            "infrastructure": {
                "computers": 35,
                "classrooms": 3,
                "staff": 10,
                "lab_type": "Robotics & Automation Suite",
                "internet_available": true,
                "power_backup": true
            },
            "admin_id": admin_oid,
            "user_id": center3_user_oid,
            "active": true,
            "is_deleted": false,
            "is_email_verified": true,
            "created_at": now_bson
        },
        // Pending Center Registration 1 (Rajkot Franchise)
        doc! {
            "_id": ObjectId::new(),
            "name": "Scre Franchise Center Rajkot",
            "code": "RAJKOT-004",
            "owner_name": "Arvind Parmar",
            "about_center": "New proposed IT training hub near Kalawad Road Rajkot",
            "phone": "9825044332",
            "email": "rajkot.franchise@scre.in",
            "address": "301 Shanti Complex, Kalawad Road",
            "city": "Rajkot",
            "district": "Rajkot",
            "state": "Gujarat",
            "center_code": "RAJKOT-004",
            "admin_id": admin_oid,
            "user_id": ObjectId::new(),
            "active": false,
            "approval_status": "pending",
            "is_deleted": false,
            "created_at": now_bson
        },
        // Pending Center Registration 2 (Bhavnagar Franchise)
        doc! {
            "_id": ObjectId::new(),
            "name": "Scre Franchise Center Bhavnagar",
            "code": "BHAVNAGAR-005",
            "owner_name": "Kiritbhai Shah",
            "about_center": "Proposed software & vocational skills academy",
            "phone": "9825066778",
            "email": "bhavnagar.franchise@scre.in",
            "address": "102 Waghawadi Road Business Park",
            "city": "Bhavnagar",
            "district": "Bhavnagar",
            "state": "Gujarat",
            "center_code": "BHAVNAGAR-005",
            "admin_id": admin_oid,
            "user_id": ObjectId::new(),
            "active": false,
            "approval_status": "pending",
            "is_deleted": false,
            "created_at": now_bson
        }
    ];

    centers_col.insert_many(centers_docs, None).await?;
    println!("✅ Centers collection seeded (3 Active, 2 Pending)");

    // 2.2 SEED STAFF MEMBERS & RBAC
    let staff_col = db.collection::<Document>("staff");
    let _ = staff_col.delete_many(doc! {}, None).await;

    let staff_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": center1_rec_oid,
            "parent_role": "center",
            "name": "Dr. Rajesh Mehta",
            "designation": "Senior Full-Stack Web Development Faculty",
            "role_type": "teacher",
            "phone": "9825011223",
            "email": "rajesh.m@scre.in",
            "status": "active",
            "basic_salary": 45000.0,
            "allowances": 3000.0,
            "deductions": 1500.0,
            "assigned_centers": vec!["Scre Central Academy Ahmedabad (CENTRAL-001)"],
            "assigned_subjects": vec!["Full Stack Web Development", "React & Node.js Architecture"],
            "permissions": {
                "can_manage_students": true,
                "can_manage_attendance": true,
                "can_manage_fees": false,
                "can_manage_courses": true,
                "can_manage_exams": true,
                "can_view_reports": true,
                "can_manage_staff": false
            },
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": center2_rec_oid,
            "parent_role": "center",
            "name": "Kavita Sharma",
            "designation": "Cyber Security & Linux Administrator",
            "role_type": "teacher",
            "phone": "9825033445",
            "email": "kavita.s@scre.in",
            "status": "active",
            "basic_salary": 42000.0,
            "allowances": 2500.0,
            "deductions": 1200.0,
            "assigned_centers": vec!["Scre Excellence Center Surat (SURAT-002)"],
            "assigned_subjects": vec!["Cyber Security & Ethical Hacking", "Network Defense"],
            "permissions": {
                "can_manage_students": true,
                "can_manage_attendance": true,
                "can_manage_fees": false,
                "can_manage_courses": true,
                "can_manage_exams": true,
                "can_view_reports": false,
                "can_manage_staff": false
            },
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": center1_rec_oid,
            "parent_role": "center",
            "name": "Hardik Patel",
            "designation": "Tally Prime GST & Financial Accounting Trainer",
            "role_type": "teacher",
            "phone": "9825055667",
            "email": "hardik.p@scre.in",
            "status": "active",
            "basic_salary": 38000.0,
            "allowances": 2000.0,
            "deductions": 1000.0,
            "assigned_centers": vec!["Scre Central Academy Ahmedabad (CENTRAL-001)"],
            "assigned_subjects": vec!["Tally Prime with GST", "Financial Accounting"],
            "permissions": {
                "can_manage_students": true,
                "can_manage_attendance": true,
                "can_manage_fees": true,
                "can_manage_courses": true,
                "can_manage_exams": false,
                "can_view_reports": true,
                "can_manage_staff": false
            },
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": center2_rec_oid,
            "parent_role": "center",
            "name": "Anjali Trivedi",
            "designation": "Senior Admissions Counselor & CRM Manager",
            "role_type": "counselor",
            "phone": "9825077889",
            "email": "anjali.t@scre.in",
            "status": "active",
            "basic_salary": 35000.0,
            "allowances": 4000.0,
            "deductions": 1000.0,
            "assigned_centers": vec!["Scre Excellence Center Surat (SURAT-002)"],
            "permissions": {
                "can_manage_students": true,
                "can_manage_attendance": false,
                "can_manage_fees": true,
                "can_manage_courses": false,
                "can_manage_exams": false,
                "can_view_reports": true,
                "can_manage_enquiries": true
            },
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": center3_rec_oid,
            "parent_role": "center",
            "name": "Nitin Varma",
            "designation": "Robotics & Automation Lead Instructor",
            "role_type": "teacher",
            "phone": "9825088990",
            "email": "nitin.v@scre.in",
            "status": "active",
            "basic_salary": 48000.0,
            "allowances": 3500.0,
            "deductions": 1500.0,
            "assigned_centers": vec!["Scre Innovation Hub Vadodara (VADODARA-003)"],
            "assigned_subjects": vec!["Industrial Robotics & Automation"],
            "permissions": {
                "can_manage_students": true,
                "can_manage_attendance": true,
                "can_manage_courses": true,
                "can_manage_exams": true
            },
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": center3_rec_oid,
            "parent_role": "center",
            "name": "Sunita Joshi",
            "designation": "Center Accountant & Cashier",
            "role_type": "accountant",
            "phone": "9825011334",
            "email": "sunita.j@scre.in",
            "status": "active",
            "basic_salary": 32000.0,
            "allowances": 1500.0,
            "deductions": 800.0,
            "assigned_centers": vec!["Scre Innovation Hub Vadodara (VADODARA-003)"],
            "permissions": {
                "can_manage_fees": true,
                "can_view_reports": true
            },
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": admin_oid,
            "parent_role": "admin",
            "name": "Prakash Parmar",
            "designation": "Head of Examinations & Academic Auditor",
            "role_type": "center_admin",
            "phone": "9825022445",
            "email": "prakash.p@scre.in",
            "status": "active",
            "basic_salary": 52000.0,
            "allowances": 5000.0,
            "deductions": 2000.0,
            "assigned_centers": vec!["HQ Direct (All Centers)"],
            "permissions": {
                "can_manage_students": true,
                "can_manage_attendance": true,
                "can_manage_fees": true,
                "can_manage_courses": true,
                "can_manage_exams": true,
                "can_view_reports": true,
                "can_manage_staff": true,
                "can_issue_certificates": true
            },
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "user_id": ObjectId::new(),
            "parent_id": center1_rec_oid,
            "parent_role": "center",
            "name": "Mahesh Kumar",
            "designation": "Lab Assistant & IT Admin",
            "role_type": "peon",
            "phone": "9825033556",
            "email": "mahesh.k@scre.in",
            "status": "active",
            "basic_salary": 25000.0,
            "allowances": 1000.0,
            "deductions": 500.0,
            "assigned_centers": vec!["Scre Central Academy Ahmedabad (CENTRAL-001)"],
            "permissions": {
                "can_manage_attendance": true
            },
            "created_at": now_bson
        }
    ];

    staff_col.insert_many(staff_docs, None).await?;
    println!("✅ Staff collection seeded (8 Comprehensive Staff Members)");

    // 2.5 SEED CENTER PROFILE UPDATES
    let updates_col = db.collection::<Document>("center_updates");
    let _ = updates_col.delete_many(doc! {}, None).await;

    let update_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "center_id": center1_rec_oid,
            "old_data": {
                "name": "Scre Central Academy Ahmedabad",
                "code": "CENTRAL-001",
                "computers": 45,
                "phone": "9825012345"
            },
            "new_data": {
                "name": "Scre Central Academy Ahmedabad (Expanded)",
                "code": "CENTRAL-001",
                "computers": 60,
                "phone": "9825012345"
            },
            "status": "pending",
            "requested_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "center_id": center2_rec_oid,
            "old_data": {
                "name": "Scre Excellence Center Surat",
                "code": "SURAT-002",
                "phone": "9825099887"
            },
            "new_data": {
                "name": "Scre Excellence Center Surat",
                "code": "SURAT-002",
                "phone": "9825099999",
                "bank_name": "HDFC Bank Ltd",
                "account_number": "50200088991122"
            },
            "status": "pending",
            "requested_at": now_bson
        }
    ];

    updates_col.insert_many(update_docs, None).await?;
    println!("✅ Center Profile Updates collection seeded (2 Pending Updates)");

    // 2.8 SEED COURSE CATEGORIES
    let categories_col = db.collection::<Document>("course_categories");
    let _ = categories_col.delete_many(doc! {}, None).await;

    let cat1_oid = ObjectId::new();
    let cat2_oid = ObjectId::new();
    let cat3_oid = ObjectId::new();
    let cat4_oid = ObjectId::new();
    let cat5_oid = ObjectId::new();

    let category_docs = vec![
        doc! {
            "_id": cat1_oid,
            "name": "Software Engineering & Web Development",
            "category_code": "CAT-DEV",
            "description": "Modern full-stack web engineering, Rust backend systems, React, and cloud architecture.",
            "status": "active",
            "sort_order": 1,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": cat2_oid,
            "name": "Cyber Security & Ethical Hacking",
            "category_code": "CAT-SEC",
            "description": "Network security, penetration testing, SOC monitoring, and vulnerability assessment.",
            "status": "active",
            "sort_order": 2,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": cat3_oid,
            "name": "Computer Applications & Office Suite",
            "category_code": "CAT-COMP",
            "description": "Fundamental computer skills, MS Office, DTP, and digital literacy programs.",
            "status": "active",
            "sort_order": 3,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": cat4_oid,
            "name": "Financial Accounting & Tally",
            "category_code": "CAT-FIN",
            "description": "Business accounting, Tally Prime with GST, taxation, and payroll management.",
            "status": "active",
            "sort_order": 4,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": cat5_oid,
            "name": "Design & Digital Media",
            "category_code": "CAT-DES",
            "description": "Graphic design, Photoshop, Illustrator, UI/UX prototyping, and media editing.",
            "status": "active",
            "sort_order": 5,
            "created_at": Utc::now().to_rfc3339()
        }
    ];

    categories_col.insert_many(category_docs, None).await?;
    println!("✅ Course Categories collection seeded (5 Categories)");

    // 3. SEED COURSES
    let courses_col = db.collection::<Document>("courses");
    let _ = courses_col.delete_many(doc! {}, None).await;

    let c1_oid = ObjectId::new();
    let c2_oid = ObjectId::new();
    let c3_oid = ObjectId::new();
    let c4_oid = ObjectId::new();

    let courses_docs = vec![
        doc! {
            "_id": c1_oid,
            "category_id": cat1_oid,
            "course_name": "Full Stack Web Development",
            "course_code": "WD-101",
            "slug": "full-stack-web-development",
            "short_code": "FSWD",
            "duration_months": 6,
            "duration_value": 6,
            "duration_unit": "months",
            "course_type": "diploma",
            "description": "Comprehensive React, Node.js, Rust Axum, and MongoDB Full Stack Engineering",
            "image_url": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
            "syllabus": "HTML5/CSS3, JavaScript ES6+, React, State Management, Rust Backend, MongoDB, Microservices",
            "fees": 15000,
            "registration_fee": 1000,
            "exam_fees_applicable": true,
            "exam_fee_amount": 500,
            "eligibility": "10+2 / Graduation / Diploma in IT",
            "status": "active",
            "featured_on_home": true,
            "home_feature_order": 1,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": c2_oid,
            "category_id": cat2_oid,
            "course_name": "Cyber Security & Ethical Hacking",
            "course_code": "CS-201",
            "slug": "cyber-security-ethical-hacking",
            "short_code": "CSEH",
            "duration_months": 6,
            "duration_value": 6,
            "duration_unit": "months",
            "course_type": "diploma",
            "description": "Network Penetration Testing, SOC Operations, Vulnerability Assessment",
            "image_url": "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800",
            "syllabus": "Linux Fundamentals, Metasploit, Wireshark, Web App Security, OWASP Top 10",
            "fees": 18000,
            "registration_fee": 1000,
            "exam_fees_applicable": true,
            "exam_fee_amount": 500,
            "eligibility": "10+2 / Any Graduate",
            "status": "active",
            "featured_on_home": true,
            "home_feature_order": 2,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": c3_oid,
            "category_id": cat3_oid,
            "course_name": "Diploma in Computer Applications (DCA)",
            "course_code": "DCA-100",
            "slug": "diploma-in-computer-applications",
            "short_code": "DCA",
            "duration_months": 12,
            "duration_value": 12,
            "duration_unit": "months",
            "course_type": "diploma",
            "description": "Fundamental Computer Operation, MS Office Suite, DTP, and Internet Applications",
            "image_url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
            "syllabus": "Computer Basics, MS Word, Excel, PowerPoint, Access, Photoshop, Internet Tools",
            "fees": 8000,
            "registration_fee": 500,
            "exam_fees_applicable": true,
            "exam_fee_amount": 300,
            "eligibility": "10th Pass / 12th Pass",
            "status": "active",
            "featured_on_home": true,
            "home_feature_order": 3,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": c4_oid,
            "category_id": cat4_oid,
            "course_name": "Tally Prime & GST Accounting",
            "course_code": "TALLY-101",
            "slug": "tally-prime-gst-accounting",
            "short_code": "TPGA",
            "duration_months": 3,
            "duration_value": 3,
            "duration_unit": "months",
            "course_type": "certification",
            "description": "Professional Business Accounting, Payroll, Inventory Management, and GST Filing",
            "image_url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800",
            "syllabus": "Tally Prime Basics, Vouchers, Ledger Creation, GST Returns (GSTR-1, 3B), TDS/TCS",
            "fees": 6000,
            "registration_fee": 500,
            "exam_fees_applicable": true,
            "exam_fee_amount": 250,
            "eligibility": "10th / 12th Commerce / Any Graduate",
            "status": "active",
            "featured_on_home": true,
            "home_feature_order": 4,
            "created_at": Utc::now().to_rfc3339()
        }
    ];

    courses_col.insert_many(courses_docs, None).await?;
    println!("✅ Courses collection seeded (4 Courses)");

    // 3.1 SEED SUBJECTS
    let subjects_col = db.collection::<Document>("subjects");
    let _ = subjects_col.delete_many(doc! {}, None).await;

    let sub1_oid = ObjectId::new();
    let sub2_oid = ObjectId::new();
    let sub3_oid = ObjectId::new();
    let sub4_oid = ObjectId::new();
    let sub5_oid = ObjectId::new();
    let sub6_oid = ObjectId::new();

    let subjects_docs = vec![
        doc! {
            "_id": sub1_oid,
            "subject_name": "Web Frontend & React Frameworks",
            "subject_code": "SUB-1001",
            "description": "HTML5, CSS3, Tailwind, JavaScript ES6+, React Hooks, State Management",
            "status": "active",
            "created_at": now_bson
        },
        doc! {
            "_id": sub2_oid,
            "subject_name": "Backend Systems & Database Architecture",
            "subject_code": "SUB-1002",
            "description": "Node.js, Express, Rust Axum, REST APIs, MongoDB Aggregations",
            "status": "active",
            "created_at": now_bson
        },
        doc! {
            "_id": sub3_oid,
            "subject_name": "Network Defense & Penetration Testing",
            "subject_code": "SUB-2001",
            "description": "TCP/IP Protocol, Nmap, Wireshark, Metasploit, Web Application Hacking",
            "status": "active",
            "created_at": now_bson
        },
        doc! {
            "_id": sub4_oid,
            "subject_name": "Computer Fundamentals & Operating Systems",
            "subject_code": "SUB-3001",
            "description": "Hardware architecture, Windows 11, Linux CLI, File Management, Networking basics",
            "status": "active",
            "created_at": now_bson
        },
        doc! {
            "_id": sub5_oid,
            "subject_name": "Tally Prime Accounting & Statutory GST",
            "subject_code": "SUB-4001",
            "description": "Double-entry bookkeeping, Voucher entry, GST portal integration, Inventory management",
            "status": "active",
            "created_at": now_bson
        },
        doc! {
            "_id": sub6_oid,
            "subject_name": "Desktop Publishing & Graphic Tools",
            "subject_code": "SUB-5001",
            "description": "Adobe Photoshop, CorelDraw, PageMaker, Vector Graphics, Banner Designing",
            "status": "active",
            "created_at": now_bson
        }
    ];

    subjects_col.insert_many(subjects_docs, None).await?;
    println!("✅ Subjects collection seeded (6 Subjects)");

    // 3.2 SEED SUBJECT MAPPINGS (course_subjects)
    let course_subjects_col = db.collection::<Document>("course_subjects");
    let _ = course_subjects_col.delete_many(doc! {}, None).await;

    let mapping_docs = vec![
        doc! { "_id": ObjectId::new(), "course_id": c1_oid, "subject_id": sub1_oid, "subject_order": 1 },
        doc! { "_id": ObjectId::new(), "course_id": c1_oid, "subject_id": sub2_oid, "subject_order": 2 },
        doc! { "_id": ObjectId::new(), "course_id": c2_oid, "subject_id": sub3_oid, "subject_order": 1 },
        doc! { "_id": ObjectId::new(), "course_id": c3_oid, "subject_id": sub4_oid, "subject_order": 1 },
        doc! { "_id": ObjectId::new(), "course_id": c3_oid, "subject_id": sub6_oid, "subject_order": 2 },
        doc! { "_id": ObjectId::new(), "course_id": c4_oid, "subject_id": sub5_oid, "subject_order": 1 },
    ];

    course_subjects_col.insert_many(mapping_docs, None).await?;
    println!("✅ Course Subjects (Subject Mapping) collection seeded");

    // 3.3 SEED ACADEMIC SESSIONS
    let sessions_col = db.collection::<Document>("sessions");
    let _ = sessions_col.delete_many(doc! {}, None).await;

    let session_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "course_id": c1_oid,
            "session_name": "2025-2026 Academic Session",
            "start_date": now_bson,
            "end_date": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis() + 365 * 86400 * 1000),
            "status": "active"
        },
        doc! {
            "_id": ObjectId::new(),
            "course_id": c2_oid,
            "session_name": "Summer Intensive Security Batch 2026",
            "start_date": now_bson,
            "end_date": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis() + 180 * 86400 * 1000),
            "status": "active"
        },
        doc! {
            "_id": ObjectId::new(),
            "course_id": c3_oid,
            "session_name": "2026 Annual Diploma Batch",
            "start_date": now_bson,
            "end_date": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis() + 365 * 86400 * 1000),
            "status": "active"
        }
    ];

    sessions_col.insert_many(session_docs, None).await?;
    println!("✅ Sessions collection seeded (3 Academic Sessions)");

    // 3.4 SEED STUDY MATERIAL
    let study_col = db.collection::<Document>("study_materials");
    let _ = study_col.delete_many(doc! {}, None).await;

    let study_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "subject_id": sub1_oid,
            "title": "React 18 & State Management Master Guide (PDF)",
            "description": "Complete handbook covering JSX, Custom Hooks, Redux Toolkit, and Performance Optimization.",
            "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "uploaded_by": admin_oid,
            "class_level": "Advanced",
            "media_type": "PDF Handbook",
            "chapter_name": "Chapter 4: Modern State Architectures",
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "subject_id": sub3_oid,
            "title": "Ethical Hacking & Network Security E-Book",
            "description": "Comprehensive guide on Metasploit framework, Nmap scanning, and OWASP Top 10 vulnerabilities.",
            "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "uploaded_by": admin_oid,
            "class_level": "Intermediate",
            "media_type": "PDF E-Book",
            "chapter_name": "Chapter 2: Reconnaissance & Port Scanning",
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "subject_id": sub4_oid,
            "title": "DCA Computer Fundamentals Notes",
            "description": "Step-by-step notes for MS Word, MS Excel Formulas, Keyboard Shortcuts, and Operating System Basics.",
            "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "uploaded_by": admin_oid,
            "class_level": "Beginner",
            "media_type": "Courseware PDF",
            "chapter_name": "Module 1: Computer Hardware & OS",
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "subject_id": sub5_oid,
            "title": "Tally Prime GST Accounting Practical Workbook",
            "description": "Real business ledger examples, voucher creation steps, and GSTR-1 return filing instructions.",
            "file_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "uploaded_by": admin_oid,
            "class_level": "Practical",
            "media_type": "Workbook PDF",
            "chapter_name": "Module 3: GST Tax Calculations",
            "created_at": now_bson
        }
    ];

    study_col.insert_many(study_docs, None).await?;
    println!("✅ Study Material collection seeded (4 Resources)");

    // 3.5 SEED DIGITAL LIBRARY BOOKS & ISSUES
    let library_col = db.collection::<Document>("library_books");
    let _ = library_col.delete_many(doc! {}, None).await;

    let book1_oid = ObjectId::new();
    let book2_oid = ObjectId::new();

    let library_docs = vec![
        doc! {
            "_id": book1_oid,
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
            "fine_per_day": 5.0,
            "description": "Standard textbook for DCA covering computer hardware, operating systems, and office automation.",
            "cover_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600",
            "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "total_pages": 480,
            "is_published": true,
            "course_id": c3_oid,
            "center_name": "Scre Central Academy Ahmedabad",
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": book2_oid,
            "title": "Learning React & Modern JavaScript ES6+",
            "author": "Alex Banks & Eve Porcello",
            "category": "Web Development",
            "isbn": "978-14-9195-462-1",
            "publisher": "O'Reilly Media",
            "edition": "2nd Edition",
            "volume_part": "Vol 1",
            "registered_date": "2026-02-10",
            "shelf_location": "Rack B / Shelf 3",
            "physical_copies": 8,
            "available_copies": 6,
            "fine_per_day": 10.0,
            "description": "Comprehensive guide to building single page applications using React components and hooks.",
            "cover_url": "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600",
            "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "total_pages": 360,
            "is_published": true,
            "course_id": c1_oid,
            "center_name": "Scre Central Academy Ahmedabad",
            "created_at": now_bson,
            "updated_at": now_bson
        }
    ];

    library_col.insert_many(library_docs, None).await?;
    println!("✅ Digital Library Books collection seeded (2 Books)");

    let lib_issues_col = db.collection::<Document>("library_book_issues");
    let _ = lib_issues_col.delete_many(doc! {}, None).await;

    let issue_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "book_id": book1_oid,
            "student_id": student1_oid,
            "book_title": "Computer Fundamentals & Office Automation (DCA)",
            "student_name": "Rohan Shah",
            "enrollment_number": "EN2026001",
            "student_phone": "9876500001",
            "center_name": "Scre Central Academy Ahmedabad",
            "librarian_name": "Central Librarian",
            "issue_date": now_bson,
            "due_date": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis() + 14 * 86400 * 1000),
            "status": "Issued",
            "fine_amount": 0.0,
            "created_at": now_bson,
            "updated_at": now_bson
        }
    ];

    lib_issues_col.insert_many(issue_docs, None).await?;
    println!("✅ Digital Library Book Issues collection seeded");

    // 3.6 SEED EXAM BLUEPRINTS & MOCK TESTS
    let templates_col = db.collection::<Document>("exam_v2_paper_templates");
    let _ = templates_col.delete_many(doc! {}, None).await;

    let tpl1_oid = ObjectId::new();
    let tpl_docs = vec![
        doc! {
            "_id": tpl1_oid,
            "name": "FSWD Master Certification Theory Blueprint",
            "course_id": c1_oid,
            "duration_minutes": 60,
            "total_marks": 100,
            "pass_marks": 40,
            "sections": [
                doc! { "section_name": "Frontend & React", "question_count": 5, "marks_per_question": 10 },
                doc! { "section_name": "Backend & Database", "question_count": 5, "marks_per_question": 10 }
            ],
            "created_by": admin_oid,
            "created_at": now_bson
        }
    ];
    templates_col.insert_many(tpl_docs, None).await?;
    println!("✅ Exam Paper Templates (Blueprints) collection seeded");

    let exams_col = db.collection::<Document>("exam_v2_exams");
    let _ = exams_col.delete_many(doc! {}, None).await;

    let exam1_oid = ObjectId::new();
    let exam_docs = vec![
        doc! {
            "_id": exam1_oid,
            "title": "Full Stack Web Development Mid-Term Mock Test 2026",
            "course_id": c1_oid,
            "paper_template_id": tpl1_oid,
            "exam_mode": "online",
            "start_at": now_bson,
            "end_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis() + 30 * 86400 * 1000),
            "status": "published",
            "require_attendance": false,
            "center_ids": vec![center1_rec_oid, center2_rec_oid],
            "created_by": admin_oid,
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "title": "DCA Computer Fundamentals Online Practice Exam",
            "course_id": c3_oid,
            "paper_template_id": tpl1_oid,
            "exam_mode": "online",
            "start_at": now_bson,
            "end_at": mongodb::bson::DateTime::from_millis(Utc::now().timestamp_millis() + 30 * 86400 * 1000),
            "status": "published",
            "require_attendance": false,
            "center_ids": vec![center1_rec_oid],
            "created_by": admin_oid,
            "created_at": now_bson
        }
    ];

    exams_col.insert_many(exam_docs, None).await?;
    println!("✅ Mock Tests (Exams) collection seeded (2 Published Mock Exams)");

    // 3.7 SEED QUESTION BANK & QUESTION FEEDBACK
    let questions_col = db.collection::<Document>("exam_v2_questions");
    let _ = questions_col.delete_many(doc! {}, None).await;

    let q1_oid = ObjectId::new();
    let q2_oid = ObjectId::new();

    let question_docs = vec![
        doc! {
            "_id": q1_oid,
            "parent_question_id": q1_oid,
            "version": 1,
            "question_text": "Which React hook is used for performing side effects in functional components?",
            "question_type": "single_choice",
            "options_pool": [
                doc! { "id": "opt1", "text": "useState" },
                doc! { "id": "opt2", "text": "useEffect" },
                doc! { "id": "opt3", "text": "useContext" },
                doc! { "id": "opt4", "text": "useReducer" }
            ],
            "correct_option_id": "opt2",
            "marks": 10.0,
            "course_id": c1_oid,
            "subject_id": sub1_oid,
            "tags": vec!["react", "hooks", "frontend"],
            "status": "active",
            "created_at": now_bson
        },
        doc! {
            "_id": q2_oid,
            "parent_question_id": q2_oid,
            "version": 1,
            "question_text": "What does SQL stand for in database systems?",
            "question_type": "single_choice",
            "options_pool": [
                doc! { "id": "opt1", "text": "Structured Query Language" },
                doc! { "id": "opt2", "text": "Simple Question Language" },
                doc! { "id": "opt3", "text": "Server Query List" },
                doc! { "id": "opt4", "text": "Sequential Query Logic" }
            ],
            "correct_option_id": "opt1",
            "marks": 10.0,
            "course_id": c1_oid,
            "subject_id": sub2_oid,
            "tags": vec!["database", "sql", "backend"],
            "status": "active",
            "created_at": now_bson
        }
    ];

    questions_col.insert_many(question_docs.clone(), None).await?;
    let qb_col = db.collection::<Document>("qb_questions");
    let _ = qb_col.delete_many(doc! {}, None).await;
    let _ = qb_col.insert_many(question_docs, None).await;
    println!("✅ Question Bank collections seeded (2 Questions in qb_questions & exam_v2_questions)");

    let feedback_col = db.collection::<Document>("question_feedback");
    let _ = feedback_col.delete_many(doc! {}, None).await;

    let feedback_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "question_id": q1_oid,
            "student_id": student1_oid,
            "reported_by": student1_oid,
            "feedback_type": "Error",
            "comment": "Option wording for useEffect mentions functional component lifecycle, but option B has a small typo ('useEfect'). Please correct.",
            "details": "Option wording typo in useEffect.",
            "status": "pending",
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "question_id": q2_oid,
            "student_id": student2_oid,
            "reported_by": student2_oid,
            "feedback_type": "Suggestion",
            "comment": "The SQL acronym question is clear. Adding a short query example in the explanation note would help beginner students.",
            "details": "Suggestion for adding query example.",
            "status": "pending",
            "created_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "question_id": q1_oid,
            "student_id": student3_oid,
            "reported_by": student3_oid,
            "feedback_type": "Typos",
            "comment": "Found typo in explanation text. Has been reviewed and verified by course tutor.",
            "details": "Explanation typo verified.",
            "status": "resolved",
            "created_at": now_bson
        }
    ];

    feedback_col.insert_many(feedback_docs, None).await?;
    println!("✅ Question Feedback collection seeded (3 Feedback Reports)");
    println!("✅ Courses collection seeded (4 Courses)");

    // 4. SEED CERTIFICATES & MARKSHEETS
    let certs_col = db.collection::<Document>("certificates");
    let _ = certs_col.delete_many(doc! {}, None).await;

    let certs_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "student_id": student1_oid,
            "center_id": center1_rec_oid,
            "student_name": "Rohan Shah",
            "enrollment_number": "EN2026001",
            "course": "Full Stack Web Development",
            "course_id": c1_oid,
            "certificate_no": "CERT-2026-8801",
            "center_name": "Scre Central Academy Ahmedabad",
            "file_path": "certificates/CERT-2026-8801.pdf",
            "pdf_url": "/uploads/certificates/CERT-2026-8801.pdf",
            "issued_on": Utc::now().to_rfc3339(),
            "status": "approved",
            "verification_url": "/verify-certificate?cert_no=CERT-2026-8801",
            "certificate_type": "marksheet",
            "attempt_number": 1
        },
        doc! {
            "_id": ObjectId::new(),
            "student_id": student2_oid,
            "center_id": center2_rec_oid,
            "student_name": "Priya Patel",
            "enrollment_number": "EN2026002",
            "course": "Cyber Security & Ethical Hacking",
            "course_id": c2_oid,
            "certificate_no": "CERT-2026-8802",
            "center_name": "Scre Excellence Center Surat",
            "file_path": "certificates/CERT-2026-8802.pdf",
            "pdf_url": "/uploads/certificates/CERT-2026-8802.pdf",
            "issued_on": Utc::now().to_rfc3339(),
            "status": "approved",
            "verification_url": "/verify-certificate?cert_no=CERT-2026-8802",
            "certificate_type": "marksheet",
            "attempt_number": 1
        }
    ];

    certs_col.insert_many(certs_docs, None).await?;
    println!("✅ Certificates & Marksheets collection seeded");

    // 4.5 SEED DOCUMENT REQUESTS
    let doc_req_col = db.collection::<Document>("document_requests");
    let _ = doc_req_col.delete_many(doc! {}, None).await;

    let doc_req_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "student_id": student1_oid,
            "center_id": center1_rec_oid,
            "document_type": "Bonafide Certificate",
            "student_name": "Rohan Shah",
            "course_name": "Full Stack Web Development",
            "notes": "Urgent request for passport & visa verification",
            "status": "pending",
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "student_id": student2_oid,
            "center_id": center2_rec_oid,
            "document_type": "Marksheet Re-issuance",
            "student_name": "Priya Patel",
            "course_name": "Cyber Security & Ethical Hacking",
            "notes": "Duplicate copy required for corporate job interview",
            "status": "approved",
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "student_id": student3_oid,
            "center_id": center3_rec_oid,
            "document_type": "Student ID Card Replacement",
            "student_name": "Amit Kumar",
            "course_name": "Diploma in Computer Applications (DCA)",
            "notes": "Original card damaged during lab practicals",
            "status": "pending",
            "created_at": now_bson,
            "updated_at": now_bson
        }
    ];

    doc_req_col.insert_many(doc_req_docs, None).await?;
    println!("✅ Document Requests collection seeded (3 Requests)");

    // 5. SEED ANNOUNCEMENTS
    let ann_col = db.collection::<Document>("announcements");
    let _ = ann_col.delete_many(doc! {}, None).await;

    let ann_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "title": "🌟 Upcoming National Technical Exam & Internship Drive 2026",
            "content": "All centers and registered students are hereby notified that the National Technical Exam & Placement Drive for Summer 2026 will commence from October 15, 2026.",
            "sender_id": admin_oid,
            "sender_role": "admin",
            "target_type": "allusers",
            "created_at": now_bson,
            "priority": "high",
            "is_edited": false
        }
    ];

    ann_col.insert_many(ann_docs, None).await?;
    println!("✅ Announcements collection seeded");

    // 6. SEED INTERNSHIP POSTINGS
    let postings_col = db.collection::<Document>("internship_postings");
    let _ = postings_col.delete_many(doc! {}, None).await;

    let p1_oid = ObjectId::new();
    let p2_oid = ObjectId::new();
    let p3_oid = ObjectId::new();
    let p4_oid = ObjectId::new();
    let p5_oid = ObjectId::new();
    let p6_oid = ObjectId::new();

    let postings_docs = vec![
        doc! {
            "_id": p1_oid,
            "title": "Full-Stack Web Development Intern (React & Rust/Node)",
            "company_name": "TechVision Solutions Pvt Ltd",
            "company_logo": "https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=150",
            "category": "Web Development",
            "location": "Remote / Hybrid (Ahmedabad Center)",
            "city": "Ahmedabad",
            "district": "Ahmedabad",
            "state": "Gujarat",
            "country": "India",
            "pincode": "380015",
            "duration_months": 6,
            "stipend_type": "paid",
            "stipend_amount": 12000,
            "openings": 5,
            "skills_required": ["React", "TypeScript", "Node.js", "MongoDB", "REST API"],
            "description": "Work on live enterprise web applications, building high-performance frontend interfaces and robust backend APIs.",
            "learning_outcomes": ["Master modern SPA architectures", "Build scalable RESTful microservices", "CI/CD & Cloud Deployment"],
            "department": "Software Engineering",
            "center_id": "CENTRAL-001",
            "center_address": "SG Highway, Ahmedabad",
            "status": "active",
            "ppo_offered": true,
            "ppo_package": "4.5 - 6.0 LPA",
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": p2_oid,
            "title": "Data Analytics & AI Engineering Intern",
            "company_name": "Cognitive Data Labs",
            "company_logo": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=150",
            "category": "Data Science & AI",
            "location": "On-Site (Vadodara Innovation Hub)",
            "city": "Vadodara",
            "district": "Vadodara",
            "state": "Gujarat",
            "country": "India",
            "pincode": "390002",
            "duration_months": 6,
            "stipend_type": "paid",
            "stipend_amount": 15000,
            "openings": 3,
            "skills_required": ["Python", "Pandas", "SQL", "PowerBI", "Scikit-Learn"],
            "description": "Analyze large dataset pipelines, build predictive models, and create interactive BI dashboards for corporate clients.",
            "learning_outcomes": ["Exploratory Data Analysis", "Machine Learning Model Deployment", "Automated ETL Pipelines"],
            "department": "Artificial Intelligence & Analytics",
            "center_id": "VADODARA-003",
            "center_address": "RC Dutt Road, Vadodara",
            "status": "active",
            "ppo_offered": true,
            "ppo_package": "5.0 - 7.5 LPA",
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": p3_oid,
            "title": "Cyber Security & SOC Analyst Intern",
            "company_name": "ShieldNet Cyber Defense",
            "company_logo": "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=150",
            "category": "Cyber Security",
            "location": "On-Site (Surat Excellence Center)",
            "city": "Surat",
            "district": "Surat",
            "state": "Gujarat",
            "country": "India",
            "pincode": "395007",
            "duration_months": 6,
            "stipend_type": "paid",
            "stipend_amount": 14000,
            "openings": 4,
            "skills_required": ["Wireshark", "Linux Shell", "Metasploit", "Nmap", "SIEM Tools"],
            "description": "Perform vulnerability scans, monitor security events in SOC environment, and write incident remediation reports.",
            "learning_outcomes": ["Real-time Threat Hunting", "Network Security Hardening", "ISO 27001 Compliance Auditing"],
            "department": "Information Security",
            "center_id": "SURAT-002",
            "center_address": "Ring Road, Surat",
            "status": "active",
            "ppo_offered": true,
            "ppo_package": "4.8 - 6.5 LPA",
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": p4_oid,
            "title": "Digital Marketing & Growth Hacker Intern",
            "company_name": "Apex Brand Media",
            "company_logo": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=150",
            "category": "Digital Marketing",
            "location": "Hybrid",
            "city": "Surat",
            "district": "Surat",
            "state": "Gujarat",
            "country": "India",
            "pincode": "395007",
            "duration_months": 3,
            "stipend_type": "paid",
            "stipend_amount": 8000,
            "openings": 6,
            "skills_required": ["SEO", "Google Ads", "Social Media Marketing", "Canva", "Content Writing"],
            "description": "Drive lead generation campaigns, optimize search engine rankings, and manage corporate social media profiles.",
            "learning_outcomes": ["ROI-driven Performance Marketing", "Technical SEO Audits", "Analytics & Funnel Tracking"],
            "department": "Growth & Marketing",
            "center_id": "SURAT-002",
            "center_address": "Ring Road, Surat",
            "status": "active",
            "ppo_offered": false,
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": p5_oid,
            "title": "Industrial Robotics & PLC Automation Intern",
            "company_name": "ElectroAutomation Systems",
            "company_logo": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=150",
            "category": "Robotics & Hardware",
            "location": "On-Site",
            "city": "Rajkot",
            "district": "Rajkot",
            "state": "Gujarat",
            "country": "India",
            "pincode": "360004",
            "duration_months": 6,
            "stipend_type": "paid",
            "stipend_amount": 16000,
            "openings": 2,
            "skills_required": ["PLC Programming", "SCADA", "Robotic Arms", "Circuit Design"],
            "description": "Design ladder logic for Siemens/Delta PLCs and assist in installing automated manufacturing lines.",
            "learning_outcomes": ["Industrial Automation Setup", "SCADA Dashboard Control", "Factory Maintenance Safety"],
            "department": "Mechatronics Engineering",
            "center_id": "CENTRAL-001",
            "center_address": "SG Highway, Ahmedabad",
            "status": "active",
            "ppo_offered": true,
            "ppo_package": "5.2 - 7.0 LPA",
            "created_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": p6_oid,
            "title": "Embedded IoT Systems Engineer Intern",
            "company_name": "SmartSens Tech",
            "company_logo": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=150",
            "category": "Embedded & IoT",
            "location": "On-Site",
            "city": "Gandhinagar",
            "district": "Gandhinagar",
            "state": "Gujarat",
            "country": "India",
            "pincode": "382010",
            "duration_months": 6,
            "stipend_type": "paid",
            "stipend_amount": 13000,
            "openings": 4,
            "skills_required": ["Embedded C", "ESP32 / STM32", "MQTT", "PCB Layout"],
            "description": "Develop firmware for smart agriculture and industrial IoT sensors transmitting real-time telemetry over MQTT.",
            "learning_outcomes": ["Microcontroller Firmware Design", "Low-Power Wireless Protocols", "Hardware Debugging"],
            "department": "Hardware R&D",
            "center_id": "CENTRAL-001",
            "center_address": "SG Highway, Ahmedabad",
            "status": "active",
            "ppo_offered": true,
            "ppo_package": "4.2 - 5.8 LPA",
            "created_at": now_bson,
            "updated_at": now_bson
        }
    ];

    postings_col.insert_many(postings_docs, None).await?;
    println!("✅ Internship Postings collection seeded (6 Postings)");

    // 7. SEED INTERNSHIP APPLICATIONS
    let apps_col = db.collection::<Document>("internship_applications");
    let _ = apps_col.delete_many(doc! {}, None).await;

    let apps_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "posting_id": p1_oid,
            "posting_title": "Full-Stack Web Development Intern (React & Rust/Node)",
            "company_name": "TechVision Solutions Pvt Ltd",
            "student_id": intern2_oid,
            "student_name": "Aditya Sharma",
            "student_email": "aditya.intern@scre.in",
            "student_mobile": "9876500222",
            "branch": "Computer Science Engineering",
            "college_name": "Gujarat Technological University (GTU)",
            "center_id": "CENTRAL-001",
            "center_name": "Scre Central Academy Ahmedabad",
            "city": "Ahmedabad",
            "district": "Ahmedabad",
            "state": "Gujarat",
            "country": "India",
            "pincode": "380015",
            "duration_months": 6,
            "department": "Software Engineering",
            "learning_goals": ["Master React and Rust backend development", "Deploy serverless microservices"],
            "joining_date": "2026-06-01",
            "completion_date": "2026-11-30",
            "stipend_amount": 12000,
            "attendance_percentage": 96.5,
            "status": "Active Internship",
            "joining_letter_generated": true,
            "joining_letter_url": "/api/internships/joining-letter/INT-L101",
            "confirmation_letter_generated": true,
            "confirmation_letter_url": "/api/internships/confirmation-letter/INT-L101",
            "completion_letter_generated": false,
            "applied_at": now_bson,
            "updated_at": now_bson
        },
        doc! {
            "_id": ObjectId::new(),
            "posting_id": p2_oid,
            "posting_title": "Data Analytics & AI Engineering Intern",
            "company_name": "Cognitive Data Labs",
            "student_id": intern3_oid,
            "student_name": "Priya Patel",
            "student_email": "priya.intern@scre.in",
            "student_mobile": "9876500333",
            "branch": "Information Technology",
            "college_name": "Parul University Vadodara",
            "center_id": "VADODARA-003",
            "center_name": "Scre Innovation Hub Vadodara",
            "city": "Vadodara",
            "district": "Vadodara",
            "state": "Gujarat",
            "country": "India",
            "pincode": "390002",
            "duration_months": 6,
            "department": "Artificial Intelligence & Analytics",
            "learning_goals": ["Build end-to-end Machine Learning pipelines"],
            "joining_date": "2026-06-15",
            "completion_date": "2026-12-14",
            "stipend_amount": 15000,
            "attendance_percentage": 98.0,
            "status": "Shortlisted",
            "joining_letter_generated": false,
            "confirmation_letter_generated": false,
            "completion_letter_generated": false,
            "applied_at": now_bson,
            "updated_at": now_bson
        }
    ];

    apps_col.insert_many(apps_docs, None).await?;
    println!("✅ Internship Applications collection seeded (2 Applications)");

    // 8. SEED COLLEGES & PARTNERS
    let colleges_col = db.collection::<Document>("colleges");
    let _ = colleges_col.delete_many(doc! {}, None).await;

    let colleges_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "name": "Gujarat Technological University (GTU)",
            "code": "GTU-AHM",
            "city": "Ahmedabad",
            "district": "Ahmedabad",
            "state": "Gujarat",
            "contact_person": "Dr. K. P. Patel (Placement Cell Head)",
            "contact_email": "placement@gtu.ac.in",
            "contact_phone": "079-23267500",
            "mou_signed": true,
            "active_interns_count": 42,
            "placed_students_count": 128,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": ObjectId::new(),
            "name": "Parul University Vadodara",
            "code": "PU-VAD",
            "city": "Vadodara",
            "district": "Vadodara",
            "state": "Gujarat",
            "contact_person": "Prof. Hardik Shah",
            "contact_email": "corporate.relations@paruluniversity.ac.in",
            "contact_phone": "0265-3939888",
            "mou_signed": true,
            "active_interns_count": 35,
            "placed_students_count": 95,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": ObjectId::new(),
            "name": "Maharaja Sayajirao University (MSU)",
            "code": "MSU-VAD",
            "city": "Vadodara",
            "district": "Vadodara",
            "state": "Gujarat",
            "contact_person": "Dr. Sneha Trivedi",
            "contact_email": "tpo@msubaroda.ac.in",
            "contact_phone": "0265-2795555",
            "mou_signed": true,
            "active_interns_count": 28,
            "placed_students_count": 82,
            "created_at": Utc::now().to_rfc3339()
        },
        doc! {
            "_id": ObjectId::new(),
            "name": "Silver Oak University",
            "code": "SOU-AHM",
            "city": "Ahmedabad",
            "district": "Ahmedabad",
            "state": "Gujarat",
            "contact_person": "Manish Joshi",
            "contact_email": "placements@silveroakuni.ac.in",
            "contact_phone": "079-66046300",
            "mou_signed": true,
            "active_interns_count": 19,
            "placed_students_count": 64,
            "created_at": Utc::now().to_rfc3339()
        }
    ];

    colleges_col.insert_many(colleges_docs, None).await?;
    println!("✅ Colleges collection seeded (4 Colleges)");

    // 9. SEED CONTACTS & ENQUIRIES
    let contacts_col = db.collection::<Document>("contacts");
    let _ = contacts_col.delete_many(doc! {}, None).await;

    let contacts_docs = vec![
        doc! {
            "_id": ObjectId::new(),
            "name": "Vikas Parmar",
            "email": "vikas.p@gmail.com",
            "phone": "9879012345",
            "mobile": "9879012345",
            "subject": "Student Internship Application for Cyber Security",
            "message": "I am a 3rd year B.Tech student interested in a 6-month Cyber Security internship at Scre Surat Center.",
            "enquiry_type": "internship",
            "college_name": "Silver Oak University",
            "branch": "Information Technology",
            "duration_preferred": "6 Months",
            "center_preference": "SURAT-002",
            "city": "Surat",
            "district": "Surat",
            "state": "Gujarat",
            "pincode": "395007",
            "created_at": now_bson,
            "status": "pending"
        },
        doc! {
            "_id": ObjectId::new(),
            "name": "Apex Corporate HR Solutions",
            "email": "hr@apexbrands.in",
            "phone": "0261-2445566",
            "mobile": "9824055667",
            "subject": "Corporate Campus Internship & Hiring Partnership",
            "message": "We wish to hire 15 full-stack and digital marketing interns from Scre Central Academy Ahmedabad for our upcoming product launch.",
            "enquiry_type": "corporate_placement",
            "duration_preferred": "6 Months",
            "center_preference": "CENTRAL-001",
            "city": "Ahmedabad",
            "district": "Ahmedabad",
            "state": "Gujarat",
            "pincode": "380015",
            "created_at": now_bson,
            "status": "reviewed"
        }
    ];

    contacts_col.insert_many(contacts_docs, None).await?;
    println!("✅ Contact Enquiries collection seeded (2 Leads)");

    println!("===========================================================");
    println!("🎉 MASTER DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    println!("===========================================================");
    println!("\n🔑 LOGIN CREDENTIALS CHEAT SHEET FOR ALL ROLES:\n");
    println!("1️⃣ SUPER ADMIN PORTAL:");
    println!("   Username: admin");
    println!("   Password: Admin@123  (or password)");
    println!("\n2️⃣ CENTER DASHBOARD:");
    println!("   Ahmedabad Center Username: center");
    println!("   Surat Center Username: center_surat");
    println!("   Vadodara Center Username: center_vadodara");
    println!("   Password: Center@123  (or password)");
    println!("\n3️⃣ STUDENT DASHBOARD:");
    println!("   Student 1 Username: student  (Rohan Shah)");
    println!("   Student 2 Username: student_priya  (Priya Patel)");
    println!("   Student 3 Username: student_amit  (Amit Kumar)");
    println!("   Password: Student@123  (or password)");
    println!("\n4️⃣ INTERNSHIP PORTAL / ATS RESUME BUILDER:");
    println!("   Intern 1 Username: intern  (Aditya Sharma)");
    println!("   Intern 2 Username: intern.aditya  (Aditya Sharma)");
    println!("   Intern 3 Username: intern.priya  (Priya Patel)");
    println!("   Password: Intern@123  (or password)");
    println!("\n5️⃣ STAFF COORDINATOR PORTAL:");
    println!("   Staff Username: staff");
    println!("   Password: password  (or Staff@123)");
    println!("===========================================================");

    Ok(())
}
