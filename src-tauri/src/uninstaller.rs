//! Keeps "Hardwave Suite Uninstaller.exe" current on Windows.
//!
//! The installer copies itself into the install folder as the uninstaller
//! (`register_uninstaller` in installer/src-tauri/src/uninstall.rs), and the
//! Suite's own updates never touch that copy. A computer that installed before
//! Suite 0.23.2 therefore kept an uninstaller that opens the installer.
//!
//! At start, in the background, the Suite reads the record next to the
//! uninstaller ("Hardwave Suite Uninstaller.json": the Suite release whose
//! HardwaveSuite-Setup.exe it is, and the file's SHA-256). No record, a record
//! that does not read, an earlier release, or a file that no longer matches the
//! record (an older setup run again copies itself over the uninstaller) all
//! count as old. An old uninstaller is replaced with HardwaveSuite-Setup.exe
//! from the GitHub release of the running version, the release the updater's
//! latest.json is published with, once Windows trusts its Authenticode
//! signature and the signer is the publisher of the running Suite. Any failure
//! leaves the old file in place and goes to the log, and the next attempt waits
//! a day.
//!
//! Only the Windows part (`platform`) does any of this; the rest is the
//! decisions and file handling it uses, kept here so they are tested on every
//! platform.

use semver::Version;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

#[cfg(windows)]
pub use platform::spawn_refresh;

/// The uninstaller in the install folder, as `register_uninstaller` names it.
const UNINSTALLER_EXE_NAME: &str = "Hardwave Suite Uninstaller.exe";
/// The record next to it.
const RECORD_NAME: &str = "Hardwave Suite Uninstaller.json";
/// The installer each release carries.
const SETUP_EXE_NAME: &str = "HardwaveSuite-Setup.exe";
/// Where the release assets are, per tag.
const RELEASES: &str = "https://github.com/Dishairano/hardwave-suite/releases/download";
/// HardwaveSuite-Setup.exe is some megabytes; anything outside these sizes is
/// not it and is not written to disk.
const MIN_SETUP_BYTES: usize = 64 * 1024;
const MAX_SETUP_BYTES: usize = 64 * 1024 * 1024;
/// The record is a few dozen bytes; a larger file is not one.
const MAX_RECORD_BYTES: u64 = 4096;
/// The time between two attempts, whatever the first one ended with.
const RETRY_AFTER_SECS: u64 = 24 * 60 * 60;
/// The last attempt, kept in the Suite's data folder, which is writable even
/// when the install folder is not.
const ATTEMPT_MARK_NAME: &str = "uninstaller-refresh-attempt";

/// What the record next to the uninstaller holds.
#[derive(Debug, Deserialize)]
struct Record {
    /// The Suite release whose HardwaveSuite-Setup.exe the uninstaller is.
    release: String,
    /// SHA-256 of the uninstaller as it was written, in hex.
    sha256: String,
}

fn record_text(release: &Version, sha256: &str) -> String {
    serde_json::json!({ "release": release.to_string(), "sha256": sha256 }).to_string()
}

/// True when `release` is earlier than the running version. A release that is
/// not a version counts as earlier.
fn came_from_older_release(release: &str, running: &Version) -> bool {
    match Version::parse(release.trim()) {
        Ok(release) => release < *running,
        Err(_) => true,
    }
}

/// True when the uninstaller, whose SHA-256 is `file_sha256`, has to be
/// replaced for the running version. Without a record that reads, it is old.
/// An uninstaller from a later release (the Suite was downgraded) is kept.
fn needs_refresh(record: Option<&str>, running: &Version, file_sha256: &str) -> bool {
    let Some(record) = record.and_then(|text| serde_json::from_str::<Record>(text).ok()) else {
        return true;
    };
    came_from_older_release(&record.release, running)
        || !record.sha256.trim().eq_ignore_ascii_case(file_sha256)
}

/// True when an attempt may start at `now`: none was made yet, or the last one
/// began a day ago or more. A last attempt after `now` means the clock was set
/// back, and waiting for it could mean never trying again.
fn may_try(last_attempt: Option<u64>, now: u64) -> bool {
    match last_attempt {
        None => true,
        Some(last) => last > now || now - last >= RETRY_AFTER_SECS,
    }
}

fn setup_url(running: &Version) -> String {
    format!("{RELEASES}/v{running}/{SETUP_EXE_NAME}")
}

/// Refuses a download that cannot be the installer before it is written.
fn check_download(setup: &[u8]) -> Result<(), String> {
    if !(MIN_SETUP_BYTES..=MAX_SETUP_BYTES).contains(&setup.len()) {
        return Err(format!(
            "the download is {} bytes, which is not the size of {SETUP_EXE_NAME}",
            setup.len()
        ));
    }
    if !setup.starts_with(b"MZ") {
        return Err("the download is not a Windows program".to_string());
    }
    Ok(())
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn file_sha256(path: &Path) -> std::io::Result<String> {
    let mut hasher = Sha256::new();
    std::io::copy(&mut std::fs::File::open(path)?, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// A small text file, or None when it is missing, longer than `max` bytes or
/// not UTF-8.
fn read_small(path: &Path, max: u64) -> Option<String> {
    use std::io::Read;
    let mut text = String::new();
    std::fs::File::open(path)
        .ok()?
        .take(max + 1)
        .read_to_string(&mut text)
        .ok()?;
    (text.len() as u64 <= max).then_some(text)
}

/// True when the uninstaller in `dir` has to be replaced for `running`.
fn needs_refresh_in(dir: &Path, running: &Version) -> Result<bool, String> {
    let sha256 = file_sha256(&dir.join(UNINSTALLER_EXE_NAME))
        .map_err(|e| format!("cannot read the uninstaller: {e}"))?;
    let record = read_small(&dir.join(RECORD_NAME), MAX_RECORD_BYTES);
    Ok(needs_refresh(record.as_deref(), running, &sha256))
}

/// Starts an attempt when the last one, noted in `mark`, is a day old or more.
/// The attempt is noted before it starts, so one that fails or is cut short
/// counts too. When it cannot be noted, none is made.
fn begin_attempt(mark: &Path, now: u64) -> Result<bool, String> {
    let last = read_small(mark, 64).and_then(|text| text.trim().parse::<u64>().ok());
    if !may_try(last, now) {
        return Ok(false);
    }
    if let Some(parent) = mark.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("cannot note the attempt, so none is made: {e}"))?;
    }
    std::fs::write(mark, now.to_string())
        .map_err(|e| format!("cannot note the attempt, so none is made: {e}"))?;
    Ok(true)
}

/// The name a download has in `dir` until it has been checked. It carries the
/// process id, so two Suites started together never write the same file.
fn download_path(dir: &Path) -> PathBuf {
    dir.join(format!(
        "{UNINSTALLER_EXE_NAME}.{}.download",
        std::process::id()
    ))
}

/// The download under its temporary name. It is removed when this goes out of
/// scope; after the rename over the uninstaller there is nothing left to remove.
struct Download(PathBuf);

impl Drop for Download {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Writes `setup` to a temporary name in `dir`, has `verify` check that file,
/// and only then renames it over the uninstaller and writes the record. On any
/// failure the old uninstaller stays as it was.
fn replace_in(
    dir: &Path,
    setup: &[u8],
    running: &Version,
    verify: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<(), String> {
    use std::io::Write;
    check_download(setup)?;

    let download = Download(download_path(dir));
    std::fs::File::create(&download.0)
        .and_then(|mut file| {
            file.write_all(setup)?;
            file.sync_all()
        })
        .map_err(|e| format!("cannot write the download to the install folder: {e}"))?;
    verify(&download.0)?;

    std::fs::rename(&download.0, dir.join(UNINSTALLER_EXE_NAME))
        .map_err(|e| format!("cannot replace the uninstaller (it may be in use): {e}"))?;
    std::fs::write(
        dir.join(RECORD_NAME),
        record_text(running, &sha256_hex(setup)),
    )
    .map_err(|e| format!("the uninstaller was replaced, but its record cannot be written: {e}"))
}

#[cfg(windows)]
mod platform {
    use super::{
        begin_attempt, needs_refresh_in, replace_in, setup_url, ATTEMPT_MARK_NAME, MAX_SETUP_BYTES,
        SETUP_EXE_NAME, UNINSTALLER_EXE_NAME,
    };
    use futures_util::StreamExt;
    use semver::Version;
    use std::path::Path;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use tauri_plugin_log::log;
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::Security::WinTrust::{
        WTHelperGetProvCertFromChain, WTHelperGetProvSignerFromChain,
        WTHelperProvDataFromStateData, WinVerifyTrust, CRYPT_PROVIDER_CERT,
        WINTRUST_ACTION_GENERIC_VERIFY_V2, WINTRUST_DATA, WINTRUST_DATA_0, WINTRUST_FILE_INFO,
        WTD_CHOICE_FILE, WTD_REVOCATION_CHECK_CHAIN_EXCLUDE_ROOT, WTD_REVOKE_WHOLECHAIN,
        WTD_STATEACTION_CLOSE, WTD_STATEACTION_VERIFY, WTD_UICONTEXT_EXECUTE, WTD_UI_NONE,
    };

    /// Lets the window load before the download starts.
    const START_DELAY: Duration = Duration::from_secs(30);

    /// Checks the uninstaller in the background and replaces it when it is
    /// older than this release. Never shows anything; the outcome goes to the
    /// log.
    pub fn spawn_refresh(app: &tauri::AppHandle) {
        let running = app.package_info().version.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(START_DELAY).await;
            match refresh(running).await {
                Ok(Some(outcome)) => log::info!("[uninstaller] {outcome}"),
                Ok(None) => {}
                Err(e) => log::warn!("[uninstaller] the old uninstaller stays: {e}"),
            }
        });
    }

    async fn refresh(running: Version) -> Result<Option<String>, String> {
        let exe =
            std::env::current_exe().map_err(|e| format!("cannot find the running Suite: {e}"))?;
        let Some(dir) = exe.parent().map(Path::to_path_buf) else {
            return Ok(None);
        };
        if !dir.join(UNINSTALLER_EXE_NAME).is_file() {
            return Ok(None);
        }
        let (check_dir, check_running) = (dir.clone(), running.clone());
        if !blocking(move || needs_refresh_in(&check_dir, &check_running)).await? {
            return Ok(None);
        }

        let mark = crate::data_dir().join(ATTEMPT_MARK_NAME);
        if !begin_attempt(&mark, unix_now())? {
            return Ok(Some(format!(
                "it is older than {running}; the last attempt to replace it was less than a day ago"
            )));
        }

        // A download is only taken when its signer is the publisher of this
        // Suite, so a build without a signature (a developer's) stops here.
        let ours = blocking(move || verified_signer(&exe)).await.map_err(|e| {
            format!("the running Suite's own signature does not check out, so there is no publisher to compare with: {e}")
        })?;
        let setup = download(&setup_url(&running)).await?;
        let replace_running = running.clone();
        blocking(move || {
            replace_in(&dir, &setup, &replace_running, |file| {
                let theirs = verified_signer(file)
                    .map_err(|e| format!("{SETUP_EXE_NAME} {replace_running}: {e}"))?;
                if theirs == ours {
                    Ok(())
                } else {
                    Err(format!(
                        "{SETUP_EXE_NAME} {replace_running} is signed, but not by the publisher of this Suite"
                    ))
                }
            })
        })
        .await?;

        let _ = std::fs::remove_file(&mark);
        Ok(Some(format!("replaced with {SETUP_EXE_NAME} of {running}")))
    }

    /// Runs file and signature work off the async threads.
    async fn blocking<T, F>(work: F) -> Result<T, String>
    where
        T: Send + 'static,
        F: FnOnce() -> Result<T, String> + Send + 'static,
    {
        tauri::async_runtime::spawn_blocking(work)
            .await
            .map_err(|e| format!("a background step stopped: {e}"))?
    }

    fn unix_now() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |d| d.as_secs())
    }

    /// The whole file, refused as soon as it is larger than any installer.
    async fn download(url: &str) -> Result<Vec<u8>, String> {
        let client = reqwest::Client::builder()
            .user_agent("HardwaveSuite")
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(300))
            .build()
            .map_err(|e| format!("cannot set up the download: {e}"))?;
        let response = client
            .get(url)
            .send()
            .await
            .and_then(|r| r.error_for_status())
            .map_err(|e| format!("cannot download {url}: {e}"))?;
        if response
            .content_length()
            .is_some_and(|len| len > MAX_SETUP_BYTES as u64)
        {
            return Err(format!("{url} is larger than any installer"));
        }

        let mut body = Vec::new();
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("the download of {url} broke off: {e}"))?;
            if body.len() + chunk.len() > MAX_SETUP_BYTES {
                return Err(format!("{url} is larger than any installer"));
            }
            body.extend_from_slice(&chunk);
        }
        Ok(body)
    }

    /// Who signed a file, as Windows verified it.
    #[derive(PartialEq, Eq)]
    struct Signer {
        /// Subject name of the signing certificate, as encoded in it. Azure
        /// Trusted Signing issues a new certificate every few days, all with
        /// the subject of the same validated publisher.
        subject: Vec<u8>,
        /// Subject name of the root the certificate chain ends in.
        root: Vec<u8>,
    }

    /// Has Windows (WinVerifyTrust) check that `file` carries a valid
    /// Authenticode signature that chains to a trusted root and is not
    /// revoked, and returns who signed it.
    fn verified_signer(file: &Path) -> Result<Signer, String> {
        use std::os::windows::ffi::OsStrExt;

        let path: Vec<u16> = file
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut file_info = WINTRUST_FILE_INFO {
            cbStruct: std::mem::size_of::<WINTRUST_FILE_INFO>() as u32,
            pcwszFilePath: path.as_ptr(),
            hFile: std::ptr::null_mut(),
            pgKnownSubject: std::ptr::null_mut(),
        };
        let mut data = WINTRUST_DATA {
            cbStruct: std::mem::size_of::<WINTRUST_DATA>() as u32,
            pPolicyCallbackData: std::ptr::null_mut(),
            pSIPClientData: std::ptr::null_mut(),
            dwUIChoice: WTD_UI_NONE,
            fdwRevocationChecks: WTD_REVOKE_WHOLECHAIN,
            dwUnionChoice: WTD_CHOICE_FILE,
            Anonymous: WINTRUST_DATA_0 {
                pFile: std::ptr::addr_of_mut!(file_info),
            },
            dwStateAction: WTD_STATEACTION_VERIFY,
            hWVTStateData: std::ptr::null_mut(),
            pwszURLReference: std::ptr::null_mut(),
            dwProvFlags: WTD_REVOCATION_CHECK_CHAIN_EXCLUDE_ROOT,
            dwUIContext: WTD_UICONTEXT_EXECUTE,
            pSignatureSettings: std::ptr::null_mut(),
        };
        let mut action = WINTRUST_ACTION_GENERIC_VERIFY_V2;

        // SAFETY: `data` is a complete WINTRUST_DATA for one file; `file_info`
        // and the NUL-terminated `path` it points to live until after the
        // closing call below. No window is passed and no UI is asked for.
        let status = unsafe {
            WinVerifyTrust(
                std::ptr::null_mut(),
                &mut action,
                std::ptr::addr_of_mut!(data).cast(),
            )
        };
        let signer = if status == 0 {
            signer_from_state(data.hWVTStateData)
        } else {
            Err(format!(
                "Windows does not trust its signature (0x{:08X})",
                status as u32
            ))
        };

        // The verify call keeps the signer chain read above until it is closed.
        data.dwStateAction = WTD_STATEACTION_CLOSE;
        // SAFETY: the same structure as the verify call, with its state handle;
        // closing releases what that call kept, whatever its result was.
        unsafe {
            WinVerifyTrust(
                std::ptr::null_mut(),
                &mut action,
                std::ptr::addr_of_mut!(data).cast(),
            );
        }
        signer
    }

    /// The primary signer of a successful verify call whose state is still open.
    fn signer_from_state(state: HANDLE) -> Result<Signer, String> {
        // SAFETY: `state` comes from a successful WTD_STATEACTION_VERIFY call
        // that has not been closed yet.
        let provider = unsafe { WTHelperProvDataFromStateData(state) };
        if provider.is_null() {
            return Err("Windows kept no signer for it".to_string());
        }
        // SAFETY: `provider` is the non-null provider data of that open state.
        // Signer 0 is the primary signer; no counter-signer is asked for.
        let signer = unsafe { WTHelperGetProvSignerFromChain(provider, 0, 0, 0) };
        // SAFETY: a non-null signer belongs to the open state and stays valid
        // until it is closed.
        let chain_len = unsafe { signer.as_ref() }
            .map(|s| s.csCertChain)
            .unwrap_or(0);
        if chain_len == 0 {
            return Err("Windows kept no certificate chain for its signer".to_string());
        }
        // SAFETY: `signer` is non-null (its chain was read above), and 0 and
        // chain_len - 1 are inside its chain of chain_len certificates.
        let (leaf, root) = unsafe {
            (
                WTHelperGetProvCertFromChain(signer, 0),
                WTHelperGetProvCertFromChain(signer, chain_len - 1),
            )
        };
        match (subject_of(leaf), subject_of(root)) {
            (Some(subject), Some(root)) => Ok(Signer { subject, root }),
            _ => Err("the signing certificate has no subject name".to_string()),
        }
    }

    /// A copy of the certificate's encoded subject name.
    fn subject_of(cert: *mut CRYPT_PROVIDER_CERT) -> Option<Vec<u8>> {
        // SAFETY: `cert` is null or a certificate of the open verify state; its
        // context, info and name bytes belong to that state, which is closed
        // only after this copy has been made.
        unsafe {
            let context = cert.as_ref()?.pCert.as_ref()?;
            let name = context.pCertInfo.as_ref()?.Subject;
            if name.pbData.is_null() || name.cbData == 0 {
                return None;
            }
            Some(std::slice::from_raw_parts(name.pbData, name.cbData as usize).to_vec())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn version(v: &str) -> Version {
        Version::parse(v).expect("test version")
    }

    fn record(release: &str, sha256: &str) -> String {
        format!(r#"{{"release":"{release}","sha256":"{sha256}"}}"#)
    }

    /// Bytes that pass the size and header check.
    fn fake_setup(fill: u8) -> Vec<u8> {
        let mut bytes = vec![fill; MIN_SETUP_BYTES];
        bytes[..2].copy_from_slice(b"MZ");
        bytes
    }

    /// An empty folder of its own under the system temp folder.
    fn scratch(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("hw-uninstaller-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("scratch folder");
        dir
    }

    #[test]
    fn an_earlier_release_is_older() {
        let running = version("0.23.2");
        assert!(came_from_older_release("0.23.1", &running));
        assert!(came_from_older_release("0.22.9", &running));
        // The parts are numbers, not text: 0.9.0 is before 0.23.2.
        assert!(came_from_older_release("0.9.0", &running));
        // A release candidate comes before its release.
        assert!(came_from_older_release("0.23.2-rc.1", &running));
    }

    #[test]
    fn the_same_or_a_later_release_is_not_older() {
        let running = version("0.23.2");
        assert!(!came_from_older_release("0.23.2", &running));
        assert!(!came_from_older_release(" 0.23.2\n", &running));
        assert!(!came_from_older_release("0.23.10", &running));
        assert!(!came_from_older_release("1.0.0", &running));
        assert!(!came_from_older_release("0.23.3", &version("0.23.3-rc.2")));
    }

    #[test]
    fn a_release_that_is_not_a_version_is_older() {
        let running = version("0.23.2");
        assert!(came_from_older_release("", &running));
        assert!(came_from_older_release("latest", &running));
        assert!(came_from_older_release("v0.23.2", &running));
        assert!(came_from_older_release("0.23", &running));
    }

    #[test]
    fn a_missing_record_means_old() {
        assert!(needs_refresh(None, &version("0.23.2"), "ab12"));
    }

    #[test]
    fn a_record_that_does_not_read_means_old() {
        let running = version("0.23.2");
        for text in [
            "",
            "0.23.2",
            "{",
            r#"{"release":"0.23.2"}"#,
            r#"{"sha256":"ab12"}"#,
            r#"{"release":23,"sha256":"ab12"}"#,
        ] {
            assert!(needs_refresh(Some(text), &running, "ab12"), "{text:?}");
        }
    }

    #[test]
    fn a_record_of_this_release_for_this_file_is_current() {
        let running = version("0.23.2");
        assert!(!needs_refresh(
            Some(&record("0.23.2", "ab12")),
            &running,
            "ab12"
        ));
        assert!(!needs_refresh(
            Some(&record("0.23.2", "AB12")),
            &running,
            "ab12"
        ));
    }

    #[test]
    fn a_record_of_an_earlier_release_means_old() {
        let running = version("0.23.2");
        assert!(needs_refresh(
            Some(&record("0.23.1", "ab12")),
            &running,
            "ab12"
        ));
        assert!(needs_refresh(
            Some(&record("nonsense", "ab12")),
            &running,
            "ab12"
        ));
    }

    #[test]
    fn an_uninstaller_from_a_later_release_is_kept() {
        let running = version("0.23.2");
        assert!(!needs_refresh(
            Some(&record("0.24.0", "ab12")),
            &running,
            "ab12"
        ));
    }

    #[test]
    fn a_file_that_changed_since_the_record_means_old() {
        // An older setup run again copies itself over the uninstaller and
        // leaves the record alone.
        let running = version("0.23.2");
        assert!(needs_refresh(
            Some(&record("0.23.2", "ab12")),
            &running,
            "cd34"
        ));
    }

    #[test]
    fn attempts_are_a_day_apart() {
        let now = 1_800_000_000;
        assert!(may_try(None, now));
        assert!(!may_try(Some(now), now));
        assert!(!may_try(Some(now - 60 * 60), now));
        assert!(!may_try(Some(now - RETRY_AFTER_SECS + 1), now));
        assert!(may_try(Some(now - RETRY_AFTER_SECS), now));
        assert!(may_try(Some(now - 3 * RETRY_AFTER_SECS), now));
        // The clock was set back past the last attempt.
        assert!(may_try(Some(now + 60), now));
    }

    #[test]
    fn an_attempt_is_noted_and_the_next_waits_a_day() {
        let dir = scratch("attempts");
        let mark = dir.join("data").join(ATTEMPT_MARK_NAME);
        let now = 1_800_000_000;
        assert_eq!(begin_attempt(&mark, now), Ok(true));
        assert_eq!(begin_attempt(&mark, now + 10), Ok(false));
        assert_eq!(begin_attempt(&mark, now + RETRY_AFTER_SECS - 1), Ok(false));
        assert_eq!(begin_attempt(&mark, now + RETRY_AFTER_SECS), Ok(true));
        // A mark that does not read does not stop the attempt.
        std::fs::write(&mark, "garbage").expect("mark");
        assert_eq!(begin_attempt(&mark, now), Ok(true));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_installer_comes_from_the_release_of_the_running_version() {
        assert_eq!(
            setup_url(&version("0.23.2")),
            "https://github.com/Dishairano/hardwave-suite/releases/download/v0.23.2/HardwaveSuite-Setup.exe"
        );
    }

    #[test]
    fn a_download_that_is_not_an_installer_is_refused() {
        assert!(check_download(&fake_setup(0)).is_ok());
        assert!(check_download(b"MZ").is_err());
        assert!(check_download(&vec![0u8; MIN_SETUP_BYTES]).is_err());
        let mut too_big = fake_setup(0);
        too_big.resize(MAX_SETUP_BYTES + 1, 0);
        assert!(check_download(&too_big).is_err());
    }

    #[test]
    fn a_checked_download_replaces_the_uninstaller_and_the_record() {
        let dir = scratch("replace");
        let running = version("0.23.2");
        let uninstaller = dir.join(UNINSTALLER_EXE_NAME);
        std::fs::write(&uninstaller, b"the old uninstaller").expect("old uninstaller");
        assert_eq!(needs_refresh_in(&dir, &running), Ok(true));

        let setup = fake_setup(7);
        let mut checked = None;
        replace_in(&dir, &setup, &running, |file| {
            checked = std::fs::read(file).ok();
            Ok(())
        })
        .expect("replaced");

        // The check saw the download itself, under its temporary name.
        assert_eq!(checked.as_deref(), Some(setup.as_slice()));
        assert_eq!(std::fs::read(&uninstaller).expect("new uninstaller"), setup);
        assert!(!download_path(&dir).exists());
        assert_eq!(needs_refresh_in(&dir, &running), Ok(false));
        assert_eq!(needs_refresh_in(&dir, &version("0.23.3")), Ok(true));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_failed_check_leaves_the_old_uninstaller() {
        let dir = scratch("refused");
        let running = version("0.23.2");
        let uninstaller = dir.join(UNINSTALLER_EXE_NAME);
        std::fs::write(&uninstaller, b"the old uninstaller").expect("old uninstaller");

        let result = replace_in(&dir, &fake_setup(7), &running, |_| {
            Err("signed, but not by the publisher of this Suite".to_string())
        });

        assert!(result.is_err());
        assert_eq!(
            std::fs::read(&uninstaller).expect("old uninstaller"),
            b"the old uninstaller"
        );
        assert!(!download_path(&dir).exists());
        assert!(!dir.join(RECORD_NAME).exists());
        assert_eq!(needs_refresh_in(&dir, &running), Ok(true));
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn an_uninstaller_that_cannot_be_replaced_stays() {
        // A folder in the uninstaller's place stands in for a file Windows
        // will not let go of: the rename fails.
        let dir = scratch("in-use");
        let running = version("0.23.2");
        let in_the_way = dir.join(UNINSTALLER_EXE_NAME);
        std::fs::create_dir_all(in_the_way.join("busy")).expect("in the way");

        let result = replace_in(&dir, &fake_setup(7), &running, |_| Ok(()));

        assert!(result.is_err());
        assert!(in_the_way.join("busy").is_dir());
        assert!(!download_path(&dir).exists());
        assert!(!dir.join(RECORD_NAME).exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_bad_download_is_never_written() {
        let dir = scratch("bad-download");
        let mut verified = false;
        let result = replace_in(&dir, b"<html>Not Found</html>", &version("0.23.2"), |_| {
            verified = true;
            Ok(())
        });
        assert!(result.is_err());
        assert!(!verified);
        assert!(!download_path(&dir).exists());
        assert!(!dir.join(UNINSTALLER_EXE_NAME).exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn an_oversized_record_is_not_read() {
        let dir = scratch("big-record");
        let path = dir.join(RECORD_NAME);
        std::fs::write(&path, "x".repeat(MAX_RECORD_BYTES as usize + 1)).expect("record");
        assert_eq!(read_small(&path, MAX_RECORD_BYTES), None);
        std::fs::write(&path, "small").expect("record");
        assert_eq!(
            read_small(&path, MAX_RECORD_BYTES).as_deref(),
            Some("small")
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
