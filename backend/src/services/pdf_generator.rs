use headless_chrome::{Browser, LaunchOptions, types::PrintToPdfOptions};
use std::fs;
use std::path::PathBuf;
use std::error::Error;

pub struct PdfGenerator;

impl PdfGenerator {
    /// Renders HTML to PDF via headless Chromium.
    ///
    /// Uses a temporary `file://` document instead of a `data:` URL so large templates and
    /// strict CSS (`position: absolute`, `@page` mm sizes) still layout correctly in print mode,
    /// and snap-based Chromium builds don't abort navigation on sandboxed data-URL schemes.
    pub fn html_to_pdf(html_content: &str, output_path: PathBuf) -> Result<(), Box<dyn Error>> {
        println!("Starting PDF generation for: {:?}", output_path);

        let mut builder = LaunchOptions::default_builder();
        builder.headless(true);
        builder.args(vec![
            std::ffi::OsStr::new("--no-sandbox"),
            std::ffi::OsStr::new("--disable-setuid-sandbox"),
            std::ffi::OsStr::new("--disable-dev-shm-usage"),
            std::ffi::OsStr::new("--disable-gpu"),
            std::ffi::OsStr::new("--allow-file-access-from-files"),
            std::ffi::OsStr::new("--disable-web-security"),
        ]);

        // Prefer apt-installed browsers FIRST — snap Chromium has sandbox/navigation issues
        // even with --no-sandbox. Fall back to snap chromium only as last resort.
        let paths = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/snap/bin/chromium"];
        for path in paths {
            if std::path::Path::new(path).exists() {
                println!("Using browser binary at: {}", path);
                builder.path(Some(PathBuf::from(path)));
                break;
            }
        }

        let browser = Browser::new(builder.build()?)?;
        println!("Browser started successfully");

        let tab = browser.new_tab()?;
        println!("New tab opened");

        // Write HTML to a temp file and navigate via file:// — this avoids the ERR_ABORTED
        // snap-Chromium sandbox behavior when loading long data: URLs.
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join(format!(
            "scre-pdf-{}.html",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)?
                .as_nanos()
        ));
        fs::write(&temp_file, html_content)?;
        let file_url = format!(
            "file://{}",
            temp_file.canonicalize()?.to_string_lossy()
        );
        println!("Loading HTML via {}", file_url);

        tab.navigate_to(&file_url)?;
        tab.wait_until_navigated()?;

        // Give a bit more time to load assets + render @page CSS
        std::thread::sleep(std::time::Duration::from_millis(1200));

        let pdf_options = PrintToPdfOptions {
            print_background: Some(true),
            display_header_footer: Some(false),
            prefer_css_page_size: Some(true),
            margin_top: Some(0.0),
            margin_bottom: Some(0.0),
            margin_left: Some(0.0),
            margin_right: Some(0.0),
            paper_width: Some(210.0 / 25.4), // A4 width in inches (210mm)
            paper_height: Some(297.0 / 25.4), // A4 height in inches (297mm)
            scale: Some(0.88), // Scale down slightly more to fit
            ..Default::default()
        };
        let pdf_data = tab.print_to_pdf(Some(pdf_options))?;

        // Clean up temp HTML file (best-effort)
        let _ = fs::remove_file(&temp_file);

        if let Some(parent) = output_path.parent() {
            eprintln!("PdfGenerator: creating parent directory {:?}", parent);
            fs::create_dir_all(parent)?;
        }

        eprintln!("PdfGenerator: writing PDF to {:?}", output_path);
        fs::write(&output_path, pdf_data)?;
        eprintln!("PdfGenerator: successfully wrote PDF to {:?}", output_path);

        // ===== POST-WRITE PDF VALIDATION =====
        let generated_path = output_path.clone();
        eprintln!("[PDF_VALIDATE] Generated PDF Path: {:?}", generated_path);

        match fs::metadata(&generated_path) {
            Ok(meta) => {
                let sz = meta.len();
                eprintln!("[PDF_VALIDATE] Generated PDF Size: {} bytes", sz);
                if sz == 0 {
                    return Err("PDF validation FAILED: file is 0 bytes".into());
                }
            }
            Err(e) => {
                return Err(format!("PDF validation FAILED: cannot stat {:?}: {}", generated_path, e).into());
            }
        }

        match fs::read(&generated_path) {
            Ok(bytes) => {
                let take = std::cmp::min(16, bytes.len());
                let header_bytes: Vec<u8> = bytes.iter().take(take).copied().collect();
                let header_text = String::from_utf8_lossy(&header_bytes);
                eprintln!("[PDF_VALIDATE] First 16 bytes (hex): {}",
                    header_bytes.iter().map(|b| format!("{:02X}", b)).collect::<Vec<_>>().join(" "));
                eprintln!("[PDF_VALIDATE] First 16 bytes (text): {:?}", header_text);
                if !header_text.starts_with("%PDF-") {
                    return Err(format!(
                        "PDF validation FAILED: header does not start with %PDF-. Got header bytes: {:02X?} text: {:?}",
                        header_bytes, header_text
                    ).into());
                }
            }
            Err(e) => {
                return Err(format!("PDF validation FAILED: cannot read {:?}: {}", generated_path, e).into());
            }
        }

        // Also run `file` command (best-effort — not fatal if missing)
        match std::process::Command::new("file").arg(&generated_path).output() {
            Ok(out) if out.status.success() => {
                let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                eprintln!("[PDF_VALIDATE] `file` output: {}", stdout);
                if !stdout.to_lowercase().contains("pdf") {
                    return Err(format!(
                        "PDF validation FAILED: `file` reports non-PDF type: {}", stdout
                    ).into());
                }
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                eprintln!("[PDF_VALIDATE] `file` exited non-zero ({}), stderr: {}", out.status, stderr);
            }
            Err(e) => {
                eprintln!("[PDF_VALIDATE] `file` command unavailable: {}", e);
            }
        }

        Ok(())
    }
}
