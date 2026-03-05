use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub email: String,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "isAdmin", default)]
    pub is_admin: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub token: Option<String>,
    pub user: Option<User>,
    pub error: Option<String>,
    pub subscription: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductDownloads {
    pub windows: Option<String>,
    pub mac: Option<String>,
    pub linux: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub version: String,
    pub downloads: ProductDownloads,
    #[serde(rename = "fileSize", default)]
    pub file_size: Option<i64>,
    pub changelog: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadsResponse {
    pub success: bool,
    #[serde(rename = "hasAccess", default)]
    pub has_access: bool,
    #[serde(default)]
    pub products: Vec<Product>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub file_id: String,
    pub percent: u8,
    pub downloaded: u64,
    pub total: u64,
    pub status: String,
    pub install_path: Option<String>,
}
