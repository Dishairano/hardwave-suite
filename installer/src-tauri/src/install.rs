//! Core install pipeline: download → extract → shortcuts → registry → done.

use crate::{InstallOptions, InstallProgress};
use futures_util::StreamExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

const PORTABLE_ZIP_NAME: &str = "hardwave-suite-portable.zip";
#[cfg(windows)]
const SUITE_EXE_NAME: &str = "Hardwave Suite.exe";

/// Default install directory:
///   - Windows: %LocalAppData%\Programs\Hardwave\Suite
///   - macOS:   ~/Applications/Hardwave Suite.app
///   - Linux:   ~/.local/share/hardwave-suite
pub fn default_install_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
            .join("Programs")
            .join("Hardwave")
            .join("Suite")
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .unwrap_or_default()
            .join("Applications")
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join(".local/share"))
            .join("hardwave-suite")
    }
}

fn emit(app: &AppHandle, phase: &str, percent: u32, message: &str) {
    let _ = app.emit(
        "install://progress",
        InstallProgress {
            phase: phase.to_string(),
            percent,
            message: message.to_string(),
        },
    );
}

/// Main entry: runs the full pipeline asynchronously. Returns the path to the
/// installed Suite executable on success.
pub async fn run(
    app: AppHandle,
    cancel: Arc<AtomicBool>,
    opts: InstallOptions,
) -> Result<String, String> {
    let install_dir = PathBuf::from(&opts.install_dir);

    // 1. Resolve download URL
    emit(&app, "downloading", 0, "Finding latest Hardwave Suite…");
    let download_url = resolve_download_url().await?;

    // 2. Prepare install directory
    std::fs::create_dir_all(&install_dir)
        .map_err(|e| format!("Cannot create install directory: {e}"))?;

    // 3. Grant the current user write-ACL on system VST3 / CLAP folders.
    //    Runs while we still hold the installer's UAC elevation. Non-fatal:
    //    if it fails (e.g. corp-locked machine, GPO-managed ACLs) we log
    //    and continue — the Suite still works against per-user paths.
    emit(&app, "preparing", 5, "Granting plug-in folder permissions…");
    if let Err(e) = crate::acl::grant_user_acl_on_system_paths() {
        eprintln!("[installer] ACL grant skipped: {e}");
        emit(&app, "preparing", 5, "Continuing with per-user install…");
    }

    // 4. Download zip to a temp file in the install dir
    let zip_path = install_dir.join(PORTABLE_ZIP_NAME);
    download_with_progress(&app, &cancel, &download_url, &zip_path).await?;

    if cancel.load(Ordering::SeqCst) {
        let _ = std::fs::remove_file(&zip_path);
        return Err("Install cancelled".into());
    }

    // 4. Extract
    emit(&app, "extracting", 0, "Extracting Hardwave Suite…");
    extract_zip(&zip_path, &install_dir, &app)?;
    let _ = std::fs::remove_file(&zip_path);

    // 5. Locate main binary
    let exe_name = target_exe_name();
    let exe_path = find_exe(&install_dir, &exe_name)
        .ok_or_else(|| format!("Could not find {exe_name} in extracted files"))?;

    // 6. Shortcuts
    emit(&app, "shortcuts", 70, "Creating shortcuts…");
    #[cfg(windows)]
    {
        if opts.create_desktop_shortcut {
            crate::shortcut::create_desktop_shortcut(&exe_path)
                .map_err(|e| format!("Desktop shortcut failed: {e}"))?;
        }
        if opts.create_start_menu_shortcut {
            crate::shortcut::create_start_menu_shortcut(&exe_path)
                .map_err(|e| format!("Start menu shortcut failed: {e}"))?;
        }
    }

    // 7. Uninstall registry entry (Windows) — so Suite appears in Add/Remove Programs
    emit(&app, "registering", 90, "Finalising installation…");
    #[cfg(windows)]
    {
        crate::uninstall::register_uninstaller(&install_dir, &exe_path)
            .map_err(|e| format!("Uninstaller registration failed: {e}"))?;
    }

    emit(&app, "done", 100, "Installation complete");

    // 8. Launch
    if opts.launch_after {
        #[cfg(windows)]
        {
            let _ = std::process::Command::new(&exe_path).spawn();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open").arg(&exe_path).spawn();
        }
        #[cfg(all(not(windows), not(target_os = "macos")))]
        {
            let _ = std::process::Command::new(&exe_path).spawn();
        }
    }

    Ok(exe_path.to_string_lossy().to_string())
}

fn target_exe_name() -> String {
    #[cfg(windows)]
    {
        SUITE_EXE_NAME.to_string()
    }
    #[cfg(target_os = "macos")]
    {
        "Hardwave Suite.app".to_string()
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        "hardwave-suite".to_string()
    }
}

/// Look for the expected binary at common layouts:
///   <install>/<exe>
///   <install>/hardwave-suite/<exe>
///   <install>/**/<exe>   (1-level walk)
fn find_exe(install_dir: &Path, exe_name: &str) -> Option<PathBuf> {
    let direct = install_dir.join(exe_name);
    if direct.exists() {
        return Some(direct);
    }
    // One level deep
    if let Ok(entries) = std::fs::read_dir(install_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let candidate = p.join(exe_name);
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }
    None
}

/// Resolve the portable-zip download URL by querying the Hardwave updater
/// endpoint and falling back to the latest GitHub release asset list.
async fn resolve_download_url() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("HardwaveSuiteInstaller/0.1")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    // Query GitHub releases for the portable zip asset directly.
    let gh: serde_json::Value = client
        .get("https://api.github.com/repos/Dishairano/hardwave-suite/releases/latest")
        .send()
        .await
        .map_err(|e| format!("GitHub API failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("GitHub API error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("GitHub API parse failed: {e}"))?;

    let assets = gh
        .get("assets")
        .and_then(|v| v.as_array())
        .ok_or("No assets on latest release")?;

    #[cfg(windows)]
    let wanted = "hardwave-suite-portable-windows";
    #[cfg(target_os = "macos")]
    let wanted = "hardwave-suite-portable-macos";
    #[cfg(all(not(windows), not(target_os = "macos")))]
    let wanted = "hardwave-suite-portable-linux";

    for a in assets {
        if let Some(name) = a.get("name").and_then(|v| v.as_str()) {
            if name.starts_with(wanted) && name.ends_with(".zip") {
                if let Some(url) = a.get("browser_download_url").and_then(|v| v.as_str()) {
                    return Ok(url.to_string());
                }
            }
        }
    }

    Err(format!(
        "Could not find {wanted}*.zip in the latest Hardwave Suite release. \
         Please re-run the installer, or download manually from \
         https://github.com/Dishairano/hardwave-suite/releases/latest"
    ))
}

/// Streams the download to disk and emits progress events.
async fn download_with_progress(
    app: &AppHandle,
    cancel: &Arc<AtomicBool>,
    url: &str,
    dest: &Path,
) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;

    let client = reqwest::Client::builder()
        .user_agent("HardwaveSuiteInstaller/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Download request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Download HTTP error: {e}"))?;

    let total = res.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("Cannot create {dest:?}: {e}"))?;

    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_pct: u32 = u32::MAX;

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::SeqCst) {
            return Err("Install cancelled".into());
        }
        let bytes = chunk.map_err(|e| format!("Download stream error: {e}"))?;
        file.write_all(&bytes)
            .await
            .map_err(|e| format!("Write error: {e}"))?;
        downloaded += bytes.len() as u64;

        if total > 0 {
            let pct = ((downloaded as f64 / total as f64) * 60.0) as u32; // download = 0-60%
            if pct != last_pct {
                last_pct = pct;
                let msg = format!(
                    "Downloading… {} / {}",
                    human_bytes(downloaded),
                    human_bytes(total)
                );
                emit(app, "downloading", pct, &msg);
            }
        }
    }
    file.flush().await.ok();
    Ok(())
}

fn extract_zip(zip_path: &Path, dest: &Path, app: &AppHandle) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| format!("Open zip failed: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Read zip failed: {e}"))?;

    let total = archive.len();
    for i in 0..total {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip entry {i} failed: {e}"))?;

        let outpath = match entry.enclosed_name() {
            Some(p) => dest.join(p),
            None => continue,
        };

        if entry.is_dir() {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("mkdir failed: {e}"))?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let mut outfile =
                std::fs::File::create(&outpath).map_err(|e| format!("create failed: {e}"))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("copy failed: {e}"))?;
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Some(mode) = entry.unix_mode() {
                let _ = std::fs::set_permissions(&outpath, std::fs::Permissions::from_mode(mode));
            }
        }

        let pct = 60 + (((i + 1) as f64 / total as f64) * 10.0) as u32; // extract 60-70
        emit(
            app,
            "extracting",
            pct,
            &format!("Extracting… {}/{}", i + 1, total),
        );
    }
    Ok(())
}

fn human_bytes(n: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut val = n as f64;
    let mut unit = 0;
    while val >= 1024.0 && unit < UNITS.len() - 1 {
        val /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{n} B")
    } else {
        format!("{val:.1} {}", UNITS[unit])
    }
}
