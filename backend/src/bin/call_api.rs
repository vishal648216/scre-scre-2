
use reqwest;
use dotenvy;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let port = std::env::var("PORT").unwrap_or_else(|_| "3008".into());
    let url = format!("http://localhost:{}/api/blogs", port);
    println!("Calling: {}", url);
    let response = reqwest::get(url).await.expect("request failed");
    println!("Status: {}", response.status());
    let body = response.text().await.expect("failed to get body");
    println!("Body: {}", body);
}
