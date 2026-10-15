//! Windows uninstall support.
//!
//! - `register_uninstaller`: Writes the Add/Remove Programs entry under
//!   HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\HardwaveSuite
//!   with a DisplayName, Publisher, UninstallString, and icon.
//!
//! - `run_interactive`: Uninstall mode. Confirms with a native dialog, runs
//!   `uninstall`, and shows the result (both dialogs skipped with --quiet).
//!
//! - `uninstall`: Reads the install directory out of the registry, closes a
//!   running Suite, removes shortcuts, deletes the Suite files, and clears
//!   the registry entries.

use std::path::{Path, PathBuf};
use winreg::enums::*;
use winreg::RegKey;

const UNINSTALL_KEY_PATH: &str =
    r"Software\Microsoft\Windows\CurrentVersion\Uninstall\HardwaveSuite";
const INSTALL_KEY_PATH: &str = r"Software\Hardwave Studios\Hardwave Suite";
const UNINSTALLER_EXE_NAME: &str = "Hardwave Suite Uninstaller.exe";
const DIALOG_TITLE: &str = "Uninstall Hardwave Suite";
/// Exit code Windows uses for "the user cancelled" (ERROR_INSTALL_USEREXIT).
const EXIT_CANCELLED: i32 = 1602;

/// Writes the uninstall registry entry so Suite appears in Add/Remove Programs.
/// Also copies the running installer into the install directory as
/// `Hardwave Suite Uninstaller.exe` so the UninstallString is stable.
pub fn register_uninstaller(install_dir: &Path, suite_exe: &Path) -> Result<(), String> {
    // 1. Copy self as the uninstaller binary
    let current_exe =
        std::env::current_exe().map_err(|e| format!("Cannot find installer exe: {e}"))?;
    let uninstaller_path = install_dir.join(UNINSTALLER_EXE_NAME);
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
    let quiet_uninstall_cmd = format!("{uninstall_cmd} --quiet");

    set_str(&uninstall_key, "DisplayName", "Hardwave Suite")?;
    set_str(&uninstall_key, "Publisher", "Hardwave Studios")?;
    set_str(
        &uninstall_key,
        "DisplayIcon",
        &format!("\"{}\"", suite_exe_str),
    )?;
    set_str(&uninstall_key, "InstallLocation", &install_dir_str)?;
    set_str(&uninstall_key, "UninstallString", &uninstall_cmd)?;
    set_str(&uninstall_key, "QuietUninstallString", &quiet_uninstall_cmd)?;
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

/// Uninstall mode entry point. Asks first, uninstalls, then reports the
/// result, all with native message boxes (no Tauri window). `quiet` skips
/// both dialogs. Returns the process exit code.
pub fn run_interactive(quiet: bool) -> i32 {
    if !quiet && !confirm_removal() {
        return EXIT_CANCELLED;
    }

    match uninstall() {
        Ok(cleanup_dir) => {
            if !quiet {
                show_message(rfd::MessageLevel::Info, "Hardwave Suite has been removed.");
            }
            // The folder still holds this running exe, so it is removed by a
            // detached cleanup once this process has exited.
            if let Some(dir) = cleanup_dir {
                schedule_delayed_cleanup(&dir);
            }
            0
        }
        Err(e) => {
            if quiet {
                eprintln!("Uninstall failed: {e}");
            } else {
                show_message(
                    rfd::MessageLevel::Error,
                    &format!("Hardwave Suite could not be removed.\n\n{e}"),
                );
            }
            1
        }
    }
}

fn confirm_removal() -> bool {
    let answer = rfd::MessageDialog::new()
        .set_level(rfd::MessageLevel::Warning)
        .set_title(DIALOG_TITLE)
        .set_description(
            "Remove Hardwave Suite from this computer? \
             Your plug-ins stay installed in your DAW folders.",
        )
        .set_buttons(rfd::MessageButtons::OkCancelCustom(
            "Remove".to_string(),
            "Cancel".to_string(),
        ))
        .show();
    match answer {
        rfd::MessageDialogResult::Custom(label) => label == "Remove",
        rfd::MessageDialogResult::Ok | rfd::MessageDialogResult::Yes => true,
        _ => false,
    }
}

fn show_message(level: rfd::MessageLevel, text: &str) {
    rfd::MessageDialog::new()
        .set_level(level)
        .set_title(DIALOG_TITLE)
        .set_description(text)
        .set_buttons(rfd::MessageButtons::Ok)
        .show();
}

/// Reads the install dir from the registry, closes a running Suite, removes
/// shortcuts, the install folder's contents and both registry keys.
/// Installed plug-ins and settings outside the install folder are not touched.
///
/// On success returns the install folder, which still has to be removed
/// after this process exits (it may contain the running uninstaller).
pub fn uninstall() -> Result<Option<PathBuf>, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let install_dir = read_string(&hkcu, UNINSTALL_KEY_PATH, "InstallLocation")
        .or_else(|| read_string(&hkcu, INSTALL_KEY_PATH, "InstallLocation"))
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from);

    let Some(dir) = install_dir else {
        crate::shortcut::remove_shortcuts();
        return Err(
            "Windows has no record of where Hardwave Suite is installed for this user, \
             so there is nothing to remove."
                .to_string(),
        );
    };

    // 1. Close a running Suite so its files are not locked.
    if dir.is_dir() {
        close_processes_in(&dir);
    }

    // 2. Shortcuts.
    crate::shortcut::remove_shortcuts();

    // 3. Install folder. Everything except the running uninstaller goes now,
    //    so a locked file is reported instead of silently left behind.
    let mut cleanup_dir = None;
    if dir.is_dir() {
        check_safe_to_delete(&dir)?;
        let self_exe = std::env::current_exe().ok();
        remove_folder_contents(&dir, self_exe.as_deref())?;
        cleanup_dir = Some(dir);
    }

    // 4. Registry entries.
    delete_key(&hkcu, UNINSTALL_KEY_PATH)?;
    delete_key(&hkcu, INSTALL_KEY_PATH)?;

    Ok(cleanup_dir)
}

/// Closes every process whose executable lives in `dir` (the Suite app),
/// except this uninstaller. Asks the windows to close first, then ends
/// whatever is still running after a few seconds.
fn close_processes_in(dir: &Path) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // Paths go in through environment variables, so no quoting of the path
    // into the script is needed.
    const SCRIPT: &str = r#"
$dir = $env:HW_UNINSTALL_DIR.TrimEnd('\') + '\'
$self = [int]$env:HW_UNINSTALL_PID
$procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Id -ne $self -and $_.Path -and
    $_.Path.StartsWith($dir, [System.StringComparison]::OrdinalIgnoreCase)
})
foreach ($p in $procs) { try { [void]$p.CloseMainWindow() } catch {} }
foreach ($p in $procs) {
    try {
        if (-not $p.WaitForExit(3000)) { $p.Kill(); [void]$p.WaitForExit(5000) }
    } catch {}
}
"#;

    // If PowerShell cannot run, a still-running Suite shows up below as a
    // file that could not be removed, with a message saying so.
    let _ = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            SCRIPT,
        ])
        .env("HW_UNINSTALL_DIR", dir)
        .env("HW_UNINSTALL_PID", std::process::id().to_string())
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

/// Refuses folders that can never be a Suite install on their own (a drive
/// root or a standard user folder), so a bad registry value cannot make the
/// uninstaller wipe them.
fn check_safe_to_delete(dir: &Path) -> Result<(), String> {
    let canon = |p: &Path| std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let target = canon(dir);
    let is_root = target.parent().is_none() || dir.parent().is_none();
    let protected = [
        dirs::home_dir(),
        dirs::desktop_dir(),
        dirs::document_dir(),
        dirs::download_dir(),
        dirs::audio_dir(),
        dirs::data_dir(),
        dirs::data_local_dir(),
        dirs::data_local_dir().map(|p| p.join("Programs")),
    ];
    let is_protected = protected.iter().flatten().any(|p| canon(p) == target);
    if is_root || is_protected {
        return Err(format!(
            "The install folder on record is {}, which is not a Hardwave Suite folder, \
             so it was left alone. Delete the Hardwave Suite files from it by hand.",
            dir.display()
        ));
    }
    Ok(())
}

/// Removes everything inside `dir` except `keep` (the running uninstaller).
fn remove_folder_contents(dir: &Path, keep: Option<&Path>) -> Result<(), String> {
    let entries = std::fs::read_dir(dir)
        .map_err(|e| format!("Cannot open the install folder {}: {e}", dir.display()))?;
    let keep = keep.and_then(|k| std::fs::canonicalize(k).ok());

    let mut failed = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if keep.is_some() && std::fs::canonicalize(&path).ok() == keep {
            continue;
        }
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let removed = if is_dir {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        };
        if removed.is_err() {
            failed.push(entry.file_name().to_string_lossy().to_string());
        }
    }

    if failed.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Some files in {} are in use and could not be deleted: {}.\n\n\
             Close Hardwave Suite (also in the system tray), then run the uninstaller again.",
            dir.display(),
            failed.join(", ")
        ))
    }
}

fn read_string(hkcu: &RegKey, path: &str, name: &str) -> Option<String> {
    hkcu.open_subkey(path)
        .ok()
        .and_then(|k| k.get_value::<String, _>(name).ok())
}

fn delete_key(hkcu: &RegKey, path: &str) -> Result<(), String> {
    match hkcu.delete_subkey_all(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Cannot remove the registry entry {path}: {e}")),
    }
}

/// Schedules the install folder for deletion after the current process exits.
/// Uses `cmd /c timeout 2 && rmdir /s /q "<dir>"` detached.
fn schedule_delayed_cleanup(dir: &Path) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const DETACHED_PROCESS: u32 = 0x00000008;

    let dir_str = dir.to_string_lossy().to_string();
    let cmd = format!("timeout /t 2 /nobreak > nul & rmdir /s /q \"{}\"", dir_str);
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
