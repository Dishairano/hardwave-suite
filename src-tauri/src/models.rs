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
pub struct DownloadFile {
    pub id: String,
    pub filename: String,
    pub file_size: i64,
    pub platform: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub version: String,
    pub category: String,
    pub description: String,
    pub thumbnail_url: Option<String>,
    pub files: Vec<DownloadFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Purchase {
    pub id: String,
    pub product: Product,
    pub purchased_at: String,
    pub license_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurchasesResponse {
    pub purchases: Vec<Purchase>,
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
