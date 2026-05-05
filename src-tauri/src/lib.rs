mod api;
mod automix;
mod beta;
mod bridge;
mod collabs;
mod models;

use models::DownloadProgress;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

pub struct AppState {
    pub api_token: Mutex<Option<String>>,
    pub collab: Arc<collabs::CollabState>,
    pub bridge: Arc<bridge::BridgeState>,
    pub automix: Arc<automix::AutoMixState>,
}

/// Base data directory for Hardwave Suite config/data.
fn data_dir() -> std::path::PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("Hardwave Suite")
}

/// Path to the installed products registry file.
fn installed_registry_path() -> std::path::PathBuf {
    data_dir().join("installed.json")
}

/// Path to the settings file.
fn settings_path() -> std::path::PathBuf {
    data_dir().join("settings.json")
}

/// Shared auth token path — VST plugins read from here on editor open.
/// Uses `dirs::data_dir()` (not `data_local_dir()`) to match the VST plugin's
/// `auth.rs` which uses `dirs::data_dir().join("hardwave/auth_token")`.
fn shared_vst_token_path() -> Option<std::path::PathBuf> {
    dirs::data_dir().map(|d| d.join("hardwave").join("auth_token"))
}

/// Write or clear the shared auth token file so VST plugins pick it up
/// without requiring a separate login.
fn sync_vst_token(token: Option<&str>) {
    if let Some(path) = shared_vst_token_path() {
        match token {
            Some(t) => {
                if let Some(parent) = path.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let _ = std::fs::write(&path, t);
            }
            None => {
                if path.exists() {
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
    }
}

/// Read settings from disk.
fn read_settings() -> std::collections::HashMap<String, String> {
    let path = settings_path();
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Write settings to disk.
fn write_settings(settings: &std::collections::HashMap<String, String>) {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = std::fs::write(&path, json);
    }
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

/// Remove a product from the installed registry.
fn mark_uninstalled(slug: &str) {
    let path = installed_registry_path();
    let mut map = read_installed();
    map.remove(slug);
    if let Ok(json) = serde_json::to_string_pretty(&map) {
        let _ = std::fs::write(&path, json);
    }
}

fn default_vst3_dir() -> std::path::PathBuf {
    // Per-user VST3 paths so installs never need elevation. All major DAWs
    // (FL Studio, Ableton, Studio One, Bitwig, Reaper, Cubase, Logic) scan
    // these in addition to the system folder. Users can still override
    // `vst3_path` in settings to point at the system folder if they want.
    #[cfg(target_os = "windows")]
    {
        // %LOCALAPPDATA%\Programs\Common\VST3 — Steinberg's per-user spec path.
        dirs::data_local_dir()
            .map(|p| p.join("Programs").join("Common").join("VST3"))
            .unwrap_or_else(|| std::path::PathBuf::from(r"C:\Program Files\Common Files\VST3"))
    }
    #[cfg(target_os = "macos")]
    {
        // ~/Library/Audio/Plug-Ins/VST3
        dirs::home_dir()
            .map(|p| p.join("Library").join("Audio").join("Plug-Ins").join("VST3"))
            .unwrap_or_else(|| std::path::PathBuf::from("/Library/Audio/Plug-Ins/VST3"))
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    { dirs::home_dir().unwrap_or_default().join(".vst3") }
}

fn default_sample_dir() -> std::path::PathBuf {
    dirs::download_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join("Downloads"))
        .join("Hardwave")
}

fn vst3_dir() -> std::path::PathBuf {
    let settings = read_settings();
    settings.get("vst3_path")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(default_vst3_dir)
}

/// Copy a directory tree using an elevated process (UAC prompt on Windows).
#[cfg(target_os = "windows")]
fn copy_elevated(src: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    let src_s = src.to_string_lossy();
    let dest_s = dest.to_string_lossy();
    // Use xcopy instead of robocopy — simpler exit codes (0 = success)
    let ps_cmd = format!(
        "Start-Process -FilePath 'xcopy.exe' -ArgumentList '\"{}\" \"{}\" /E /I /Y /Q' -Verb RunAs -Wait",
        src_s, dest_s
    );
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_cmd])
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
    let settings = read_settings();
    let base = settings.get("sample_path")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(default_sample_dir);
    base.join(product_name)
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
            sync_vst_token(Some(token));
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
    sync_vst_token(None);
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
    *state.api_token.lock().unwrap() = Some(token.clone());
    sync_vst_token(Some(&token));
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

/// Download a file with resume support and automatic retries.
/// Returns (tmp_path, total_bytes_downloaded).
async fn download_with_resume(
    url: &str,
    token: &Option<String>,
    filename: &str,
    file_id: &str,
    app: &tauri::AppHandle,
) -> Result<(std::path::PathBuf, u64), String> {
    use std::time::Duration;

    let tmp_path = std::env::temp_dir().join(filename);
    let part_path = std::env::temp_dir().join(format!("{}.part", filename));

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    const MAX_RETRIES: u32 = 3;
    let mut attempt = 0;

    loop {
        // Check how much we already have from a previous (partial) download
        let existing_bytes = tokio::fs::metadata(&part_path)
            .await
            .map(|m| m.len())
            .unwrap_or(0);

        // Build request with Range header if resuming
        let mut req = client.get(url);
        if let Some(t) = token {
            req = req.bearer_auth(t);
        }
        if existing_bytes > 0 {
            req = req.header("Range", format!("bytes={}-", existing_bytes));
        }

        let res = match req.send().await {
            Ok(r) => r,
            Err(e) => {
                attempt += 1;
                if attempt >= MAX_RETRIES {
                    return Err(format!("Download failed after {} attempts: {}", MAX_RETRIES, e));
                }
                let delay = Duration::from_secs(2u64.pow(attempt));
                let _ = app.emit(
                    "dl:progress",
                    DownloadProgress {
                        file_id: file_id.to_string(),
                        percent: 0,
                        downloaded: existing_bytes,
                        total: 0,
                        status: "downloading".into(),
                        install_path: None,
                    },
                );
                tokio::time::sleep(delay).await;
                continue;
            }
        };

        let status_code = res.status();

        // Determine if server supports resume
        let (total, mut downloaded, append) = if status_code == reqwest::StatusCode::PARTIAL_CONTENT {
            // Server accepted our Range request
            let content_range = res
                .headers()
                .get("content-range")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            // Parse "bytes START-END/TOTAL"
            let total = content_range
                .split('/')
                .last()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            (total, existing_bytes, true)
        } else if status_code.is_success() {
            // Server doesn't support Range or fresh download
            let total = res.content_length().unwrap_or(0);
            (total, 0u64, false)
        } else {
            attempt += 1;
            if attempt >= MAX_RETRIES {
                return Err(format!("Download failed: HTTP {}", status_code));
            }
            let delay = Duration::from_secs(2u64.pow(attempt));
            tokio::time::sleep(delay).await;
            continue;
        };

        // Open file for writing (append if resuming, create if fresh)
        let mut tmp_file = if append {
            tokio::fs::OpenOptions::new()
                .append(true)
                .open(&part_path)
                .await
                .map_err(|e| format!("Failed to open partial file: {}", e))?
        } else {
            tokio::fs::File::create(&part_path)
                .await
                .map_err(|e| format!("Failed to create download file: {}", e))?
        };

        let mut stream = res.bytes_stream();
        let mut chunk_error = false;

        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    if let Err(e) = tmp_file.write_all(&chunk).await {
                        return Err(format!("Failed to write to disk: {}", e));
                    }
                    downloaded += chunk.len() as u64;

                    let percent = if total > 0 {
                        ((downloaded as f64 / total as f64) * 100.0) as u8
                    } else {
                        0
                    };

                    let _ = app.emit(
                        "dl:progress",
                        DownloadProgress {
                            file_id: file_id.to_string(),
                            percent,
                            downloaded,
                            total,
                            status: "downloading".into(),
                            install_path: None,
                        },
                    );
                }
                Err(_) => {
                    // Network error mid-stream — flush what we have and retry
                    chunk_error = true;
                    break;
                }
            }
        }

        // Flush and drop the file handle before continuing
        let _ = tmp_file.flush().await;
        drop(tmp_file);

        if chunk_error {
            attempt += 1;
            if attempt >= MAX_RETRIES {
                return Err(format!(
                    "Download failed after {} attempts (connection lost at {}%)",
                    MAX_RETRIES,
                    if total > 0 { (downloaded * 100 / total) as u32 } else { 0 }
                ));
            }
            let delay = std::time::Duration::from_secs(2u64.pow(attempt));
            tokio::time::sleep(delay).await;
            continue;
        }
        tokio::fs::rename(&part_path, &tmp_path)
            .await
            .map_err(|e| format!("Failed to finalize download: {}", e))?;

        return Ok((tmp_path, downloaded));
    }
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

    let (tmp_path, downloaded) = download_with_resume(&url, &token, &filename, &file_id, &app).await?;

    let total = downloaded;

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

        // Verify that files were actually copied
        let entries: Vec<_> = std::fs::read_dir(&install_dir)
            .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_string()).collect())
            .unwrap_or_default();
        let staging_entries: Vec<_> = std::fs::read_dir(&staging_dir)
            .map(|rd| rd.filter_map(|e| e.ok()).map(|e| e.file_name().to_string_lossy().to_string()).collect())
            .unwrap_or_default();
        for expected in &staging_entries {
            if !entries.iter().any(|e| e == expected) {
                let _ = std::fs::remove_dir_all(&staging_dir);
                return Err(format!(
                    "Installation failed: '{}' was not found in '{}'. The plugin may require administrator privileges to install. Try running Hardwave Suite as administrator.",
                    expected, install_dir.display()
                ));
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
async fn uninstall_plugin(slug: String, category: String) -> Result<(), String> {
    let bundle_name = format!("hardwave-{}", slug);

    let dirs_to_remove: Vec<std::path::PathBuf> = match category.as_str() {
        "vst" | "vst3" => {
            let vst = vst3_dir();
            vec![
                vst.join(format!("{}.vst3", bundle_name)),
                vst.join(format!("{}.clap", bundle_name)),
            ]
        }
        _ => {
            vec![sample_dir(&bundle_name)]
        }
    };

    let mut errors = Vec::new();
    for path in &dirs_to_remove {
        if !path.exists() {
            continue;
        }
        let result = if path.is_dir() {
            std::fs::remove_dir_all(path)
        } else {
            std::fs::remove_file(path)
        };
        if let Err(e) = result {
            let msg = e.to_string();
            if msg.contains("os error 32") || msg.contains("being used by another process") {
                return Err("Plugin file is in use. Close your DAW and try again.".into());
            }
            errors.push(format!("{}: {}", path.display(), msg));
        }
    }

    if !errors.is_empty() {
        #[cfg(target_os = "windows")]
        {
            // Try elevated removal on Windows
            for path in &dirs_to_remove {
                if path.exists() {
                    let ps = format!(
                        "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c rmdir /s /q \"{}\"' -Verb RunAs -Wait",
                        path.to_string_lossy()
                    );
                    let _ = std::process::Command::new("powershell")
                        .args(["-NoProfile", "-Command", &ps])
                        .status();
                }
            }
            // Check if all removed
            let still_exists: Vec<_> = dirs_to_remove.iter().filter(|p| p.exists()).collect();
            if !still_exists.is_empty() {
                return Err(format!("Failed to remove: {}", errors.join("; ")));
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            return Err(format!("Failed to remove: {}", errors.join("; ")));
        }
    }

    mark_uninstalled(&slug);
    Ok(())
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

#[tauri::command]
fn get_install_paths() -> std::collections::HashMap<String, String> {
    let mut paths = std::collections::HashMap::new();
    paths.insert("vst3".to_string(), vst3_dir().to_string_lossy().to_string());
    paths.insert("sample".to_string(), default_sample_dir().to_string_lossy().to_string());

    // Return actual configured values (or defaults)
    let settings = read_settings();
    if let Some(v) = settings.get("vst3_path") {
        paths.insert("vst3".to_string(), v.clone());
    }
    if let Some(v) = settings.get("sample_path") {
        paths.insert("sample".to_string(), v.clone());
    }

    // Also include the defaults so the UI can show a "Reset" option
    paths.insert("vst3_default".to_string(), default_vst3_dir().to_string_lossy().to_string());
    paths.insert("sample_default".to_string(), default_sample_dir().to_string_lossy().to_string());

    paths
}

#[tauri::command]
fn set_install_path(key: String, path: String) -> Result<(), String> {
    let setting_key = match key.as_str() {
        "vst3" => "vst3_path",
        "sample" => "sample_path",
        _ => return Err(format!("Unknown path key: {}", key)),
    };
    let mut settings = read_settings();
    if path.is_empty() {
        settings.remove(setting_key);
    } else {
        settings.insert(setting_key.to_string(), path);
    }
    write_settings(&settings);
    Ok(())
}

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle, title: String) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_title(&title)
        .pick_folder(move |path| {
            let _ = tx.send(path.and_then(|p| p.as_path().map(|pp| pp.to_string_lossy().to_string())));
        });
    rx.await.map_err(|e| format!("Dialog error: {}", e))
}

// ── FL Script Installation ──

/// Detect FL Studio's MIDI script hardware folder.
/// Checks Documents\Image-Line\FL Studio\Settings\Hardware\ first,
/// then falls back to common Program Files paths.
fn fl_script_dir() -> Option<std::path::PathBuf> {
    // User Documents path (most reliable)
    if let Some(docs) = dirs::document_dir() {
        let hw_dir = docs
            .join("Image-Line")
            .join("FL Studio")
            .join("Settings")
            .join("Hardware");
        if hw_dir.exists() {
            return Some(hw_dir.join("Hardwave Collab"));
        }
    }

    // Check common FL Studio install paths
    #[cfg(target_os = "windows")]
    {
        let program_files = std::path::PathBuf::from(r"C:\Program Files\Image-Line");
        if program_files.exists() {
            // Find the FL Studio folder (could be "FL Studio 2024", "FL Studio 21", etc.)
            if let Ok(entries) = std::fs::read_dir(&program_files) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("FL Studio") {
                        let hw_dir = entry.path().join("Settings").join("Hardware");
                        if hw_dir.exists() {
                            return Some(hw_dir.join("Hardwave Collab"));
                        }
                    }
                }
            }
        }
    }

    None
}

#[tauri::command]
fn fl_script_status() -> std::collections::HashMap<String, serde_json::Value> {
    let mut result = std::collections::HashMap::new();

    match fl_script_dir() {
        Some(dir) => {
            let parent = dir.parent().unwrap_or(&dir);
            result.insert("fl_found".into(), serde_json::Value::Bool(parent.exists()));
            result.insert("hardware_dir".into(), serde_json::json!(parent.to_string_lossy()));
            let script_file = dir.join("device_Hardwave Collab.py");
            result.insert("installed".into(), serde_json::Value::Bool(script_file.exists()));
            result.insert("install_path".into(), serde_json::json!(dir.to_string_lossy()));
        }
        None => {
            result.insert("fl_found".into(), serde_json::Value::Bool(false));
            result.insert("installed".into(), serde_json::Value::Bool(false));
        }
    }

    result
}

#[tauri::command]
fn install_fl_script() -> Result<String, String> {
    let dir = fl_script_dir()
        .ok_or("FL Studio not found. Install FL Studio first, or manually copy the script.")?;

    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create script directory: {}", e))?;

    let script_content = include_str!("fl_script.py");
    let script_path = dir.join("device_Hardwave Collab.py");

    std::fs::write(&script_path, script_content)
        .map_err(|e| format!("Failed to write script: {}", e))?;

    Ok(dir.to_string_lossy().to_string())
}

// ── Crash Report Commands ──

/// Hardwave shared data directory (same as the plugin uses).
fn hardwave_data_dir() -> std::path::PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("hardwave")
}

/// Check if any plugin left a crash-pending sentinel.
/// Returns { plugin, version, timestamp, logPath } or null.
#[tauri::command]
fn check_crash_report() -> Option<serde_json::Value> {
    let pending = hardwave_data_dir().join("analyser-crash-pending");
    if !pending.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&pending).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();
    let plugin = lines.first().unwrap_or(&"unknown").to_string();
    let version = lines.get(1).unwrap_or(&"unknown").to_string();
    let timestamp = lines.get(2).unwrap_or(&"").to_string();
    let log_path = hardwave_data_dir()
        .join(format!("{}-crash.log", plugin))
        .to_string_lossy()
        .to_string();
    Some(serde_json::json!({
        "plugin": plugin,
        "version": version,
        "timestamp": timestamp,
        "logPath": log_path,
    }))
}

/// Upload the crash log to the Hardwave document archive and clear the sentinel.
#[tauri::command]
async fn upload_crash_report() -> Result<String, String> {
    let pending = hardwave_data_dir().join("analyser-crash-pending");
    let content = std::fs::read_to_string(&pending).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();
    let plugin = lines.first().unwrap_or(&"analyser").to_string();

    let log_path = hardwave_data_dir().join(format!("{}-crash.log", plugin));
    if !log_path.exists() {
        // No crash log to upload — just clear sentinel
        let _ = std::fs::remove_file(&pending);
        return Err("No crash log found".into());
    }

    let log_content = std::fs::read(&log_path).map_err(|e| format!("Failed to read crash log: {}", e))?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let filename = format!("{}-crash-{}.log", plugin, ts);

    // Upload to the Hardwave document archive
    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new()
        .text("category", "crash-reports")
        .text("description", format!("Crash report from {} plugin", plugin))
        .part("file", reqwest::multipart::Part::bytes(log_content)
            .file_name(filename)
            .mime_str("text/plain")
            .unwrap());

    let res = client
        .post("https://erp.hardwavestudios.com/api/erp/archive")
        .header("x-api-key", "540f288f51ee8029e2d9c085c4ea0b58880dfdde8c68b33b66847829cbd5235e")
        .header("x-server-origin", "hardwave-suite")
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Upload failed ({}): {}", status, body));
    }

    // Clear the sentinel and the crash log
    let _ = std::fs::remove_file(&pending);
    let _ = std::fs::remove_file(&log_path);

    Ok("Crash report uploaded successfully".into())
}

/// Dismiss the crash report without uploading.
#[tauri::command]
fn dismiss_crash_report() {
    let pending = hardwave_data_dir().join("analyser-crash-pending");
    let _ = std::fs::remove_file(&pending);
}

// ── Collab Commands ──

#[tauri::command]
async fn collab_create(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let token = state.api_token.lock().unwrap().clone()
        .ok_or("Not authenticated")?;
    let collab = state.collab.clone();
    let br = state.bridge.clone();

    // Start the bridge if not running
    bridge::start_bridge(br.clone(), collab.clone()).await?;

    // Connect to relay if not already connected
    if !collab.is_connected().await {
        collabs::connect(&token, app, collab.clone(), Some(br)).await?;
    }
    collabs::create_room(&collab).await
}

#[tauri::command]
async fn collab_join(
    code: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let token = state.api_token.lock().unwrap().clone()
        .ok_or("Not authenticated")?;
    let collab = state.collab.clone();
    let br = state.bridge.clone();

    bridge::start_bridge(br.clone(), collab.clone()).await?;

    if !collab.is_connected().await {
        collabs::connect(&token, app, collab.clone(), Some(br)).await?;
    }
    collabs::join_room(&collab, &code).await
}

#[tauri::command]
async fn collab_leave(state: State<'_, AppState>) -> Result<(), String> {
    let collab = state.collab.clone();
    collabs::disconnect(collab).await;
    Ok(())
}

#[tauri::command]
async fn collab_send_chat(text: String, state: State<'_, AppState>) -> Result<(), String> {
    collabs::send_chat(&state.collab, &text).await
}

#[tauri::command]
async fn collab_send_presence(active_window: String, state: State<'_, AppState>) -> Result<(), String> {
    collabs::send_presence(&state.collab, &active_window).await
}

#[tauri::command]
async fn bridge_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let br = &state.bridge;
    let fl_connected = br.is_fl_connected().await;
    let ops_count = br.get_ops_count().await;
    let fl_state = br.get_last_state().await;

    // Extract transport info from FL state if available
    let transport = fl_state
        .as_ref()
        .and_then(|s| s.get("transport").cloned());

    Ok(serde_json::json!({
        "fl_connected": fl_connected,
        "ops_synced": ops_count,
        "transport": transport,
    }))
}

// ── Beta channel commands ──

#[tauri::command]
async fn get_subscription_info(
    state: State<'_, AppState>,
) -> Result<beta::SubscriptionInfo, String> {
    let token = state
        .api_token
        .lock()
        .unwrap()
        .clone()
        .ok_or("Not authenticated")?;
    beta::fetch_subscription(&token).await
}

#[tauri::command]
async fn get_beta_manifest(state: State<'_, AppState>) -> Result<Vec<beta::BetaPlugin>, String> {
    let token = state
        .api_token
        .lock()
        .unwrap()
        .clone()
        .ok_or("Not authenticated")?;
    beta::fetch_beta_manifest(&token).await
}

#[tauri::command]
fn get_update_channel() -> String {
    beta::read_update_channel()
}

#[tauri::command]
fn set_update_channel(channel: String) -> Result<(), String> {
    beta::write_update_channel(&channel)
}

#[tauri::command]
fn get_auto_attach_crash_logs() -> bool {
    beta::read_auto_attach_crash_logs()
}

#[tauri::command]
fn set_auto_attach_crash_logs(enabled: bool) -> Result<(), String> {
    beta::write_auto_attach_crash_logs(enabled)
}

#[tauri::command]
async fn install_beta_build(
    slug: String,
    version: String,
    url: String,
    sha256: String,
    expires_at: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let token = state.api_token.lock().unwrap().clone();
    beta::install_beta_build(token.as_deref(), &slug, &version, &url, &sha256, &expires_at).await
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", url.as_str()])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url.as_str())
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url.as_str())
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            // Background expiry watcher for installed beta builds.
            beta::spawn_expiry_watcher(app.handle().clone());
            Ok(())
        })
        .manage(AppState {
            api_token: Mutex::new(None),
            collab: Arc::new(collabs::CollabState::new()),
            bridge: Arc::new(bridge::BridgeState::new()),
            automix: Arc::new(automix::AutoMixState::new()),
        })
        .invoke_handler(tauri::generate_handler![
            login,
            logout,
            get_auth_status,
            set_token,
            get_purchases,
            download_and_install,
            get_installed_versions,
            uninstall_plugin,
            open_install_folder,
            get_install_paths,
            set_install_path,
            pick_folder,
            check_crash_report,
            upload_crash_report,
            dismiss_crash_report,
            collab_create,
            collab_join,
            collab_leave,
            collab_send_chat,
            collab_send_presence,
            fl_script_status,
            install_fl_script,
            bridge_status,
            automix::automix_analyze,
            automix::automix_update_setting,
            automix::automix_update_stem_type,
            automix::automix_render,
            automix::automix_render_path,
            automix::automix_get_session,
            get_subscription_info,
            get_beta_manifest,
            get_update_channel,
            set_update_channel,
            get_auto_attach_crash_logs,
            set_auto_attach_crash_logs,
            install_beta_build,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
