use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::models::{AuthResponse, File, Tag, Collection, Stats, Purchase};

const API_BASE: &str = "https://hardwavestudios.com/api";

#[derive(Serialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct TagsResponse {
    tags: Vec<Tag>,
}

#[derive(Deserialize)]
struct CollectionsResponse {
    collections: Vec<Collection>,
}

#[derive(Serialize)]
struct SyncRequest {
    files: Vec<FileSyncData>,
}

#[derive(Serialize, Clone)]
struct FileSyncData {
    file_path: String,
    filename: String,
    file_type: String,
    file_size: i64,
    hash: String,
    duration: Option<f64>,
    sample_rate: Option<i32>,
    bit_depth: Option<i32>,
    bpm: Option<f64>,
    detected_key: Option<String>,
}

#[derive(Serialize)]
struct CreateTagRequest {
    name: String,
    category: String,
    color: String,
}

pub async fn login(email: &str, password: &str) -> Result<AuthResponse, reqwest::Error> {
    let client = Client::new();
    let response = client
        .post(format!("{}/auth/login", API_BASE))
        .json(&LoginRequest {
            email: email.to_string(),
            password: password.to_string(),
        })
        .send()
        .await?
        .json::<AuthResponse>()
        .await?;

    Ok(response)
}

pub async fn get_tags(token: &str) -> Result<Vec<Tag>, reqwest::Error> {
    let client = Client::new();
    let response = client
        .get(format!("{}/library/tags", API_BASE))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?
        .json::<TagsResponse>()
        .await?;

    Ok(response.tags)
}

pub async fn create_tag(token: &str, name: &str, category: &str, color: &str) -> Result<Tag, reqwest::Error> {
    let client = Client::new();
    let response = client
        .post(format!("{}/library/tags", API_BASE))
        .header("Authorization", format!("Bearer {}", token))
        .json(&CreateTagRequest {
            name: name.to_string(),
            category: category.to_string(),
            color: color.to_string(),
        })
        .send()
        .await?
        .json::<Tag>()
        .await?;

    Ok(response)
}

pub async fn get_collections(token: &str) -> Result<Vec<Collection>, reqwest::Error> {
    let client = Client::new();
    let response = client
        .get(format!("{}/library/collections", API_BASE))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?
        .json::<CollectionsResponse>()
        .await?;

    Ok(response.collections)
}

pub async fn get_stats(token: &str) -> Result<Stats, reqwest::Error> {
    let client = Client::new();
    let response = client
        .get(format!("{}/library/stats", API_BASE))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?
        .json::<Stats>()
        .await?;

    Ok(response)
}

#[derive(Deserialize)]
struct PurchasesResponse {
    purchases: Vec<Purchase>,
}

pub async fn get_purchases(token: &str) -> Result<Vec<Purchase>, reqwest::Error> {
    let client = Client::new();
    let response = client
        .get(format!("{}/user/purchases", API_BASE))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?
        .json::<PurchasesResponse>()
        .await?;

    Ok(response.purchases)
}

pub async fn sync_files(token: &str, files: &[File]) -> Result<(), reqwest::Error> {
    let client = Client::new();

    let sync_data: Vec<FileSyncData> = files.iter().map(|f| FileSyncData {
        file_path: f.file_path.clone(),
        filename: f.filename.clone(),
        file_type: f.file_type.clone(),
        file_size: f.file_size,
        hash: f.hash.clone(),
        duration: f.duration,
        sample_rate: f.sample_rate,
        bit_depth: f.bit_depth,
        bpm: f.bpm,
        detected_key: f.detected_key.clone(),
    }).collect();

    // Sync in batches of 50
    for chunk in sync_data.chunks(50) {
        client
            .post(format!("{}/library/files/sync", API_BASE))
            .header("Authorization", format!("Bearer {}", token))
            .json(&SyncRequest {
                files: chunk.to_vec(),
            })
            .send()
            .await?;
    }

    Ok(())
}
