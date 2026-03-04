mod db;
mod scanner;
mod api;
mod models;
mod websocket;

use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tauri::{Emitter, State};
use db::Database;
use models::*;
use websocket::{AudioState, WebSocketServer};
use websocket::protocol::VstAudioData;
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

pub struct AppState {
    db: Mutex<Database>,
    api_token: Mutex<Option<String>>,
    // VST Bridge WebSocket
    vst_audio_state: Arc<AudioState>,
    vst_server: Mutex<Option<WebSocketServer>>,
}

// ==================== AUTH COMMANDS ====================

#[tauri::command]
async fn login(email: String, password: String, state: State<'_, AppState>) -> Result<AuthResponse, String> {
    let response = api::login(&email, &password).await.map_err(|e| e.to_string())?;
    if let Some(ref token) = response.token {
        let mut token_guard = state.api_token.lock().map_err(|e| e.to_string())?;
        *token_guard = Some(token.clone());
    }
    Ok(response)
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let mut token_guard = state.api_token.lock().map_err(|e| e.to_string())?;
    *token_guard = None;
    Ok(())
}

#[tauri::command]
async fn get_auth_status(state: State<'_, AppState>) -> Result<bool, String> {
    let token_guard = state.api_token.lock().map_err(|e| e.to_string())?;
    Ok(token_guard.is_some())
}

// ==================== FILE COMMANDS ====================

#[tauri::command]
async fn get_files(limit: Option<i64>, offset: Option<i64>, state: State<'_, AppState>) -> Result<Vec<File>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_files(limit.unwrap_or(100), offset.unwrap_or(0)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_file_by_id(id: i64, state: State<'_, AppState>) -> Result<Option<File>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_file_by_id(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_files(query: String, limit: Option<i64>, offset: Option<i64>, state: State<'_, AppState>) -> Result<Vec<File>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_files(&query, limit.unwrap_or(100), offset.unwrap_or(0)).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_file(id: i64, updates: FileUpdate, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_file(id, &updates).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_file(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_file(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_files(ids: Vec<i64>, state: State<'_, AppState>) -> Result<usize, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_files(&ids).map_err(|e| e.to_string())
}

// ==================== FOLDER SCANNING ====================

#[tauri::command]
async fn scan_folder(path: String, state: State<'_, AppState>) -> Result<ScanResult, String> {
    // Scan files (async)
    let files = scanner::scan_folder(&path).await.map_err(|e| e.to_string())?;

    // Do database work in a block to drop the lock before await
    let (indexed, duplicates, token, files_for_sync) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut indexed = 0;
        let mut duplicates = 0;

        for file in &files {
            match db.insert_file(file) {
                Ok(_) => indexed += 1,
                Err(e) if e.to_string().contains("UNIQUE") => duplicates += 1,
                Err(e) => return Err(e.to_string()),
            }
        }

        let token = state.api_token.lock().map_err(|e| e.to_string())?.clone();
        (indexed, duplicates, token, files.clone())
    };

    // Sync to cloud if authenticated (after releasing locks)
    if let Some(token) = token {
        let _ = api::sync_files(&token, &files_for_sync).await;
    }

    Ok(ScanResult { indexed, duplicates, errors: 0 })
}

// ==================== TAG COMMANDS ====================

#[tauri::command]
async fn get_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_tags().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_tag(name: String, category: String, color: String, state: State<'_, AppState>) -> Result<Tag, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_tag(&name, &category, &color).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_tag(id: i64, updates: TagUpdate, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_tag(
        id,
        updates.name.as_deref(),
        updates.category.as_deref(),
        updates.color.as_deref()
    ).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_tag(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_tag(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn tag_files(file_ids: Vec<i64>, tag_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.tag_files(&file_ids, &tag_ids).map_err(|e| e.to_string())
}

#[tauri::command]
async fn untag_files(file_ids: Vec<i64>, tag_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.untag_files(&file_ids, &tag_ids).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_file_tags(file_id: i64, state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_file_tags(file_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_files_by_tag(tag_id: i64, limit: Option<i64>, offset: Option<i64>, state: State<'_, AppState>) -> Result<Vec<File>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_files_by_tag(tag_id, limit.unwrap_or(100), offset.unwrap_or(0)).map_err(|e| e.to_string())
}

// ==================== COLLECTION COMMANDS ====================

#[tauri::command]
async fn get_collections(state: State<'_, AppState>) -> Result<Vec<Collection>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_collections().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_collection_by_id(id: i64, state: State<'_, AppState>) -> Result<Option<CollectionWithFiles>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_collection_by_id(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_collection(name: String, description: Option<String>, color: Option<String>, state: State<'_, AppState>) -> Result<Collection, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.create_collection(&name, description.as_deref(), color.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_collection(id: i64, updates: CollectionUpdate, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.update_collection(
        id,
        updates.name.as_deref(),
        updates.description.as_deref(),
        updates.color.as_deref()
    ).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_collection(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.delete_collection(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_files_to_collection(collection_id: i64, file_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.add_files_to_collection(collection_id, &file_ids).map_err(|e| e.to_string())
}

#[tauri::command]
async fn remove_files_from_collection(collection_id: i64, file_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.remove_files_from_collection(collection_id, &file_ids).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_collection_files(collection_id: i64, state: State<'_, AppState>) -> Result<Vec<File>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_collection_files(collection_id).map_err(|e| e.to_string())
}

// ==================== STATS COMMAND ====================

#[tauri::command]
async fn get_stats(state: State<'_, AppState>) -> Result<Stats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_stats().map_err(|e| e.to_string())
}

// ==================== VST BRIDGE COMMANDS ====================

#[tauri::command]
async fn start_websocket_server(port: Option<u16>, state: State<'_, AppState>) -> Result<(), String> {
    let port = port.unwrap_or(9847);

    // Check if already running
    {
        let server_guard = state.vst_server.lock().map_err(|e| e.to_string())?;
        if let Some(ref server) = *server_guard {
            if server.is_running() {
                return Ok(()); // Already running
            }
        }
    }

    // Create and start new server
    let server = WebSocketServer::new(Arc::clone(&state.vst_audio_state));
    server.start(port).await?;

    // Store server
    let mut server_guard = state.vst_server.lock().map_err(|e| e.to_string())?;
    *server_guard = Some(server);

    Ok(())
}

#[tauri::command]
async fn stop_websocket_server(state: State<'_, AppState>) -> Result<(), String> {
    let mut server_guard = state.vst_server.lock().map_err(|e| e.to_string())?;
    if let Some(ref server) = *server_guard {
        server.stop();
    }
    *server_guard = None;
    Ok(())
}

#[tauri::command]
async fn is_vst_connected(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.vst_audio_state.is_connected())
}

#[tauri::command]
async fn get_vst_audio_data(state: State<'_, AppState>) -> Result<VstAudioData, String> {
    Ok(state.vst_audio_state.get_audio_data())
}

#[tauri::command]
async fn is_websocket_server_running(state: State<'_, AppState>) -> Result<bool, String> {
    let server_guard = state.vst_server.lock().map_err(|e| e.to_string())?;
    if let Some(ref server) = *server_guard {
        Ok(server.is_running())
    } else {
        Ok(false)
    }
}

// ==================== DOWNLOADS & INSTALL ====================

#[cfg(target_os = "windows")]
fn vst_install_dir() -> Result<PathBuf, String> {
    Ok(PathBuf::from(r"C:\Program Files\Common Files\VST3"))
}

#[cfg(target_os = "macos")]
fn vst_install_dir() -> Result<PathBuf, String> {
    Ok(PathBuf::from("/Library/Audio/Plug-Ins/VST3"))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn vst_install_dir() -> Result<PathBuf, String> {
    dirs::home_dir()
        .ok_or_else(|| "Cannot determine home directory".to_string())
        .map(|h| h.join(".vst3"))
}

fn get_install_path(category: &str, product_name: &str, filename: &str) -> Result<PathBuf, String> {
    match category {
        "vst" | "preset_pack" => Ok(vst_install_dir()?.join(filename)),
        _ => {
            let downloads = dirs::download_dir()
                .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
                .ok_or_else(|| "Cannot determine downloads directory".to_string())?;
            Ok(downloads.join("Hardwave").join(product_name).join(filename))
        }
    }
}

fn get_install_base_dir(category: &str) -> Result<PathBuf, String> {
    match category {
        "vst" | "preset_pack" => vst_install_dir(),
        _ => {
            let downloads = dirs::download_dir()
                .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
                .ok_or_else(|| "Cannot determine downloads directory".to_string())?;
            Ok(downloads.join("Hardwave"))
        }
    }
}

#[tauri::command]
async fn get_purchases(state: State<'_, AppState>) -> Result<Vec<Purchase>, String> {
    let token = {
        let guard = state.api_token.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or_else(|| "Not authenticated".to_string())?
    };
    api::get_purchases(&token).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn download_and_install_product(
    file_id: String,
    url: String,
    filename: String,
    category: String,
    product_name: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let token = {
        let guard = state.api_token.lock().map_err(|e| e.to_string())?;
        guard.clone().ok_or_else(|| "Not authenticated".to_string())?
    };

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let total = response.content_length().unwrap_or(0);
    let temp_path = std::env::temp_dir().join(&filename);
    let mut file = tokio::fs::File::create(&temp_path).await.map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let percent = if total > 0 { downloaded * 100 / total } else { 0 };
        let _ = app.emit("download://progress", serde_json::json!({
            "file_id": file_id,
            "percent": percent,
            "downloaded": downloaded,
            "total": total,
            "status": "downloading"
        }));
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    let _ = app.emit("download://progress", serde_json::json!({
        "file_id": file_id, "percent": 100,
        "downloaded": downloaded, "total": total,
        "status": "installing"
    }));

    let install_path = get_install_path(&category, &product_name, &filename)?;
    if let Some(parent) = install_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    tokio::fs::copy(&temp_path, &install_path).await.map_err(|e| e.to_string())?;
    let _ = tokio::fs::remove_file(&temp_path).await;

    let install_path_str = install_path.to_string_lossy().to_string();
    let _ = app.emit("download://progress", serde_json::json!({
        "file_id": file_id, "percent": 100,
        "downloaded": downloaded, "total": total,
        "status": "installed",
        "install_path": install_path_str
    }));

    Ok(install_path_str)
}

#[tauri::command]
async fn open_install_folder(category: String) -> Result<(), String> {
    let path = get_install_base_dir(&category)?;
    tokio::fs::create_dir_all(&path).await.map_err(|e| e.to_string())?;
    let path_str = path.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(&path_str).spawn().map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(&path_str).spawn().map_err(|e| e.to_string())?;

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    std::process::Command::new("xdg-open").arg(&path_str).spawn().map_err(|e| e.to_string())?;

    Ok(())
}

// ==================== APP ENTRY ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            }

            Ok(())
        })
        .manage(AppState {
            db: Mutex::new(db),
            api_token: Mutex::new(None),
            vst_audio_state: Arc::new(AudioState::new()),
            vst_server: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            login,
            logout,
            get_auth_status,
            // Files
            get_files,
            get_file_by_id,
            search_files,
            update_file,
            delete_file,
            delete_files,
            scan_folder,
            // Tags
            get_tags,
            create_tag,
            update_tag,
            delete_tag,
            tag_files,
            untag_files,
            get_file_tags,
            get_files_by_tag,
            // Collections
            get_collections,
            get_collection_by_id,
            create_collection,
            update_collection,
            delete_collection,
            add_files_to_collection,
            remove_files_from_collection,
            get_collection_files,
            // Stats
            get_stats,
            // Downloads
            get_purchases,
            download_and_install_product,
            open_install_folder,
            // VST Bridge
            start_websocket_server,
            stop_websocket_server,
            is_vst_connected,
            get_vst_audio_data,
            is_websocket_server_running,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
