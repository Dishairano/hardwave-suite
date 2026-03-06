mod api;
mod models;

use models::DownloadProgress;
use std::sync::Mutex;
use tauri::{Emitter, State};
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

pub struct AppState {
    pub api_token: Mutex<Option<String>>,
}

#[cfg(target_os = "windows")]
fn vst3_dir() -> std::path::PathBuf {
    // Try user-local VST3 first (no admin needed), fall back to system dir
    if let Some(home) = dirs::home_dir() {
        let local = home.join("Documents").join("VST3");
        if std::fs::create_dir_all(&local).is_ok() {
            return local;
        }
    }
    std::path::PathBuf::from(r"C:\Program Files\Common Files\VST3")
}

#[cfg(target_os = "macos")]
fn vst3_dir() -> std::path::PathBuf {
    if let Some(home) = dirs::home_dir() {
        return home.join("Library").join("Audio").join("Plug-Ins").join("VST3");
    }
    std::path::PathBuf::from("/Library/Audio/Plug-Ins/VST3")
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn vst3_dir() -> std::path::PathBuf {
    dirs::home_dir().unwrap_or_default().join(".vst3")
}

fn sample_dir(product_name: &str) -> std::path::PathBuf {
    dirs::download_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Downloads"))
        .join("Hardwave")
        .join(product_name)
}

#[tauri::command]
async fn login(
    email: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<models::AuthResponse, String> {
    let res = api::login(&email, &password).await?;
    if res.success {
        if let Some(ref token) = res.token {
            *state.api_token.lock().unwrap() = Some(token.clone());
        }
    }
    Ok(res)
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let token = state.api_token.lock().unwrap().clone();
    if let Some(t) = token {
        let _ = api::logout(&t).await;
    }
    *state.api_token.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
async fn get_auth_status(state: State<'_, AppState>) -> Result<bool, String> {
    let token = state.api_token.lock().unwrap().clone();
    match token {
        Some(t) => api::get_auth_status(&t).await,
        None => Ok(false),
    }
}

#[tauri::command]
async fn set_token(token: String, state: State<'_, AppState>) -> Result<(), String> {
    *state.api_token.lock().unwrap() = Some(token);
    Ok(())
}

#[tauri::command]
async fn get_purchases(state: State<'_, AppState>) -> Result<Vec<models::Product>, String> {
    let token = state
        .api_token
        .lock()
        .unwrap()
        .clone()
        .ok_or("Not authenticated")?;
    api::get_downloads(&token).await
}

#[tauri::command]
async fn download_and_install(
    file_id: String,
    url: String,
    filename: String,
    category: String,
    product_name: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let token = state.api_token.lock().unwrap().clone();

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }

    let res = req.send().await.map_err(|e| format!("Download request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Download failed: HTTP {}", res.status()));
    }

    let total = res.content_length().unwrap_or(0);

    let tmp_path = std::env::temp_dir().join(&filename);
    let mut tmp_file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        tmp_file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let percent = if total > 0 {
            ((downloaded as f64 / total as f64) * 100.0) as u8
        } else {
            0
        };

        let _ = app.emit(
            "dl:progress",
            DownloadProgress {
                file_id: file_id.clone(),
                percent,
                downloaded,
                total,
                status: "downloading".into(),
                install_path: None,
            },
        );
    }

    tmp_file.flush().await.map_err(|e| e.to_string())?;
    drop(tmp_file);

    let _ = app.emit(
        "dl:progress",
        DownloadProgress {
            file_id: file_id.clone(),
            percent: 100,
            downloaded,
            total,
            status: "installing".into(),
            install_path: None,
        },
    );

    let install_dir = match category.as_str() {
        "vst" | "vst3" => vst3_dir(),
        _ => sample_dir(&product_name),
    };

    tokio::fs::create_dir_all(&install_dir)
        .await
        .map_err(|e| e.to_string())?;

    let dest = install_dir.join(&filename);
    tokio::fs::copy(&tmp_path, &dest)
        .await
        .map_err(|e| e.to_string())?;
    let _ = tokio::fs::remove_file(&tmp_path).await;

    let install_path = dest.to_string_lossy().to_string();

    let _ = app.emit(
        "dl:progress",
        DownloadProgress {
            file_id: file_id.clone(),
            percent: 100,
            downloaded,
            total,
            status: "installed".into(),
            install_path: Some(install_path.clone()),
        },
    );

    Ok(install_path)
}

#[tauri::command]
async fn open_install_folder(category: String) -> Result<(), String> {
    let dir = match category.as_str() {
        "vst" | "vst3" => vst3_dir(),
        _ => sample_dir(""),
    };

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    std::process::Command::new("xdg-open")
        .arg(dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .setup(|app| {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .manage(AppState {
            api_token: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            login,
            logout,
            get_auth_status,
            set_token,
            get_purchases,
            download_and_install,
            open_install_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
