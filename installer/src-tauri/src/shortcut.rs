//! Windows shortcut creation (Desktop + Start Menu).

use std::path::{Path, PathBuf};

fn start_menu_dir() -> Option<PathBuf> {
    // Per-user Start Menu Programs folder
    dirs::data_dir().map(|p| {
        p.join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs")
    })
}

fn desktop_dir() -> Option<PathBuf> {
    dirs::desktop_dir()
}

fn create_lnk(target: &Path, lnk_path: &Path) -> Result<(), String> {
    use mslnk::ShellLink;
    let target_str = target
        .to_str()
        .ok_or_else(|| "Target path is not valid UTF-8".to_string())?;
    let lnk_str = lnk_path
        .to_str()
        .ok_or_else(|| "Shortcut path is not valid UTF-8".to_string())?;

    if let Some(parent) = lnk_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Cannot create {parent:?}: {e}"))?;
    }

    let mut sl =
        ShellLink::new(target_str).map_err(|e| format!("ShellLink create failed: {e}"))?;
    sl.set_name(Some("Hardwave Suite".to_string()));
    if let Some(work_dir) = target.parent().and_then(|p| p.to_str()) {
        sl.set_working_dir(Some(work_dir.to_string()));
    }
    sl.create_lnk(lnk_str)
        .map_err(|e| format!("create_lnk failed: {e}"))?;
    Ok(())
}

pub fn create_desktop_shortcut(target: &Path) -> Result<(), String> {
    let desktop = desktop_dir().ok_or("Cannot resolve Desktop directory")?;
    let lnk = desktop.join("Hardwave Suite.lnk");
    create_lnk(target, &lnk)
}

pub fn create_start_menu_shortcut(target: &Path) -> Result<(), String> {
    let start = start_menu_dir().ok_or("Cannot resolve Start Menu directory")?;
    let folder = start.join("Hardwave Studios");
    std::fs::create_dir_all(&folder).map_err(|e| format!("Cannot create {folder:?}: {e}"))?;
    let lnk = folder.join("Hardwave Suite.lnk");
    create_lnk(target, &lnk)
}

pub fn remove_shortcuts() {
    if let Some(d) = desktop_dir() {
        let _ = std::fs::remove_file(d.join("Hardwave Suite.lnk"));
    }
    if let Some(s) = start_menu_dir() {
        let folder = s.join("Hardwave Studios");
        let _ = std::fs::remove_file(folder.join("Hardwave Suite.lnk"));
        let _ = std::fs::remove_dir(&folder);
    }
}
