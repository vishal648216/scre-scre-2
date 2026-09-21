
use backend::services::email_service::send_otp_email;
use std::env;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    
    // Ask user for SMTP_PASS? Wait, let's check if it's set!
    let smtp_pass = env::var("SMTP_PASS").unwrap_or_else(|_| {
        eprintln!("Please set SMTP_PASS environment variable!");
        std::process::exit(1);
    });
    
    // Set env vars safely using unsafe blocks
    unsafe {
        env::set_var("SMTP_HOST", "smtp.hostinger.com");
        env::set_var("SMTP_PORT", "465");
        env::set_var("SMTP_USER", "info@screduc.com");
        env::set_var("SMTP_PASS", smtp_pass);
    }
    
    println!("Sending test OTP email to adityapanchalkak@gmail.com...");
    match send_otp_email("adityapanchalkak@gmail.com", "123456").await {
        Ok(_) => println!("Email sent successfully!"),
        Err(e) => eprintln!("Error sending email: {:?}", e),
    }
}
