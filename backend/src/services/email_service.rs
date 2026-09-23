use anyhow::{Result, anyhow};
use lettre::message::{Message, MultiPart, header};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{SmtpTransport, Transport};
use std::env;

pub async fn send_otp_email(to_email: &str, otp: &str) -> Result<()> {
    let smtp_host = env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.hostinger.com".to_string());
    let smtp_port = env::var("SMTP_PORT")
        .unwrap_or_else(|_| "465".to_string())
        .parse::<u16>()
        .unwrap_or(465);
    let smtp_user = match env::var("SMTP_USER") {
        Ok(u) => u,
        Err(_) => {
            println!("Warning: SMTP_USER not set, skipping email send");
            return Ok(());
        }
    };
    let smtp_pass = match env::var("SMTP_PASS") {
        Ok(p) => p,
        Err(_) => {
            println!("Warning: SMTP_PASS not set, skipping email send");
            return Ok(());
        }
    };

    let logo_url = "https://screduc.com/images/logo.jpeg";

    let html_body = format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Code</title>
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f7f9; }}
                .container {{ max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }}
                .header {{ background-color: #004a89; padding: 30px; text-align: center; }}
                .logo {{ width: 80px; height: 80px; border-radius: 12px; border: 2px solid rgba(255,255,255,0.2); }}
                .content {{ padding: 40px; text-align: center; }}
                .greeting {{ font-size: 18px; font-weight: 600; color: #1a202c; margin-bottom: 10px; }}
                .instruction {{ color: #718096; margin-bottom: 30px; }}
                .otp-container {{ background-color: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; display: inline-block; min-width: 200px; }}
                .otp-code {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #004a89; margin: 0; }}
                .expiry {{ font-size: 13px; color: #a0aec0; margin-top: 20px; font-weight: 500; }}
                .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #edf2f7; }}
                .footer-text {{ font-size: 12px; color: #718096; margin: 5px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="{}" alt="SCRE Logo" class="logo">
                </div>
                <div class="content">
                    <div class="greeting">Hello there!</div>
                    <p class="instruction">To complete your verification, please use the following security code:</p>
                    <div class="otp-container">
                        <h1 class="otp-code">{}</h1>
                    </div>
                    <div class="expiry">This code is valid for <b>5 minutes</b>.</div>
                    <p class="warning">If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
                </div>
                <div class="footer">
                    <div class="footer-text"><b>Sir Chhotu Ram Education Pvt. Ltd.</b></div>
                    <div class="footer-text">IT & Skill Education - ISO 9001-2015 Certified</div>
                    <div class="footer-text">www.screduc.com | info@screduc.com</div>
                    <div class="footer-text" style="margin-top: 10px;">&copy; 2025 SCRE Education. All rights reserved.</div>
                </div>
            </div>
        </body>
        </html>
    "#,
        logo_url, otp
    );

    let text_body = format!(
        "Hello,\n\nYour verification code is: {}\n\nThis OTP is valid for 5 minutes.\n\nDo not share this code with anyone.\n\nRegards,\nSCRE Education",
        otp
    );

    let email = Message::builder()
        .from(format!("SCRE Education <{}>", smtp_user).parse()?)
        .to(to_email.parse()?)
        .subject("Your Verification Code - SCRE Education")
        .multipart(
            MultiPart::alternative()
                .singlepart(
                    lettre::message::SinglePart::builder()
                        .header(header::ContentType::TEXT_PLAIN)
                        .body(text_body),
                )
                .singlepart(
                    lettre::message::SinglePart::builder()
                        .header(header::ContentType::TEXT_HTML)
                        .body(html_body),
                ),
        )?;

    let creds = Credentials::new(smtp_user, smtp_pass);

    let tls_params = TlsParameters::new(smtp_host.clone())?;
    let tls = if smtp_port == 465 {
        Tls::Wrapper(tls_params)
    } else {
        Tls::Required(tls_params)
    };

    let mailer = SmtpTransport::relay(&smtp_host)?
        .credentials(creds)
        .port(smtp_port)
        .tls(tls)
        .build();

    if let Err(e) = mailer.send(&email) {
        println!(
            "[SMTP NOTICE] Could not send OTP email to {} (Error: {:?}). Dev/Console OTP: {}",
            to_email, e, otp
        );
    } else {
        println!("[SMTP SUCCESS] OTP email sent to {}", to_email);
    }

    Ok(())
}

pub async fn send_registration_email(
    to_email: &str,
    full_name: &str,
    reg_no: &str,
    password: &str,
    center_name: &str,
) -> Result<()> {
    let smtp_host = env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.hostinger.com".to_string());
    let smtp_port = env::var("SMTP_PORT")
        .unwrap_or_else(|_| "465".to_string())
        .parse::<u16>()
        .unwrap_or(465);
    let smtp_user = match env::var("SMTP_USER") {
        Ok(u) => u,
        Err(_) => {
            println!("Warning: SMTP_USER not set, skipping email send");
            return Ok(());
        }
    };
    let smtp_pass = match env::var("SMTP_PASS") {
        Ok(p) => p,
        Err(_) => {
            println!("Warning: SMTP_PASS not set, skipping email send");
            return Ok(());
        }
    };

    let html_body = format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #edf2f7; }}
                .header {{ background-color: #004a89; padding: 20px; text-align: center; color: white; }}
                .content {{ padding: 30px; }}
                .credentials {{ background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0; }}
                .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #718096; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Registration Successful!</h1>
                </div>
                <div class="content">
                    <p>Hello <b>{}</b>,</p>
                    <p>Welcome to Sir Chhotu Ram Education. Your registration has been successful under <b>{}</b>.</p>
                    <p>Here are your login credentials to access the student portal:</p>
                    <div class="credentials">
                        <p style="margin: 5px 0;"><b>Registration ID:</b> {}</p>
                        <p style="margin: 5px 0;"><b>Password:</b> {}</p>
                    </div>
                    <p>You can login at <a href="https://screduc.com/login">screduc.com/login</a></p>
                    <p>Please change your password after your first login.</p>
                </div>
                <div class="footer">
                    <p>&copy; 2025 SCRE Education. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    "#,
        full_name, center_name, reg_no, password
    );

    let text_body = format!(
        "Hello {},\n\nYour registration at SCRE Education is successful under {}.\n\nRegistration ID: {}\nPassword: {}\n\nLogin at: https://screduc.com/login",
        full_name, center_name, reg_no, password
    );

    let email = Message::builder()
        .from(format!("SCRE Education <{}>", smtp_user).parse()?)
        .to(to_email.parse()?)
        .subject("Registration Successful - SCRE Education")
        .multipart(
            MultiPart::alternative()
                .singlepart(
                    lettre::message::SinglePart::builder()
                        .header(header::ContentType::TEXT_PLAIN)
                        .body(text_body),
                )
                .singlepart(
                    lettre::message::SinglePart::builder()
                        .header(header::ContentType::TEXT_HTML)
                        .body(html_body),
                ),
        )?;

    let creds = Credentials::new(smtp_user, smtp_pass);
    let tls_params = TlsParameters::new(smtp_host.clone())?;
    let tls = if smtp_port == 465 {
        Tls::Wrapper(tls_params)
    } else {
        Tls::Required(tls_params)
    };
    let mailer = SmtpTransport::relay(&smtp_host)?
        .credentials(creds)
        .port(smtp_port)
        .tls(tls)
        .build();

    mailer.send(&email)?;
    Ok(())
}

pub async fn send_center_registration_email(
    to_email: &str,
    center_name: &str,
    username: &str,
    password: &str,
) -> Result<()> {
    let smtp_host = env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.hostinger.com".to_string());
    let smtp_port = env::var("SMTP_PORT")
        .unwrap_or_else(|_| "465".to_string())
        .parse::<u16>()
        .unwrap_or(465);
    let smtp_user = match env::var("SMTP_USER") {
        Ok(u) => u,
        Err(_) => {
            println!("Warning: SMTP_USER not set, skipping email send");
            return Ok(());
        }
    };
    let smtp_pass = match env::var("SMTP_PASS") {
        Ok(p) => p,
        Err(_) => {
            println!("Warning: SMTP_PASS not set, skipping email send");
            return Ok(());
        }
    };

    let html_body = format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 20px auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                <div style="background: #004a89; padding: 20px; text-align: center; color: white;">
                    <h2>Center Portal Created</h2>
                </div>
                <div style="padding: 30px;">
                    <p>Hello <b>{}</b>,</p>
                    <p>Your regional center portal has been successfully created. You can now login and manage your center.</p>
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                        <p style="margin: 5px 0;"><b>Portal URL:</b> <a href="https://screduc.com/login">screduc.com/login</a></p>
                        <p style="margin: 5px 0;"><b>Username:</b> {}</p>
                        <p style="margin: 5px 0;"><b>Password:</b> {}</p>
                    </div>
                    <p>Please change your password after your first login.</p>
                </div>
            </div>
        </body>
        </html>
    "#,
        center_name, username, password
    );

    let email = Message::builder()
        .from(format!("SCRE Education <{}>", smtp_user).parse()?)
        .to(to_email.parse()?)
        .subject("Center Portal Credentials - SCRE Education")
        .multipart(
            MultiPart::alternative().singlepart(
                lettre::message::SinglePart::builder()
                    .header(header::ContentType::TEXT_HTML)
                    .body(html_body),
            ),
        )?;

    let creds = Credentials::new(smtp_user, smtp_pass);
    let tls_params = TlsParameters::new(smtp_host.clone())?;
    let tls = if smtp_port == 465 {
        Tls::Wrapper(tls_params)
    } else {
        Tls::Required(tls_params)
    };
    let mailer = SmtpTransport::relay(&smtp_host)?
        .credentials(creds)
        .port(smtp_port)
        .tls(tls)
        .build();
    mailer.send(&email)?;
    Ok(())
}

pub async fn send_update_notification_email(
    to_email: &str,
    user_name: &str,
    update_details: &str,
) -> Result<()> {
    let smtp_host = env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.hostinger.com".to_string());
    let smtp_port = env::var("SMTP_PORT")
        .unwrap_or_else(|_| "465".to_string())
        .parse::<u16>()
        .unwrap_or(465);
    let smtp_user = match env::var("SMTP_USER") {
        Ok(u) => u,
        Err(_) => {
            println!("Warning: SMTP_USER not set, skipping email send");
            return Ok(());
        }
    };
    let smtp_pass = match env::var("SMTP_PASS") {
        Ok(p) => p,
        Err(_) => {
            println!("Warning: SMTP_PASS not set, skipping email send");
            return Ok(());
        }
    };

    let html_body = format!(
        r#"
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 20px auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                <div style="background: #ea580c; padding: 20px; text-align: center; color: white;">
                    <h2>Profile Update Notification</h2>
                </div>
                <div style="padding: 30px;">
                    <p>Hello <b>{}</b>,</p>
                    <p>This is to notify you that your profile/documents have been updated in the SCRE system.</p>
                    <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffedd5;">
                        <p style="margin: 5px 0;"><b>Changes:</b></p>
                        <p style="margin: 5px 0;">{}</p>
                    </div>
                    <p>If you did not authorize these changes, please contact our support immediately.</p>
                </div>
            </div>
        </body>
        </html>
    "#,
        user_name, update_details
    );

    let email = Message::builder()
        .from(format!("SCRE Education <{}>", smtp_user).parse()?)
        .to(to_email.parse()?)
        .subject("Profile Update Notification - SCRE Education")
        .multipart(
            MultiPart::alternative().singlepart(
                lettre::message::SinglePart::builder()
                    .header(header::ContentType::TEXT_HTML)
                    .body(html_body),
            ),
        )?;

    let creds = Credentials::new(smtp_user, smtp_pass);
    let tls_params = TlsParameters::new(smtp_host.clone())?;
    let tls = if smtp_port == 465 {
        Tls::Wrapper(tls_params)
    } else {
        Tls::Required(tls_params)
    };
    let mailer = SmtpTransport::relay(&smtp_host)?
        .credentials(creds)
        .port(smtp_port)
        .tls(tls)
        .build();
    mailer.send(&email)?;
    Ok(())
}
