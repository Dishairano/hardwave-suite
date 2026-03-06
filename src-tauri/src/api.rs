use crate::models::{AuthResponse, DownloadsResponse, Product};

const BASE_URL: &str = "https://hardwavestudios.com/api";

pub async fn login(email: &str, password: &str) -> Result<AuthResponse, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/auth/login", BASE_URL))
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Login request failed: {}", e))?;

    let body = res.text().await.map_err(|e| format!("Failed to read login response: {}", e))?;

    serde_json::from_str::<AuthResponse>(&body)
        .map_err(|e| format!("Login parse error: {} | body: {}", e, &body[..body.len().min(500)]))
}

pub async fn logout(token: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let _ = client
        .post(format!("{}/auth/logout", BASE_URL))
        .bearer_auth(token)
        .send()
        .await;
    Ok(())
}

pub async fn get_auth_status(token: &str) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/auth/me", BASE_URL))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res.status().is_success())
}

pub async fn get_downloads(token: &str) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/downloads", BASE_URL))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Downloads request failed: {}", e))?;

    let body = res.text().await.map_err(|e| format!("Failed to read downloads response: {}", e))?;

    let data = serde_json::from_str::<DownloadsResponse>(&body)
        .map_err(|e| format!("Downloads parse error: {} | body: {}", e, &body[..body.len().min(500)]))?;

    if !data.success {
        return Err(data.error.unwrap_or("Failed to load downloads".into()));
    }

    Ok(data.products)
}
