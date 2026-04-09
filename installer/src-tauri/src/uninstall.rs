//! Windows uninstall support.
//!
//! - `register_uninstaller`: Writes the Add/Remove Programs entry under
//!   HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\HardwaveSuite
//!   with a DisplayName, Publisher, UninstallString, and icon.
//!
//! - `uninstall`: Reads the install directory out of the registry, deletes
//!   the Suite files, removes shortcuts, and clears the registry entry.

use std::path::{Path, PathBuf};
use winreg::enums::*;
use winreg::RegKey;

const UNINSTALL_KEY_PATH: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Uninstall\HardwaveSuite";
const INSTALL_KEY_PATH: &str = r"Software\Hardwave Studios\Hardwave Suite";

/// Writes the uninstall registry entry so Suite appears in Add/Remove Programs.
/// Also copies the running installer into the install directory as
/// `Hardwave Suite Uninstaller.exe` so the UninstallString is stable.
pub fn register_uninstaller(install_dir: &Path, suite_exe: &Path) -> Result<(), String> {
    // 1. Copy self as the uninstaller binary
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Cannot find installer exe: {e}"))?;
    let uninstaller_path = install_dir.join("Hardwave Suite Uninstaller.exe");
    if current_exe != uninstaller_path {
        std::fs::copy(&current_exe, &uninstaller_path)
            .map_err(|e| format!("Cannot copy uninstaller: {e}"))?;
    }

    // 2. Write the uninstall entry
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (uninstall_key, _) = hkcu
        .create_subkey(UNINSTALL_KEY_PATH)
        .map_err(|e| format!("Cannot create uninstall key: {e}"))?;

    let install_dir_str = install_dir.to_string_lossy().to_string();
    let suite_exe_str = suite_exe.to_string_lossy().to_string();
    let uninstall_cmd = format!("\"{}\" --uninstall", uninstaller_path.display());

    set_str(&uninstall_key, "DisplayName", "Hardwave Suite")?;
    set_str(
        &uninstall_key,
        "Publisher",
        "Hardwave Studios",
    )?;
    set_str(
        &uninstall_key,
        "DisplayIcon",
        &format!("\"{}\"", suite_exe_str),
    )?;
    set_str(&uninstall_key, "InstallLocation", &install_dir_str)?;
    set_str(&uninstall_key, "UninstallString", &uninstall_cmd)?;
    set_str(&uninstall_key, "QuietUninstallString", &uninstall_cmd)?;
    set_str(
        &uninstall_key,
        "URLInfoAbout",
        "https://hardwavestudios.com",
    )?;
    set_str(
        &uninstall_key,
        "HelpLink",
        "https://hardwavestudios.com/support",
    )?;
    set_dword(&uninstall_key, "NoModify", 1)?;
    set_dword(&uninstall_key, "NoRepair", 1)?;

    // Estimated size (in KB) — rough, based on the install dir.
    let size_kb = folder_size_kb(install_dir).unwrap_or(200_000);
    set_dword(&uninstall_key, "EstimatedSize", size_kb as u32)?;

    // Also write a key Hardwave can query to know where Suite is installed.
    let (install_key, _) = hkcu
        .create_subkey(INSTALL_KEY_PATH)
        .map_err(|e| format!("Cannot create install key: {e}"))?;
    set_str(&install_key, "InstallLocation", &install_dir_str)?;
    set_str(&install_key, "Executable", &suite_exe_str)?;

    Ok(())
}

/// Reads install dir from registry, removes files, shortcuts, and registry.
pub fn uninstall() -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let install_dir = hkcu
        .open_subkey(UNINSTALL_KEY_PATH)
        .ok()
        .and_then(|k| k.get_value::<String, _>("InstallLocation").ok())
        .map(PathBuf::from);

    // Remove shortcuts first.
    crate::shortcut::remove_shortcuts();

    if let Some(dir) = install_dir {
        if dir.exists() {
            // We can't delete the currently-running uninstaller binary while
            // it's executing. Schedule a delayed cleanup via cmd.exe and exit.
            schedule_delayed_cleanup(&dir);
        }
    }

    // Clear registry entries.
    let _ = hkcu.delete_subkey_all(UNINSTALL_KEY_PATH);
    let _ = hkcu.delete_subkey_all(INSTALL_KEY_PATH);

    Ok(())
}

/// Schedules the install folder for deletion after the current process exits.
/// Uses `cmd /c timeout 2 && rmdir /s /q "<dir>"` detached.
fn schedule_delayed_cleanup(dir: &Path) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const DETACHED_PROCESS: u32 = 0x00000008;

    let dir_str = dir.to_string_lossy().to_string();
    let cmd = format!(
        "timeout /t 2 /nobreak > nul & rmdir /s /q \"{}\"",
        dir_str
    );
    let _ = std::process::Command::new("cmd.exe")
        .args(["/C", &cmd])
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn();
}

// ─── helpers ─────────────────────────────────────────────────────────────────

fn set_str(key: &RegKey, name: &str, value: &str) -> Result<(), String> {
    key.set_value(name, &value.to_string())
        .map_err(|e| format!("Cannot set {name}: {e}"))
}

fn set_dword(key: &RegKey, name: &str, value: u32) -> Result<(), String> {
    key.set_value(name, &value)
        .map_err(|e| format!("Cannot set {name}: {e}"))
}

fn folder_size_kb(path: &Path) -> Option<u64> {
    let mut total: u64 = 0;
    walk(path, &mut total).ok()?;
    Some(total / 1024)
}

fn walk(path: &Path, total: &mut u64) -> std::io::Result<()> {
    if path.is_file() {
        *total += path.metadata()?.len();
        return Ok(());
    }
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let p = entry.path();
        if p.is_dir() {
            walk(&p, total)?;
        } else {
            *total += entry.metadata()?.len();
        }
    }
    Ok(())
}
