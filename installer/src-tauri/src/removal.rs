//! What an uninstall removes and in which order, kept apart from the Windows
//! code in `uninstall.rs` that carries it out, so the decisions are tested on
//! every platform.
//!
//! The plug-in step only touches what the Suite itself recorded: the slugs in
//! its `installed.json`, as `hardwave-<slug>.vst3` and `hardwave-<slug>.clap`
//! directly inside the folders the Suite installs plug-ins into.

use serde::Serialize;
use std::path::{Path, PathBuf};

/// One step of an uninstall, in the order the steps run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Step {
    /// Close the Suite if it runs from the install folder.
    CloseApp,
    /// Remove the plug-ins in the Suite's record (only when the option is ticked).
    RemovePlugins,
    /// Remove the install folder (what is left goes once this process exits).
    RemoveInstallFolder,
    /// Remove the desktop and Start menu shortcuts.
    RemoveShortcuts,
    /// Remove the Add/Remove Programs entry and the Suite's own registry key.
    RemoveRegistryKeys,
}

/// Why an uninstall stopped: the step that could not finish (none when the
/// uninstaller itself stopped), and the reason in words a producer can act on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Failure {
    pub step: Option<Step>,
    pub reason: String,
}

/// The steps of one uninstall. The plug-ins go only when the option is ticked,
/// and before the app: a plug-in that is open in a DAW then stops the
/// uninstall before the app is removed, so "Try again" starts from a whole app.
pub fn plan(remove_plugins: bool) -> Vec<Step> {
    let mut steps = vec![Step::CloseApp];
    if remove_plugins {
        steps.push(Step::RemovePlugins);
    }
    steps.extend([
        Step::RemoveInstallFolder,
        Step::RemoveShortcuts,
        Step::RemoveRegistryKeys,
    ]);
    steps
}

/// Runs `steps` in order with `run`, telling `on_progress` how many steps are
/// done before each step and once more when all are. Stops at the first step
/// that fails: the steps after it do not run.
pub fn run_plan(
    steps: &[Step],
    mut run: impl FnMut(Step) -> Result<(), String>,
    mut on_progress: impl FnMut(usize),
) -> Result<(), Failure> {
    for (done, &step) in steps.iter().enumerate() {
        on_progress(done);
        run(step).map_err(|reason| Failure {
            step: Some(step),
            reason,
        })?;
    }
    on_progress(steps.len());
    Ok(())
}

/// The Suite's system plug-in folders on Windows, where it installs by default.
pub const SYSTEM_VST3: &str = r"C:\Program Files\Common Files\VST3";
pub const SYSTEM_CLAP: &str = r"C:\Program Files\Common Files\CLAP";

/// The Suite's own files are a few kilobytes; anything far bigger is not one.
const MAX_SUITE_FILE_BYTES: u64 = 1024 * 1024;

/// Reads one of the Suite's small JSON files. `Ok(None)` when it does not exist.
pub fn read_suite_file(path: &Path) -> Result<Option<String>, String> {
    match std::fs::metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Cannot read {}: {e}", path.display())),
        Ok(m) if m.len() > MAX_SUITE_FILE_BYTES => {
            return Err(format!(
                "{} is too big to be the Suite's own file.",
                path.display()
            ))
        }
        Ok(_) => {}
    }
    std::fs::read_to_string(path)
        .map(Some)
        .map_err(|e| format!("Cannot read {}: {e}", path.display()))
}

/// Every folder the Suite installs plug-ins into, the same list the Suite
/// cleans itself: the folders chosen in its settings (`vst3_path`,
/// `clap_path`), the per-user folders under `local_data`, and the system
/// folders. A chosen folder that is not an absolute path is ignored.
pub fn plugin_folders(settings: Option<&str>, local_data: Option<&Path>) -> Vec<PathBuf> {
    let settings: serde_json::Map<String, serde_json::Value> = settings
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();
    let chosen = |key: &str| {
        settings
            .get(key)
            .and_then(|v| v.as_str())
            .map(PathBuf::from)
            .filter(|p| p.is_absolute())
    };
    let per_user = local_data.map(|d| d.join("Programs").join("Common"));

    let mut folders = Vec::new();
    for folder in [
        chosen("vst3_path"),
        chosen("clap_path"),
        per_user.as_ref().map(|p| p.join("VST3")),
        per_user.as_ref().map(|p| p.join("CLAP")),
        Some(PathBuf::from(SYSTEM_VST3)),
        Some(PathBuf::from(SYSTEM_CLAP)),
    ]
    .into_iter()
    .flatten()
    {
        if !folders.contains(&folder) {
            folders.push(folder);
        }
    }
    folders
}

/// The slugs in the Suite's record of installed plug-ins (`installed.json`, an
/// object of slug to version). A key that is not a plain slug is skipped, so
/// the record can never name a file outside the plug-in folders.
pub fn recorded_slugs(record: &str) -> Vec<String> {
    let Ok(serde_json::Value::Object(map)) = serde_json::from_str(record) else {
        return Vec::new();
    };
    let mut slugs: Vec<String> = map.keys().filter(|s| is_plain_slug(s)).cloned().collect();
    slugs.sort();
    slugs
}

fn is_plain_slug(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

/// The recorded plug-ins that are on this computer, each with the bundles found.
/// Older builds put the .clap in the VST3 folder, so both names are looked for
/// in every folder. Links and junctions are never followed or listed.
pub fn recorded_plugins_on_disk(record: &str, folders: &[PathBuf]) -> Vec<(String, Vec<PathBuf>)> {
    recorded_slugs(record)
        .into_iter()
        .filter_map(|slug| {
            let found: Vec<PathBuf> = folders
                .iter()
                .flat_map(|f| ["vst3", "clap"].map(|ext| f.join(format!("hardwave-{slug}.{ext}"))))
                .filter(|p| is_real_entry(p))
                .collect();
            (!found.is_empty()).then_some((slug, found))
        })
        .collect()
}

/// True for a file or folder that exists and is not a link or junction.
fn is_real_entry(path: &Path) -> bool {
    let Ok(meta) = std::fs::symlink_metadata(path) else {
        return false;
    };
    if meta.file_type().is_symlink() {
        return false;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        if meta.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return false;
        }
    }
    true
}

/// The name shown for a slug, as the Suite shows it: "wettboi" is "Wettboi".
pub fn display_name(slug: &str) -> String {
    let mut chars = slug.chars();
    chars
        .next()
        .map(|c| c.to_ascii_uppercase().to_string() + chars.as_str())
        .unwrap_or_default()
}

/// Removes the plug-ins recorded in `record_path` from `folders` and drops
/// them from the record. Stops at the first bundle that cannot be removed;
/// the plug-ins removed before it are dropped from the record all the same.
/// Returns the slugs removed. A missing record means nothing to remove.
pub fn remove_recorded_plugins(
    record_path: &Path,
    folders: &[PathBuf],
) -> Result<Vec<String>, String> {
    let Some(record) = read_suite_file(record_path)? else {
        return Ok(Vec::new());
    };

    let mut removed = Vec::new();
    let mut outcome = Ok(());
    for (slug, bundles) in recorded_plugins_on_disk(&record, folders) {
        if let Err(e) = bundles.iter().try_for_each(|b| remove_bundle(b)) {
            outcome = Err(e);
            break;
        }
        removed.push(slug);
    }

    // Keeps the record true for a later Suite install. The plug-ins are gone
    // either way, and a record that still lists one only makes the Suite offer
    // to install it again, so a failed write does not stop the uninstall.
    let _ = forget_in_record(record_path, &record, &removed);

    outcome.map(|()| removed)
}

fn remove_bundle(path: &Path) -> Result<(), String> {
    let is_dir = std::fs::symlink_metadata(path)
        .map(|m| m.is_dir())
        .unwrap_or(false);
    let result = if is_dir {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    };
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    match result {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        // ERROR_SHARING_VIOLATION: a DAW has the plug-in loaded.
        Err(e) if cfg!(windows) && e.raw_os_error() == Some(32) => Err(format!(
            "{name} is open in your DAW. Close your DAW, then try again."
        )),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => Err(format!(
            "Windows did not allow removing {}. Close your DAW and try again, \
             or untick the plug-ins and remove that file by hand.",
            path.display()
        )),
        Err(e) => Err(format!("{} could not be removed: {e}", path.display())),
    }
}

fn forget_in_record(record_path: &Path, record: &str, removed: &[String]) -> Result<(), String> {
    if removed.is_empty() {
        return Ok(());
    }
    let mut map: serde_json::Map<String, serde_json::Value> =
        serde_json::from_str(record).map_err(|e| e.to_string())?;
    for slug in removed {
        map.remove(slug);
    }
    let json = serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?;
    std::fs::write(record_path, json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh, empty folder under the system temp folder for one test.
    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hw-removal-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn option_off_removes_the_app_only() {
        assert_eq!(
            plan(false),
            vec![
                Step::CloseApp,
                Step::RemoveInstallFolder,
                Step::RemoveShortcuts,
                Step::RemoveRegistryKeys,
            ]
        );
    }

    #[test]
    fn option_on_also_removes_the_plugins_after_closing_the_app() {
        assert_eq!(
            plan(true),
            vec![
                Step::CloseApp,
                Step::RemovePlugins,
                Step::RemoveInstallFolder,
                Step::RemoveShortcuts,
                Step::RemoveRegistryKeys,
            ]
        );
    }

    #[test]
    fn steps_have_stable_names_for_the_window() {
        let names: Vec<String> = plan(true)
            .iter()
            .map(|s| {
                serde_json::to_value(s)
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .to_string()
            })
            .collect();
        assert_eq!(
            names,
            [
                "close_app",
                "remove_plugins",
                "remove_install_folder",
                "remove_shortcuts",
                "remove_registry_keys",
            ]
        );
    }

    #[test]
    fn a_failed_step_stops_the_steps_after_it() {
        let mut ran = Vec::new();
        let mut progress = Vec::new();
        let result = run_plan(
            &plan(true),
            |step| {
                ran.push(step);
                if step == Step::CloseApp {
                    Ok(())
                } else {
                    Err("still running".to_string())
                }
            },
            |done| progress.push(done),
        );
        assert_eq!(
            result,
            Err(Failure {
                step: Some(Step::RemovePlugins),
                reason: "still running".to_string(),
            })
        );
        assert_eq!(ran, vec![Step::CloseApp, Step::RemovePlugins]);
        assert_eq!(progress, vec![0, 1]);
    }

    #[test]
    fn a_full_run_reports_every_step_done() {
        let mut progress = Vec::new();
        let steps = plan(false);
        assert_eq!(
            run_plan(&steps, |_| Ok(()), |done| progress.push(done)),
            Ok(())
        );
        assert_eq!(progress, vec![0, 1, 2, 3, 4]);
    }

    #[test]
    fn record_keys_that_are_not_plain_slugs_are_skipped() {
        let record = r#"{
            "wettboi": "1.4.0",
            "analyser": "2.0.1",
            "../../Windows": "1.0.0",
            "a\\b": "1.0.0",
            "c:": "1.0.0",
            "": "1.0.0"
        }"#;
        assert_eq!(recorded_slugs(record), vec!["analyser", "wettboi"]);
    }

    #[test]
    fn a_broken_record_names_nothing() {
        assert!(recorded_slugs("not json").is_empty());
        assert!(recorded_slugs(r#"["wettboi"]"#).is_empty());
        assert!(recorded_slugs("").is_empty());
    }

    #[test]
    fn plugin_folders_follow_the_suite_settings_without_repeats() {
        let local = std::env::temp_dir().join("Local");
        let chosen_vst3 = std::env::temp_dir().join("My VST3");
        let settings = serde_json::json!({
            "vst3_path": chosen_vst3,
            "clap_path": "relative\\CLAP",
        })
        .to_string();
        assert_eq!(
            plugin_folders(Some(&settings), Some(&local)),
            vec![
                chosen_vst3,
                local.join("Programs").join("Common").join("VST3"),
                local.join("Programs").join("Common").join("CLAP"),
                PathBuf::from(SYSTEM_VST3),
                PathBuf::from(SYSTEM_CLAP),
            ]
        );
        assert_eq!(
            plugin_folders(None, None),
            vec![PathBuf::from(SYSTEM_VST3), PathBuf::from(SYSTEM_CLAP)]
        );
    }

    #[test]
    fn only_recorded_plugins_are_removed() {
        let root = scratch("only-recorded");
        let vst3 = root.join("VST3");
        let clap = root.join("CLAP");
        std::fs::create_dir_all(vst3.join("hardwave-wettboi.vst3").join("Contents")).unwrap();
        std::fs::create_dir_all(&clap).unwrap();
        std::fs::write(clap.join("hardwave-wettboi.clap"), "clap").unwrap();
        std::fs::write(clap.join("hardwave-analyser.clap"), "clap").unwrap();
        // Not in the record: a Hardwave build the Suite did not install, and
        // someone else's plug-in.
        std::fs::create_dir_all(vst3.join("hardwave-kickforge.vst3")).unwrap();
        std::fs::create_dir_all(vst3.join("OtherVendor.vst3")).unwrap();

        let record = root.join("installed.json");
        std::fs::write(
            &record,
            r#"{"wettboi":"1.4.0","analyser":"2.0.1","pumpcontrol":"0.9.0","../VST3/OtherVendor":"1"}"#,
        )
        .unwrap();

        let removed = remove_recorded_plugins(&record, &[vst3.clone(), clap.clone()]).unwrap();
        assert_eq!(removed, vec!["analyser", "wettboi"]);

        assert!(!vst3.join("hardwave-wettboi.vst3").exists());
        assert!(!clap.join("hardwave-wettboi.clap").exists());
        assert!(!clap.join("hardwave-analyser.clap").exists());
        assert!(vst3.join("hardwave-kickforge.vst3").exists());
        assert!(vst3.join("OtherVendor.vst3").exists());

        // The record keeps what was not removed.
        let left = recorded_slugs(&std::fs::read_to_string(&record).unwrap());
        assert_eq!(left, vec!["pumpcontrol"]);

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn without_a_record_nothing_is_removed() {
        let root = scratch("no-record");
        let vst3 = root.join("VST3");
        std::fs::create_dir_all(vst3.join("hardwave-wettboi.vst3")).unwrap();

        let removed =
            remove_recorded_plugins(&root.join("installed.json"), std::slice::from_ref(&vst3))
                .unwrap();
        assert!(removed.is_empty());
        assert!(vst3.join("hardwave-wettboi.vst3").exists());

        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn plugins_on_disk_lists_only_what_is_there() {
        let root = scratch("on-disk");
        let vst3 = root.join("VST3");
        std::fs::create_dir_all(vst3.join("hardwave-wettboi.vst3")).unwrap();
        let found = recorded_plugins_on_disk(
            r#"{"wettboi":"1.4.0","analyser":"2.0.1"}"#,
            std::slice::from_ref(&vst3),
        );
        assert_eq!(
            found,
            vec![(
                "wettboi".to_string(),
                vec![vst3.join("hardwave-wettboi.vst3")]
            )]
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn display_names_start_with_a_capital() {
        assert_eq!(display_name("wettboi"), "Wettboi");
        assert_eq!(display_name(""), "");
    }
}
