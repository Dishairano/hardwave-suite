use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct File {
    pub id: Option<i64>,
    pub file_path: String,
    pub filename: String,
    pub file_type: String,
    pub file_extension: String,
    pub file_size: i64,
    pub hash: String,
    pub created_at: i64,
    pub modified_at: i64,
    pub indexed_at: i64,
    pub duration: Option<f64>,
    pub sample_rate: Option<i32>,
    pub bit_depth: Option<i32>,
    pub channels: Option<i32>,
    pub bpm: Option<f64>,
    pub detected_key: Option<String>,
    pub detected_scale: Option<String>,
    pub energy_level: Option<f64>,
    pub notes: Option<String>,
    pub rating: i32,
    pub color_code: Option<String>,
    pub is_favorite: bool,
    pub use_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUpdate {
    pub notes: Option<String>,
    pub rating: Option<i32>,
    pub color_code: Option<String>,
    pub is_favorite: Option<bool>,
    pub bpm: Option<f64>,
    pub detected_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub category: Option<String>,
    pub color: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagUpdate {
    pub name: Option<String>,
    pub category: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub is_smart: bool,
    pub smart_query: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub file_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionWithFiles {
    pub collection: Collection,
    pub files: Vec<File>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollectionUpdate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub indexed: i32,
    pub duplicates: i32,
    pub errors: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub token: Option<String>,
    pub user: Option<User>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub email: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: Option<bool>,
    pub error: Option<String>,
    #[serde(flatten)]
    pub data: Option<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    #[serde(rename = "totalFiles")]
    pub total_files: i64,
    #[serde(rename = "totalTags")]
    pub total_tags: i64,
    #[serde(rename = "totalCollections")]
    pub total_collections: i64,
    #[serde(rename = "totalFavorites")]
    pub total_favorites: i64,
}
