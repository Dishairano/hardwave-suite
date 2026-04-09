//! Hardwave Suite custom installer.
//!
//! A Tauri-based launcher-style installer that replaces the default NSIS
//! wizard. It:
//!   1. Fetches the latest Suite version from the updater endpoint.
//!   2. Lets the user pick an install location.
//!   3. Downloads a portable zip of the Suite from the GitHub release.
//!   4. Extracts it, creates shortcuts, registers an uninstall entry.
//!   5. Launches the Suite.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, State};

mod install;
#[cfg(windows)]
mod shortcut;
#[cfg(windows)]
mod uninstall;

// ─── Types ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersion {
    pub version: String,
    pub notes: String,
    pub pub_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallProgress {
    pub phase: String, // "downloading" | "extracting" | "shortcuts" | "registering" | "done"
    pub percent: u32,  // 0-100
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallOptions {
    pub install_dir: String,
    pub create_desktop_shortcut: bool,
    pub create_start_menu_shortcut: bool,
    pub launch_after: bool,
}

#[derive(Default)]
pub struct InstallState {
    pub cancel: Arc<std::sync::atomic::AtomicBool>,
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Probe the Hardwave updater endpoint to find the latest version and the
/// portable-zip download URL.
#[tauri::command]
async fn fetch_latest_version() -> Result<LatestVersion, String> {
    let client = reqwest::Client::builder()
        .user_agent("HardwaveSuiteInstaller/0.1")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    // Primary: Hardwave API. Fallback: GitHub latest release tag.
    let primary_res = client
        .get("https://hardwavestudios.com/api/updates/hardwave-suite/latest")
        .send()
        .await;

    if let Ok(res) = primary_res {
        if res.status().is_success() {
            if let Ok(body) = res.json::<serde_json::Value>().await {
                if let Some(v) = body.get("version").and_then(|v| v.as_str()) {
                    return Ok(LatestVersion {
                        version: v.trim_start_matches('v').to_string(),
                        notes: body.get("notes").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        pub_date: body.get("pub_date").and_then(|v| v.as_str()).map(str::to_string),
                    });
                }
            }
        }
    }

    // Fallback: GitHub API for the latest release tag.
    let gh: serde_json::Value = client
        .get("https://api.github.com/repos/Dishairano/hardwave-suite/releases/latest")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("GitHub API returned error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Parsing GitHub response failed: {e}"))?;

    let tag = gh
        .get("tag_name")
        .and_then(|v| v.as_str())
        .ok_or("GitHub release missing tag_name")?;
    let body = gh.get("body").and_then(|v| v.as_str()).unwrap_or("");
    let pub_date = gh.get("published_at").and_then(|v| v.as_str()).map(str::to_string);

    Ok(LatestVersion {
        version: tag.trim_start_matches('v').to_string(),
        notes: body.to_string(),
        pub_date,
    })
}

/// Returns the default per-user install directory.
#[tauri::command]
fn default_install_dir() -> String {
    install::default_install_dir()
        .to_string_lossy()
        .to_string()
}

/// Starts the full install pipeline. Emits `install://progress` events.
#[tauri::command]
async fn start_install(
    app: AppHandle,
    state: State<'_, InstallState>,
    options: InstallOptions,
) -> Result<String, String> {
    state
        .cancel
        .store(false, std::sync::atomic::Ordering::SeqCst);
    let cancel = state.cancel.clone();

    install::run(app, cancel, options).await
}

/// Cancel an in-progress install.
#[tauri::command]
fn cancel_install(state: State<'_, InstallState>) {
    state
        .cancel
        .store(true, std::sync::atomic::Ordering::SeqCst);
}

/// Launch the installed Suite at the given path.
#[tauri::command]
fn launch_installed(exe_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&exe_path);
    if !path.exists() {
        return Err(format!("Executable not found: {exe_path}"));
    }
    #[cfg(windows)]
    {
        std::process::Command::new(&path)
            .spawn()
            .map_err(|e| format!("Launch failed: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Launch failed: {e}"))?;
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        std::process::Command::new(&path)
            .spawn()
            .map_err(|e| format!("Launch failed: {e}"))?;
    }
    Ok(())
}

/// Quit the installer window.
#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

// ─── Entry ───────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Handle --uninstall flag: launch the uninstall path and exit.
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--uninstall") {
        #[cfg(windows)]
        {
            if let Err(e) = uninstall::uninstall() {
                eprintln!("Uninstall failed: {e}");
                std::process::exit(1);
            }
        }
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(InstallState::default())
        .invoke_handler(tauri::generate_handler![
            fetch_latest_version,
            default_install_dir,
            start_install,
            cancel_install,
            launch_installed,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("error while running hardwave-suite-installer");
}
