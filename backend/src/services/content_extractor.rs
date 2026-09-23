use mongodb::Database;
use futures::stream::StreamExt;
use crate::models::cms::CMSItem;
use crate::models::blog::Blog;
use crate::models::news::News;
use crate::models::course::Course;
use crate::models::course_category::CourseCategory;

pub async fn extract_all_content(db: &Database) -> Vec<String> {
    let mut texts = Vec::new();

    // 1. Fetch CMS content
    let cms_coll = db.collection::<CMSItem>("cms_items");
    if let Ok(mut cursor) = cms_coll.find(None, None).await {
        while let Some(Ok(item)) = cursor.next().await {
            texts.push(item.title);
            if let Some(d) = item.description { texts.push(d); }
            if let Some(c) = item.content { texts.push(c); }
            if let Some(des) = item.designation { texts.push(des); }
            if let Some(spec) = item.specialization { texts.push(spec); }
            if let Some(bt) = item.button_text { texts.push(bt); }
            if let Some(t) = item.tag { texts.push(t); }
            if let Some(h) = item.highlight { texts.push(h); }
        }
    }

    // 2. Fetch blog posts
    let blog_coll = db.collection::<Blog>("blogs");
    if let Ok(mut cursor) = blog_coll.find(None, None).await {
        while let Some(Ok(post)) = cursor.next().await {
            texts.push(post.title);
            texts.push(post.content);
            if let Some(mt) = post.meta_title { texts.push(mt); }
            if let Some(md) = post.meta_description { texts.push(md); }
        }
    }

    // 3. Fetch news/articles
    let news_coll = db.collection::<News>("news");
    if let Ok(mut cursor) = news_coll.find(None, None).await {
        while let Some(Ok(n)) = cursor.next().await {
            texts.push(n.title);
            texts.push(n.content);
            if let Some(cat) = n.category { texts.push(cat); }
            if let Some(mt) = n.meta_title { texts.push(mt); }
            if let Some(md) = n.meta_description { texts.push(md); }
        }
    }

    // 4. Fetch Courses
    let course_coll = db.collection::<Course>("courses");
    if let Ok(mut cursor) = course_coll.find(None, None).await {
        while let Some(Ok(c)) = cursor.next().await {
            texts.push(c.course_name);
            if let Some(d) = c.description { texts.push(d); }
            if let Some(s) = c.syllabus { texts.push(s); }
            if let Some(e) = c.eligibility { texts.push(e); }
        }
    }

    // 5. Fetch Course Categories
    let cat_coll = db.collection::<CourseCategory>("course_categories");
    if let Ok(mut cursor) = cat_coll.find(None, None).await {
        while let Some(Ok(c)) = cursor.next().await {
            texts.push(c.name);
            if let Some(d) = c.description { texts.push(d); }
        }
    }

    // 6. Static fallback content (UI labels and sections)
    let static_ui = vec![
        "Welcome to CodeArya",
        "Start your journey",
        "Contact us",
        "Build Your Future with",
        "IT & Skill Education",
        "Empowering students with industry-ready skills through certified computer courses and vocational training programs.",
        "Powered by CodeArya",
        "All Rights Reserved",
        "Industry Insights",
        "For Future Professionals",
        "Knowledge Center",
        "Explore All Articles",
        "Featured Article",
        "Career Growth",
        "Web Development Roadmap for Students",
        "Design Industry",
        "Read More",
        "Learn More",
        "Apply Now",
        "Search",
        "Latest News",
        "Our Blog",
        "Featured Courses",
        "Why Choose Us",
        "Our Teachers",
        "Admission Process",
        "Student Feedback",
        "Our Partners",
        "Get in Touch",
        "Quick Links",
        "Support",
        "Follow Us",
        "Why Choose Us",
        "We Don’t Just Teach —",
        "We Build Careers",
        "Our mission is to provide practical knowledge, industry exposure, and complete placement support so students can confidently enter the competitive job market.",
        "Real-world project based training instead of only theoretical classes.",
        "Dedicated placement cell with interview preparation & resume guidance.",
        "Updated curriculum aligned with current industry tools & technologies.",
        "Personalized mentoring and doubt-clearing support throughout the course.",
        "Explore Courses",
        "Certified Courses",
        "Industry-recognized certifications that boost your resume and career.",
        "Expert Faculty",
        "Experienced trainers with real industry exposure and teaching excellence.",
        "Practical Training",
        "Hands-on lab sessions with real-world projects and assignments.",
        "Updated Curriculum",
        "Regularly updated syllabus aligned with current industry demands.",
        "Placement Support",
        "100% placement assistance with interview prep and job referrals.",
        "Modern Infrastructure",
        "AC labs, high-speed internet, and latest software tools.",
        "Meet Our Expert Trainers",
        "Our experienced faculty members bring real industry knowledge and practical expertise to ensure students receive career-focused training.",
        "Our Faculty",
        "How to Join",
        "Admission Process",
        "Enquiry",
        "Fill the enquiry form or visit our center for counseling.",
        "Counseling",
        "Get personalized course guidance based on your goals.",
        "Enrollment",
        "Complete admission formalities and start your journey.",
        "Exam",
        "Appear for regular assessments and final examinations.",
        "Certification",
        "Complete your course and receive industry-recognized certificate.",
        "Step",
        "Sir Chhotu Ram Education Pvt. Ltd.",
        "IT & Skill Education",
        "Empowering students with industry-ready IT skills and vocational training for a brighter future.",
        "Home",
        "About",
        "Courses",
        "Franchise",
        "Student Zone",
        "Gallery",
        "Blog",
        "Downloads",
        "FAQ",
        "Shop",
        "Contact",
        "Popular Courses",
        "DCA",
        "ADCA",
        "Tally with GST",
        "Web Designing",
        "Graphic Designing",
        "Spoken English",
        "© 2026 Sir Chhotu Ram Education Pvt. Ltd. All rights reserved.",
        "About Us",
        "Shaping Futures Since Day One",
        "Who We Are",
        "is a premier institute dedicated to providing quality computer education and skill development training. We bridge the gap between education and employment through industry-relevant courses.",
        "With 10+ years of experience, 5000+ trained students, and a 95% placement rate, we are the most trusted IT training institute in the region.",
        "Government Recognized",
        "ISO Certified",
        "Experienced Faculty",
        "Modern Labs",
        "Years Experience",
        "Students Trained",
        "Placement Rate",
        "Courses Available",
        "Our Mission",
        "To empower youth with practical IT skills and vocational training that leads to employment and entrepreneurship.",
        "Our Vision",
        "To become the most trusted skill development institute producing industry-ready professionals.",
        "Our Values",
        "Quality education, student-first approach, industry partnerships, and commitment to excellence.",
        "🎓 Admissions Open 2026",
        "Apply Now — It's Free",
        "5000+ Alumni",
        "100% Placement",
        "About SCRE",
        "Education That transforms Into Careers",
        "For over a decade, SCRE has empowered students with practical, industry-aligned learning experiences that translate into real professional success.",
        "Begin Your Journey",
        "Our Journey",
        "Established",
        "Expansion of Academic Network",
        "Built a strong franchise ecosystem ensuring standardized quality education.",
        "Placement-Driven Curriculum",
        "Introduced industry-aligned programs with real-world project training.",
        "Digital Transformation",
        "Integrated modern tools, labs, and digital infrastructure for advanced learning.",
        "Founded with a mission to bridge the gap between academic education and industry demand, SCRE has evolved into a trusted institution offering professional courses in technology, design, finance, and skill development.",
        "Our commitment to structured training, standardized curriculum, and placement-focused learning has helped thousands of students build sustainable careers.",
        "We continuously upgrade our academic framework to align with global digital transformation trends.",
        "Message From The Director",
        "“Our vision has always been to create a skill-driven ecosystem where students are not only educated but professionally prepared to thrive in competitive industries. At SCRE, we believe that true learning goes beyond textbooks — it requires practical exposure, discipline, adaptability, and a deep understanding of industry expectations.”",
        "We remain committed to innovation, continuous improvement, and maintaining the highest standards of educational excellence across all our centers.",
        "Director, SCRE Pvt. Ltd.",
        "Recognitions & Certifications",
        "Trusted. Verified.",
        "Recognized.",
        "Our certifications and registrations reflect our commitment to quality, compliance, and consistent learning standards across all centers.",
        "MSME Registered",
        "Officially recognized under MSME for trusted operations and verified institution identity.",
        "Company Act 2013 Registered",
        "Registered as a compliant organization with verified legal structure and credibility.",
        "Quality standards aligned to ensure structured training and consistent outcomes.",
        "Get In Touch",
        "Contact Us / Enquiry Form",
        "Send Us Your Enquiry",
        "Thank you! We'll contact you soon.",
        "Your Full Name",
        "Phone Number",
        "Email Address (Optional)",
        "Select Course",
        "Search center by name or code...",
        "Select Center (Admin Default)",
        "Your Message (Optional)",
        "Submitting...",
        "Submit Enquiry",
        "Contact Information",
        "Phone",
        "Email",
        "Address",
        "Location Map",
        "Industry Ready Skill",
        "Computer Programs",
        "Previous courses",
        "Next courses",
        "No courses published yet. Add courses in the admin dashboard.",
        "View Details",
        "View All Courses",
        "Search & Filter",
        "results",
        "Search courses...",
        "Clear search",
        "Categories",
        "All",
        "Sort By",
        "Sort",
        "Recommended",
        "Price: Low to High",
        "Price: High to Low",
        "Duration",
        "Reset Filters",
        "An ISO 9001-2015 Certified Organization",
        "Registered Under The Company ACT 2013 By The Ministry Of Corporate Affairs",
        "Ministry of Micro, Small & Medium Enterprises,",
        "Government of India",
        "Enquiry Now",
        "Verification Letter",
        "Franchise Opportunity",
        "Apply Franchise",
        "Franchise Login",
        "Support System",
        "Our Partners",
        "Franchise Requirements",
        "Why us",
        "Centers",
        "Student Login",
        "Student Registration",
        "Student Internship",
        "Student Inquiry",
        "Apply Now — It's Free",
        "View Courses",
        "Microsoft",
        "Google",
        "Adobe",
        "Tally Solutions",
        "NSDC",
        "NIELIT",
        "PMKVY",
        "Skill India",
        "ISO Certified",
        "# 785/10 Main Bazar Jeweler Market , opposite N.R, Jeweler, Jind, Haryana 126102",
        "Mon - Fri: 10.00 am - 06.00 pm",
        "Verification Letter",
        "Enquiry Now",
        "Sir Chhotu Ram Education Pvt. Ltd.",
        "IT & Skill Education",
        "SIR CHHOTU RAM EDUCATION PVT. LTD.",
        "An ISO 9001-2015 Certified Organization",
        "Registered Under The Company ACT 2013 By The Ministry Of Corporate Affairs",
        "Ministry of Micro, Small & Medium Enterprises,",
        "Government of India",
        "Founded",
        "Students",
        "Courses",
        "Placements",
        "Available Programs",
        "Explore Courses",
        "Designed with structured learning, practical exposure and clear outcomes.",
        "Showing",
        "courses",
        "No courses found",
        "Try a different keyword or switch category.",
        "Reset Filters",
        "Details",
        "Enquire",
        "All",
        "Computer Labs",
        "Classrooms",
        "Events",
        "Placements",
        "Gallery",
        "Life at SCRE",
        "A visual journey of our training sessions, events, and student activities across SCRE centers.",
        "View Image",
        "Frequently Asked Questions",
        "Find answers to common questions about our courses, certifications, and franchise opportunities.",
        "No FAQs found at the moment.",
        "Still have questions?",
        "Contact Support",
        "Student Zone",
        "Access attendance, certificates, announcements, and typing practice.",
        "Use your student account to access your dashboard.",
        "Go to Login",
        "Certificates",
        "View and download your issued certificates.",
        "Typing Practice",
        "Practice your typing and track progress.",
        "Downloads &",
        "Resources",
        "Access official brochures, application forms, syllabus, and other important documents.",
        "Search documents...",
        "No documents found.",
        "Official document for reference and download.",
        "Size",
        "Type",
        "N/A",
        "FILE",
        "Download Resource",
        "Other Resources",
        "SCRE Verification",
        "Authenticating Credentials...",
        "Verification Failed",
        "Please ensure the registration number is correct or contact your study center for assistance.",
        "Status: Verified",
        "This document is authentic and registered in our database.",
        "Certificate No.",
        "Student Name",
        "Official Candidate",
        "Course",
        "Issued On",
        "AN ISO 9001-2015 CERTIFIED ORGANIZATION",
        "Student Shop",
        "Supporting student creativity and craftsmanship",
        "Search products...",
        "Loading Products...",
        "No products found",
        "Try adjusting your search or filters",
        "Latest",
        "Admissions Open 2026 – Apply Now for Certified Diploma & Skill Courses.",
        "Franchise Registration Open – Start Your Own Training Center Today.",
        "Students Trained",
        "Courses Offered",
        "Placements Done",
        "Years Experience",
        "Success Stories",
        "Our Students, Our Pride",
        "Be the first student to share your success story!",
        "Verified Student",
        "Computer Lab",
        "Modern air-conditioned labs with latest high-performance systems.",
        "Interactive Classroom",
        "Smart boards & interactive live sessions.",
        "Seminar Hall",
        "Guest lectures & industry workshops.",
        "Placement Drive",
        "Campus recruitment & mock interviews.",
        "Award Ceremony",
        "Celebrating student excellence.",
        "Experience Our Campus Life",
        "Explore our modern infrastructure, learning environment and student success moments.",
        "Ready to Start Your Career Journey?",
        "Don't wait! Admissions are open. Enroll now and take the first step towards a successful career in IT.",
        "Apply Now — Free Counseling",
        "📞 Call Us Now",
        "Please enter an valid phone number (10-15 digits)",
        "Failed to submit enquiry. Please try again.",
        "An error occurred. Please try again later.",
        "Search center by name or code...",
        "Select Center (Admin Default)",
        "Thank you! We'll contact you soon.",
        "Your Full Name",
        "Phone Number",
        "Email Address (Optional)",
        "Your Message (Optional)",
        "Knowledge Center",
        "Industry Insights",
        "For Future Professionals",
        "Stay ahead with expert-written articles covering technology, marketing, finance, design, and career development. Our research-driven content delivers practical insights, industry analysis, and real-world strategies to help you build skills, make informed decisions, and remain competitive in an evolving job market.",
        "Explore All Articles",
        "Featured Article",
        "Top IT Skills in 2026 You Must Learn",
        "A strategic breakdown of high-demand technical skills shaping the global employment market.",
        "Jan 12, 2026",
        "6 min read",
        "Read More",
        "Career Growth",
        "Web Development Roadmap for Students",
        "Step-by-step progression from beginner to full stack mastery.",
        "Design Industry",
        "Why Graphic Designing Is Future-Proof",
        "Understanding creative economy growth and demand trends.",
        "Building Futures at SCRE",
        "Students building their future with SCRE through quality education and industry-recognized certifications.",
        "Aman Kumar",
        "Digital Marketing",
        "Priya Sharma",
        "Graphic Designing",
        "Rahul Singh",
        "Web Development",
        "Neha Verma",
        "Tally with GST",
        "Rohit Malik",
        "Computer Basics",
        "Sonia Gupta",
        "Data Entry",
        "Universities Joined with",
        "Partnering with recognized universities and institutions to deliver certified and industry-relevant education programs.",
        "Our Partners",
        "Partner 1",
        "Partner 2",
        "Partner 3",
        "Partner 4",
        "Partner 5",
        "Partner 6",
        "Our",
        "Partners",
        "Rajesh Verma",
        "Senior Web Development Trainer",
        "8+ Years Experience",
        "Neha Sharma",
        "Accounting & GST Expert",
        "6+ Years Experience",
        "Amit Kapoor",
        "Graphic Design Specialist",
        "7+ Years Experience",
        "Pooja Malik",
        "Spoken English Trainer",
        "5+ Years Experience",
        "Expert Trainer",
        "Our Faculty",
        "Meet Our Expert Trainers",
        "Our experienced faculty members bring real industry knowledge and practical expertise to ensure students receive career-focused training.",
        "Logged in successfully",
        "An error occurred during login"
    ];
    
    for s in static_ui {
        texts.push(s.to_string());
    }

    // Clean and filter
    let mut cleaned_texts: Vec<String> = texts.into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .filter(|s| !is_id_or_number(s))
        .filter(|s| !is_url_or_email(s))
        .collect();

    cleaned_texts.sort();
    cleaned_texts.dedup();

    cleaned_texts
}

fn is_id_or_number(s: &str) -> bool {
    // Check if it's just a number or an ID-like string (hexadecimal, 24 chars)
    if s.chars().all(|c| c.is_numeric()) { return true; }
    if s.len() == 24 && s.chars().all(|c| c.is_ascii_hexdigit()) { return true; }
    false
}

fn is_url_or_email(s: &str) -> bool {
    s.contains("http://") || s.contains("https://") || s.contains("@")
}
