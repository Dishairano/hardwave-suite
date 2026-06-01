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

fn default_clap_dir() -> std::path::PathBuf {
    // Per-user CLAP paths, mirroring default_vst3_dir(). DAWs scan these in
    // addition to the system CLAP folder. The old code never wrote a .clap
    // into a real CLAP folder (it dumped it in the VST3 dir), so CLAP users
    // never received updates — the "plugin still shows the old version" bug.
    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir()
            .map(|p| p.join("Programs").join("Common").join("CLAP"))
            .unwrap_or_else(|| std::path::PathBuf::from(r"C:\Program Files\Common Files\CLAP"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .map(|p| p.join("Library").join("Audio").join("Plug-Ins").join("CLAP"))
            .unwrap_or_else(|| std::path::PathBuf::from("/Library/Audio/Plug-Ins/CLAP"))
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    { dirs::home_dir().unwrap_or_default().join(".clap") }
}

fn clap_dir() -> std::path::PathBuf {
    let settings = read_settings();
    settings.get("clap_path")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(default_clap_dir)
}

#[derive(serde::Serialize)]
struct StalePlugin {
    path: String,
    name: String,
    format: String, // "VST3" | "CLAP"
    scope: String,  // "per-user" | "system" | "configured"
}

/// Every standard folder a DAW might scan for plug-ins. Used by the
/// "Clean old versions" repair to find leftover Hardwave copies that make a
/// DAW load a stale build.
fn all_plugin_dirs() -> Vec<(std::path::PathBuf, &'static str, &'static str)> {
    let mut v: Vec<(std::path::PathBuf, &'static str, &'static str)> = vec![
        (vst3_dir(), "VST3", "configured"),
        (default_vst3_dir(), "VST3", "per-user"),
        (clap_dir(), "CLAP", "configured"),
        (default_clap_dir(), "CLAP", "per-user"),
    ];
    #[cfg(target_os = "windows")]
    {
        v.push((std::path::PathBuf::from(r"C:\Program Files\Common Files\VST3"), "VST3", "system"));
        v.push((std::path::PathBuf::from(r"C:\Program Files\Common Files\CLAP"), "CLAP", "system"));
    }
    #[cfg(target_os = "macos")]
    {
        v.push((std::path::PathBuf::from("/Library/Audio/Plug-Ins/VST3"), "VST3", "system"));
        v.push((std::path::PathBuf::from("/Library/Audio/Plug-Ins/CLAP"), "CLAP", "system"));
    }
    v
}

/// A path is only ever eligible for removal if it's a `hardwave-*.vst3`/`.clap`
/// living directly inside one of the known plug-in dirs. Belt-and-braces so the
/// repair can never delete something it shouldn't.
fn is_removable_hardwave_plugin(path: &std::path::Path) -> bool {
    let fname = match path.file_name() {
        Some(f) => f.to_string_lossy().to_lowercase(),
        None => return false,
    };
    if !fname.starts_with("hardwave-") { return false; }
    if !(fname.ends_with(".vst3") || fname.ends_with(".clap")) { return false; }
    // Reject symlinks / Windows junctions / reparse points. A real plug-in
    // bundle is never a link; following one would let a recursive delete escape
    // into an arbitrary target tree — especially dangerous under elevation.
    if let Ok(md) = std::fs::symlink_metadata(path) {
        if md.file_type().is_symlink() { return false; }
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::fs::MetadataExt;
            const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
            if md.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 { return false; }
        }
    }
    let parent = match path.parent() { Some(p) => p, None => return false };
    all_plugin_dirs().iter().any(|(d, _, _)| d == parent)
}

#[tauri::command]
fn scan_stale_plugins() -> Vec<StalePlugin> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for (dir, format, scope) in all_plugin_dirs() {
        let rd = match std::fs::read_dir(&dir) { Ok(r) => r, Err(_) => continue };
        for entry in rd.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let lname = name.to_lowercase();
            if !lname.starts_with("hardwave-") { continue; }
            if !(lname.ends_with(".vst3") || lname.ends_with(".clap")) { continue; }
            let key = entry.path().to_string_lossy().to_string();
            if !seen.insert(key.clone()) { continue; }
            out.push(StalePlugin { path: key, name, format: format.to_string(), scope: scope.to_string() });
        }
    }
    out
}

/// Remove a single plug-in path with an elevation (UAC) prompt on Windows.
/// Mirrors `uninstall_plugin`'s elevated fallback: a directory bundle (.vst3, or
/// a macOS .clap) goes via `rmdir /s /q`, a plain file (.clap on Windows) via
/// `del /q`. Returns Ok only if the path is actually gone afterwards. The caller
/// must have already validated the path with `is_removable_hardwave_plugin`.
#[cfg(target_os = "windows")]
fn remove_path_elevated(path: &std::path::Path) -> Result<(), String> {
    let p = path.to_string_lossy();
    // Defense-in-depth before running with admin rights: refuse any path with a
    // shell-significant character. A legitimate plug-in path never contains
    // these, and the existing exists()-gate + Windows' ban on '"' in filenames
    // already make a cmd-quote breakout unreachable — but we never want elevated
    // command construction to depend on that subtlety. Belt and braces.
    if p.contains(|c: char| matches!(c, '"' | '&' | '|' | '<' | '>' | '^' | '%' | '`' | '\n' | '\r')) {
        return Err("refusing to remove a path containing unsafe characters".into());
    }
    let inner = if path.is_dir() {
        format!("rmdir /s /q \"{}\"", p)
    } else {
        format!("del /q \"{}\"", p)
    };
    let ps = format!(
        "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c {}' -Verb RunAs -Wait",
        inner
    );
    // The exit status reflects whether Start-Process launched, not the inner
    // cmd's result, so the authoritative success signal is whether the path is
    // actually gone afterwards (a denied UAC leaves it present → Err).
    std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps])
        .status()
        .map_err(|e| format!("Failed to request elevation: {}", e))?;
    if path.exists() {
        return Err("administrator access was denied, or the file is still in use".into());
    }
    Ok(())
}

#[tauri::command]
fn remove_stale_plugins(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut removed = Vec::new();
    for p in paths {
        let path = std::path::PathBuf::from(&p);
        if !is_removable_hardwave_plugin(&path) {
            return Err(format!("Refused — not a Hardwave plug-in in a known folder: {}", p));
        }
        if !path.exists() { continue; }
        let res = if path.is_dir() { std::fs::remove_dir_all(&path) } else { std::fs::remove_file(&path) };
        match res {
            Ok(()) => removed.push(p),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("os error 32") || msg.contains("being used by another process") {
                    return Err("A plug-in file is in use. Close your DAW and try again.".into());
                }
                // Permission denied — almost always a copy in a system folder
                // (C:\Program Files\Common Files\..., /Library/Audio/Plug-Ins).
                // The user explicitly asked to remove it, so it's appropriate to
                // elevate here (unlike the silent install-time sweep). Windows
                // gets a UAC retry; other platforms surface a clear, actionable
                // message rather than a bare OS error.
                let is_denied = msg.contains("os error 5")
                    || msg.contains("Access is denied")
                    || msg.contains("Permission denied")
                    || msg.contains("os error 13");
                #[cfg(target_os = "windows")]
                {
                    if is_denied {
                        match remove_path_elevated(&path) {
                            Ok(()) => { removed.push(p); continue; }
                            Err(ee) => return Err(format!("Couldn't remove {} — {}", p, ee)),
                        }
                    }
                    return Err(format!("{}: {}", p, msg));
                }
                #[cfg(not(target_os = "windows"))]
                {
                    if is_denied {
                        return Err(format!(
                            "Couldn't remove {} — it's in a system folder that needs administrator rights. Remove it manually, or relaunch the Suite with sudo.",
                            p
                        ));
                    }
                    return Err(format!("{}: {}", p, msg));
                }
            }
        }
    }
    Ok(removed)
}

/// Append-only audit trail for the auto-sweep's irreversible deletes, so support
/// can see exactly what a sweep removed (or failed to remove) on a customer
/// machine. Best-effort: a logging failure must never block or fail the
/// already-successful install.
fn append_sweep_log(action: &str, path: &str) {
    use std::io::Write;
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let dir = data_dir();
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("sweep.log")) {
        let _ = writeln!(f, "{}\t{}\t{}", secs, action, path);
    }
}

/// Remove copies of a just-installed plug-in bundle that linger in OTHER
/// folders a DAW scans (system dir, a previously-configured per-user dir, …).
/// `keep` holds the paths we just wrote — the fresh install — so they're never
/// touched. Returns (removed, blocked); `blocked` are copies we couldn't delete,
/// almost always because the DAW currently has them loaded (or they sit in a
/// system folder needing admin rights — removable via the user-confirmed "Clean
/// old versions" repair, which elevates). Best-effort by design: the caller's
/// install has already succeeded, so a blocked leftover is reported, never fatal,
/// and we never silently trigger a UAC prompt mid-update. Reuses
/// `is_removable_hardwave_plugin` so it can only ever delete a
/// `hardwave-*.vst3`/`.clap` sitting directly in a known dir.
/// A stale copy the sweep found but could NOT delete, with a machine-readable
/// reason so the UI can react: "in_use" (the DAW has it open → close it and
/// retry), "denied" (a system folder → the user-confirmed cleanup elevates),
/// or "error" (anything else). The `path` is exactly what `remove_stale_plugins`
/// accepts for a retry.
#[derive(serde::Serialize, Clone)]
struct BlockedCopy {
    path: String,
    reason: String,
}

fn sweep_other_copies(
    bundle_files: &[String],
    keep: &std::collections::HashSet<std::path::PathBuf>,
) -> (Vec<String>, Vec<BlockedCopy>) {
    let mut removed = Vec::new();
    let mut blocked: Vec<BlockedCopy> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for (dir, _, _) in all_plugin_dirs() {
        for name in bundle_files {
            let candidate = dir.join(name);
            // Never touch the copies we just installed (match raw or canonical).
            let canon = candidate.canonicalize().ok();
            if keep.contains(&candidate) || canon.as_ref().map_or(false, |c| keep.contains(c)) {
                continue;
            }
            // De-dup: the same physical file can surface via two dir aliases
            // (e.g. configured dir == default dir when unset).
            let dedup_key = canon.unwrap_or_else(|| candidate.clone());
            if !seen.insert(dedup_key) { continue; }
            if !candidate.exists() { continue; }
            if !is_removable_hardwave_plugin(&candidate) { continue; }
            let res = if candidate.is_dir() {
                std::fs::remove_dir_all(&candidate)
            } else {
                std::fs::remove_file(&candidate)
            };
            let cand_str = candidate.to_string_lossy().to_string();
            match res {
                Ok(()) => {
                    append_sweep_log("removed", &cand_str);
                    removed.push(cand_str);
                }
                Err(e) => {
                    let msg = e.to_string();
                    let reason = if msg.contains("os error 32") || msg.contains("being used by another process") {
                        "in_use"
                    } else if msg.contains("os error 5") || msg.contains("Access is denied")
                        || msg.contains("Permission denied") || msg.contains("os error 13") {
                        "denied"
                    } else {
                        "error"
                    };
                    append_sweep_log(&format!("blocked-{}", reason), &cand_str);
                    blocked.push(BlockedCopy { path: cand_str, reason: reason.to_string() });
                }
            }
        }
    }
    (removed, blocked)
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

        // Also place the CLAP build in the real CLAP folder. The release zip
        // ships both a .vst3 and a .clap; the copy above lands everything in the
        // VST3 dir, so without this the DAW's CLAP scanner never sees the new
        // build — that's the "still shows the old version" bug. Additive and
        // best-effort: never fails the (already-succeeded) VST3 install.
        if matches!(category.as_str(), "vst" | "vst3") {
            let cdir = clap_dir();
            if let Ok(rd) = std::fs::read_dir(&staging_dir) {
                for entry in rd.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !name.to_lowercase().ends_with(".clap") { continue; }
                    let _ = std::fs::create_dir_all(&cdir);
                    let dest = cdir.join(&name);
                    let res = if entry.path().is_dir() {
                        copy_dir_all(&entry.path(), &dest)
                    } else {
                        std::fs::copy(entry.path(), &dest).map(|_| ()).map_err(|e| e.to_string())
                    };
                    #[cfg(target_os = "windows")]
                    if let Err(e) = &res {
                        if e.contains("Access is denied") || e.contains("os error 5") {
                            let _ = copy_elevated(&entry.path(), &dest);
                        }
                    }
                    let _ = res;
                }
            }
        }

        // Sweep older copies of THIS bundle out of every other folder a DAW
        // scans. A leftover in the system dir or a previously-configured per-user
        // dir is exactly why "I updated but it still shows the old version"
        // happens — the DAW loads whichever copy it finds first. We derive the
        // bundle's filenames from the staging dir (not the slug), so it works
        // even when an older Suite UI didn't pass product_slug/version.
        if matches!(category.as_str(), "vst" | "vst3") {
            let bundle_files: Vec<String> = staging_entries
                .iter()
                .filter(|n| { let l = n.to_lowercase(); l.ends_with(".vst3") || l.ends_with(".clap") })
                .cloned()
                .collect();
            let mut keep: std::collections::HashSet<std::path::PathBuf> = std::collections::HashSet::new();
            for name in &bundle_files {
                for p in [install_dir.join(name), clap_dir().join(name)] {
                    if let Ok(c) = p.canonicalize() { keep.insert(c); }
                    keep.insert(p);
                }
            }
            let (removed, blocked) = sweep_other_copies(&bundle_files, &keep);
            if !removed.is_empty() || !blocked.is_empty() {
                let _ = app.emit(
                    "dl:cleaned",
                    serde_json::json!({
                        "slug": product_slug.clone().unwrap_or_default(),
                        "removed": removed,
                        "blocked": blocked,
                    }),
                );
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
                vst.join(format!("{}.clap", bundle_name)),       // legacy: old builds mislocated the CLAP in the VST3 dir
                clap_dir().join(format!("{}.clap", bundle_name)), // real CLAP folder
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

/// The canonical system VST3 path on this platform. Returned alongside
/// `default_vst3_dir()` so the UI can show both options in the Per-user /
/// System install-scope toggle (Settings → Paths).
#[tauri::command]
fn system_vst3_dir() -> String {
    #[cfg(target_os = "windows")]
    { String::from(r"C:\Program Files\Common Files\VST3") }
    #[cfg(target_os = "macos")]
    { String::from("/Library/Audio/Plug-Ins/VST3") }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    { String::from("/usr/lib/vst3") }
}

/// Request elevation and grant the current user (OI)(CI)(M) Modify rights on
/// the system VST3 + CLAP folders. Spawns PowerShell with -Verb RunAs which
/// triggers UAC; if the user clicks Yes, an elevated icacls call runs to
/// completion. Idempotent — re-running just re-affirms the existing grant.
///
/// Returns:
///   - Ok("granted") on UAC accepted + icacls succeeded for both paths
///   - Ok("declined") on UAC denied (user clicked No)
///   - Err(...) on PowerShell spawn failure or unexpected exit code
///
/// On non-Windows this is a no-op returning Ok("not_applicable").
///
/// Why this exists: the v0.18+ installer's icacls grant only fires during
/// a fresh install. Auto-updated users (v0.16/v0.17 → v0.21+) reach the
/// new System install-path toggle with default TrustedInstaller-only ACLs
/// on Common Files\VST3, so the toggle stays disabled. This command lets
/// the running Suite request the same grant on demand without forcing the
/// user to re-download the installer.
#[tauri::command]
fn request_grant_system_acl() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // v0.22.6 still failed with empty diagnostics because the inner
        // PowerShell script was passed as a string-in-a-string-in-a-string,
        // and the outer double-quoted wrapper interpolated $_ at parse time
        // before the inner script ever ran. Inner script bombed on a parse
        // error before Start-Transcript could fire, so the log file was
        // never created.
        //
        // Fix: write the inner script to a .ps1 file and spawn the elevated
        // child with -File <path>. PowerShell reads the file as-is, no
        // string-quoting layers to escape through. Same approach also lets
        // the inner script use $_ etc. naturally.
        let temp_dir = std::env::temp_dir();
        let script_path = temp_dir.join("hardwave-acl-grant.ps1");
        let log_path = temp_dir.join("hardwave-acl-grant.log");
        let _ = std::fs::remove_file(&script_path);
        let _ = std::fs::remove_file(&log_path);

        // Build the script body as a clean .ps1 — no Rust-side double-quote
        // escaping concerns. The script writes its own log via [IO.File]
        // calls (more reliable than Start-Transcript on locked-down
        // machines where transcript creation fails silently) and exits with
        // a code Rust can interpret.
        let log_path_pwsh = log_path.display().to_string().replace('\'', "''");
        let script_body = format!(
            r#"# Elevated ACL grant — run by request_grant_system_acl Tauri command.
# Logs to a fixed path that the parent Rust process reads after exit.
$logFile = '{log}'
function Log([string]$msg) {{
    try {{ [IO.File]::AppendAllText($logFile, ($msg + [Environment]::NewLine)) }} catch {{ }}
}}
# Wipe any stale log and start fresh.
try {{ if (Test-Path $logFile) {{ Remove-Item $logFile -Force }} }} catch {{ }}
Log ("=== hardwave-acl-grant " + (Get-Date).ToString('o') + " ===")
Log ("user: " + $env:USERNAME + "  pid: " + $PID + "  is-admin context: " +
    (([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)))

$paths = @('C:\Program Files\Common Files\VST3','C:\Program Files\Common Files\CLAP')
$grantSid = '*S-1-5-32-545:(OI)(CI)(M)'
$grantUser = ($env:USERNAME + ':(OI)(CI)(M)')
$failures = @()

foreach ($p in $paths) {{
    Log ("--- " + $p + " ---")
    if (-not (Test-Path $p)) {{
        try {{
            New-Item -ItemType Directory -Force -Path $p | Out-Null
            Log ("Created " + $p)
        }} catch {{
            Log ("Failed to create directory: " + $_.Exception.Message)
            $failures += ("create-dir failed: " + $p)
            continue
        }}
    }}

    # SID grant
    $sidOut = & icacls $p /grant $grantSid /T 2>&1
    Log ("icacls SID exit=" + $LASTEXITCODE)
    $sidOut | ForEach-Object {{ Log ("  " + $_) }}

    # Username grant (belt and braces)
    $userOut = & icacls $p /grant $grantUser /T 2>&1
    Log ("icacls USER exit=" + $LASTEXITCODE)
    $userOut | ForEach-Object {{ Log ("  " + $_) }}

    # ACL after grant
    Log ""
    Log "ACEs after grant:"
    try {{
        (Get-Acl $p).Access | ForEach-Object {{
            Log ("  " + $_.IdentityReference + "  " + $_.FileSystemRights + "  " + $_.AccessControlType)
        }}
    }} catch {{
        Log ("Get-Acl failed: " + $_.Exception.Message)
    }}

    # Self-probe inside elevated context (proves icacls actually applied,
    # not just exited 0). The non-elevated post-grant probe in Rust
    # validates that the grant reached our user.
    $probe = Join-Path $p '.hardwave-probe'
    try {{
        Set-Content -Path $probe -Value 'hardwave-grant-probe' -Force -ErrorAction Stop
        Remove-Item $probe -Force -ErrorAction SilentlyContinue
        Log ("Self-probe SUCCESS at " + $probe)
    }} catch {{
        Log ("Self-probe FAILED: " + $_.Exception.Message)
        $failures += ("self-probe failed at " + $probe + ": " + $_.Exception.Message)
    }}
}}

Log ""
if ($failures.Count -gt 0) {{
    Log ("FAILURES (" + $failures.Count + "):")
    $failures | ForEach-Object {{ Log ("  - " + $_) }}
    exit 1
}} else {{
    Log "All grants applied + probes succeeded."
    exit 0
}}
"#,
            log = log_path_pwsh
        );

        // Write the script to disk. If this fails we surface the IO error
        // up to the caller — no point starting elevation if the script
        // file can't be created.
        if let Err(e) = std::fs::write(&script_path, &script_body) {
            return Err(format!("Failed to write elevated script: {}", e));
        }

        // Outer Start-Process: powershell.exe -ExecutionPolicy Bypass
        // -File <script> -Verb RunAs. -File reads the script verbatim
        // from disk, eliminating every nested-string-escape concern.
        let script_path_pwsh = script_path.display().to_string().replace('\'', "''");
        let outer = format!(
            "$ErrorActionPreference='Stop'; \
             $p = Start-Process powershell.exe \
              -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','{}') \
              -Verb RunAs -Wait -PassThru -WindowStyle Hidden; \
             if ($null -eq $p) {{ exit 90 }}; \
             exit $p.ExitCode",
            script_path_pwsh,
        );

        let out = std::process::Command::new("powershell.exe")
            .arg("-NoProfile")
            .arg("-WindowStyle").arg("Hidden")
            .arg("-Command")
            .arg(&outer)
            .output()
            .map_err(|e| format!("Failed to spawn powershell: {}", e))?;

        // Best-effort cleanup of the .ps1 — leave the log file in place
        // so a curious user can find it at %TEMP%\hardwave-acl-grant.log.
        let _ = std::fs::remove_file(&script_path);

        // Pull the elevated transcript (which contains everything the
        // child wrote — Write-Host, stderr, errors, you name it) plus
        // the outer powershell's own stderr so failures explain themselves.
        let read_logs = || -> String {
            let transcript = std::fs::read_to_string(&log_path).unwrap_or_default();
            let outer_err = String::from_utf8_lossy(&out.stderr).to_string();
            let mut parts = Vec::new();
            if !transcript.trim().is_empty() { parts.push(format!("TRANSCRIPT:\n{}", transcript.trim())); }
            if !outer_err.trim().is_empty() { parts.push(format!("OUTER:\n{}", outer_err.trim())); }
            if parts.is_empty() { "(no diagnostic output)".into() } else { parts.join("\n\n") }
        };

        let exit_code = out.status.code();
        match exit_code {
            Some(0) => {
                // Belt and braces: don't trust icacls's exit 0. Run our
                // own probe NOW and only return granted if it actually
                // writes. If the elevated self-probe inside PowerShell
                // succeeded but the non-elevated probe from this Rust
                // process fails, the ACL didn't apply to our user — most
                // likely a UAC-elevation bypass (running as admin already,
                // never-notify policy, etc.).
                let probe_dir = std::path::Path::new(r"C:\Program Files\Common Files\VST3");
                let probe_path = probe_dir.join(".hardwave-probe");
                let probe_ok = std::fs::write(&probe_path, b"post-grant-verify").is_ok();
                let _ = std::fs::remove_file(&probe_path);
                if probe_ok {
                    Ok("granted".into())
                } else {
                    Err(format!(
                        "icacls reported success but post-grant probe still cannot write to {}. \
                         The elevation may not have actually run. Diagnostic output:\n\n{}",
                        probe_dir.display(),
                        read_logs()
                    ))
                }
            }
            Some(1223) => Ok("declined".into()),
            Some(code) => Err(format!(
                "Elevation grant failed with exit code {}.\n\n{}",
                code,
                read_logs()
            )),
            None => Err(format!(
                "powershell terminated without an exit code.\n\n{}",
                read_logs()
            )),
        }
    }
    #[cfg(not(target_os = "windows"))]
    { Ok("not_applicable".into()) }
}

/// Probe whether the current user can write to the system VST3 folder
/// without UAC. The v0.18 installer grants `(OI)(CI)(M)` ACL via `icacls`,
/// so a successful probe means the install was elevated at least once.
/// On non-Windows this always returns Ok(true) since system paths
/// don't have the same UAC dance (mac users may still need sudo for
/// /Library/Audio/Plug-Ins/VST3 — handled as a follow-up).
#[tauri::command]
fn probe_system_vst3_writable() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let probe_dir = std::path::Path::new(r"C:\Program Files\Common Files\VST3");
        // Try to create the dir (no-op if it exists), then write a probe file.
        if std::fs::create_dir_all(probe_dir).is_err() {
            return Ok(false);
        }
        let probe_path = probe_dir.join(".hardwave-probe");
        match std::fs::write(&probe_path, b"hardwave-acl-probe") {
            Ok(_) => {
                let _ = std::fs::remove_file(&probe_path);
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    }
    #[cfg(not(target_os = "windows"))]
    { Ok(true) }
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

    // The OS-canonical system path. Used by the Per-user / System scope
    // toggle to point the vst3_path setting at the elevated location when
    // the user opts in.
    paths.insert("vst3_system".to_string(), system_vst3_dir());

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
            scan_stale_plugins,
            remove_stale_plugins,
            open_install_folder,
            get_install_paths,
            set_install_path,
            system_vst3_dir,
            probe_system_vst3_writable,
            request_grant_system_acl,
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
