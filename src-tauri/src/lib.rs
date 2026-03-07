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

/// Path to the installed products registry file.
fn installed_registry_path() -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("Hardwave Suite")
        .join("installed.json")
}

/// Read the installed products registry: { "product-slug": "version" }
fn read_installed() -> std::collections::HashMap<String, String> {
    let path = installed_registry_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Write a product version to the installed registry.
fn mark_installed(slug: &str, version: &str) {
    let path = installed_registry_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut map = read_installed();
    map.insert(slug.to_string(), version.to_string());
    if let Ok(json) = serde_json::to_string_pretty(&map) {
        let _ = std::fs::write(&path, json);
    }
}

#[cfg(target_os = "windows")]
fn vst3_dir() -> std::path::PathBuf {
    std::path::PathBuf::from(r"C:\Program Files\Common Files\VST3")
}

#[cfg(target_os = "macos")]
fn vst3_dir() -> std::path::PathBuf {
    std::path::PathBuf::from("/Library/Audio/Plug-Ins/VST3")
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn vst3_dir() -> std::path::PathBuf {
    dirs::home_dir().unwrap_or_default().join(".vst3")
}

/// Copy a directory tree using an elevated process (UAC prompt on Windows).
#[cfg(target_os = "windows")]
fn copy_elevated(src: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    let src_s = src.to_string_lossy();
    let dest_s = dest.to_string_lossy();
    let status = std::process::Command::new("powershell")
        .args([
            "-NoProfile", "-Command",
            &format!(
                "Start-Process -FilePath 'robocopy.exe' -ArgumentList '\"{}\",\"{}\",/E,/IS,/IT' -Verb RunAs -Wait",
                src_s, dest_s
            ),
        ])
        .status()
        .map_err(|e| format!("Failed to request elevation: {}", e))?;
    if !status.success() {
        return Err("Administrator access was denied or copy failed".into());
    }
    Ok(())
}

/// Recursively copy a directory tree.
fn copy_dir_all(src: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dest)
        .map_err(|e| format!("Failed to create dir {}: {}", dest.display(), e))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("Failed to read dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let dest_path = dest.join(entry.file_name());
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            copy_dir_all(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), &dest_path)
                .map_err(|e| format!("Failed to copy {}: {}", entry.path().display(), e))?;
        }
    }
    Ok(())
}

fn sample_dir(product_name: &str) -> std::path::PathBuf {
    dirs::download_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Downloads"))
        .join("Hardwave")
        .join(product_name)
}

/// Extract a zip file into dest_dir, then delete the zip.
fn extract_zip(zip_path: &std::path::Path, dest_dir: &std::path::Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path)
        .map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read zip: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)
            .map_err(|e| format!("Failed to read zip entry: {}", e))?;

        let name = entry.name().to_string();
        let out_path = dest_dir.join(&name);

        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create dir {}: {}", name, e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {}", e))?;
            }
            let mut out_file = std::fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file {}: {}", name, e))?;
            std::io::copy(&mut entry, &mut out_file)
                .map_err(|e| format!("Failed to extract {}: {}", name, e))?;
        }
    }

    // Delete the zip after successful extraction
    let _ = std::fs::remove_file(zip_path);
    Ok(())
}

/// Extract a tar.gz file into dest_dir, then delete the archive.
fn extract_tar_gz(archive_path: &std::path::Path, dest_dir: &std::path::Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;
    let gz = flate2::read::GzDecoder::new(file);
    let mut tar = tar::Archive::new(gz);

    tar.unpack(dest_dir)
        .map_err(|e| format!("Failed to extract tar.gz: {}", e))?;

    let _ = std::fs::remove_file(archive_path);
    Ok(())
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
    product_slug: Option<String>,
    product_version: Option<String>,
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

    // Emit installing status
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

    // Extract archive to a temp staging dir first
    let lower = filename.to_lowercase();
    let is_archive = lower.ends_with(".zip") || lower.ends_with(".tar.gz") || lower.ends_with(".tgz");

    if is_archive {
        let staging_dir = std::env::temp_dir().join(format!("hw_stage_{}", file_id));
        let _ = std::fs::remove_dir_all(&staging_dir);
        std::fs::create_dir_all(&staging_dir)
            .map_err(|e| format!("Failed to create staging dir: {}", e))?;

        if lower.ends_with(".zip") {
            extract_zip(&tmp_path, &staging_dir)?;
        } else {
            extract_tar_gz(&tmp_path, &staging_dir)?;
        }

        // Try direct copy to install dir
        match copy_dir_all(&staging_dir, &install_dir) {
            Ok(()) => {}
            Err(e) => {
                // File is locked by another process (e.g. DAW has the VST loaded)
                if e.contains("os error 32") || e.contains("being used by another process") {
                    return Err("The plugin file is in use. Please close your DAW (e.g. FL Studio, Ableton) and try again.".into());
                }
                // On Windows, if permission denied, elevate via UAC
                #[cfg(target_os = "windows")]
                {
                    if e.contains("Access is denied") || e.contains("os error 5") {
                        copy_elevated(&staging_dir, &install_dir)?;
                    } else {
                        return Err(e);
                    }
                }
                #[cfg(not(target_os = "windows"))]
                {
                    return Err(e);
                }
            }
        }

        let _ = std::fs::remove_dir_all(&staging_dir);
    } else {
        // Not an archive — copy single file
        std::fs::create_dir_all(&install_dir)
            .map_err(|e| format!("Failed to create install dir: {}", e))?;
        tokio::fs::copy(&tmp_path, install_dir.join(&filename))
            .await
            .map_err(|e| e.to_string())?;
        let _ = tokio::fs::remove_file(&tmp_path).await;
    }

    let install_path = install_dir.to_string_lossy().to_string();

    if let (Some(slug), Some(ver)) = (&product_slug, &product_version) {
        mark_installed(slug, ver);
    }

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
fn get_installed_versions() -> std::collections::HashMap<String, String> {
    read_installed()
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
            get_installed_versions,
            open_install_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
