// Beta channel: subscription check, beta manifest fetch, channel persistence,
// verified artefact download (lib.rs installs it into the real plug-in folders),
// the installed-betas registry, and a tokio expiry watcher that emits
// soft-warn / expired events.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const BASE_URL: &str = "https://hardwavestudios.com/api";

// ── Public types exposed to the UI ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionInfo {
    pub has_subscription: bool,
    pub beta_eligible: bool,
    pub plan_name: Option<String>,
    pub status: Option<String>,
    pub current_period_end: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BetaPlugin {
    pub id: i64,
    pub plugin_slug: String,
    pub version: String,
    pub released_at: String,
    pub expires_at: String,
    pub hours_until_expiry: f64,
    pub hours_until_soft_warn: f64,
    pub artefact_url: String,
    pub artefact_sha256: String,
    pub artefact_size: i64,
    pub changelog: Option<String>,
    /// A build of this beta exists for the OS the Suite runs on; the artefact_*
    /// fields hold it. False means they are empty.
    pub available_here: bool,
    /// Platforms this beta has a build for (windows, macos, linux).
    pub platforms: Vec<String>,
}

// ── Wire types matching the live backend ────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SubscriptionRaw {
    #[serde(default)]
    success: bool,
    #[serde(rename = "hasSubscription", default)]
    has_subscription: bool,
    #[serde(rename = "betaEligible", default)]
    beta_eligible: bool,
    #[serde(default)]
    subscription: Option<SubscriptionDetailRaw>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SubscriptionDetailRaw {
    #[serde(rename = "planName", default)]
    plan_name: Option<String>,
    #[serde(default)]
    status: Option<String>,
    #[serde(rename = "currentPeriodEnd", default)]
    current_period_end: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ManifestRaw {
    #[serde(rename = "betaEligible", alias = "beta_eligible", default)]
    _beta_eligible: bool,
    #[serde(default)]
    plugins: Vec<BetaPluginRaw>,
}

#[derive(Debug, Deserialize)]
struct BetaPluginRaw {
    #[serde(default)]
    id: i64,
    #[serde(rename = "plugin_slug", alias = "pluginSlug")]
    plugin_slug: String,
    version: String,
    #[serde(rename = "released_at", alias = "releasedAt", default)]
    released_at: String,
    #[serde(rename = "expires_at", alias = "expiresAt")]
    expires_at: String,
    #[serde(rename = "hours_until_expiry", alias = "hoursUntilExpiry", default)]
    hours_until_expiry: f64,
    #[serde(rename = "hours_until_soft_warn", alias = "hoursUntilSoftWarn", default)]
    hours_until_soft_warn: f64,
    #[serde(rename = "artefact_url", alias = "artefactUrl", default)]
    artefact_url: String,
    #[serde(rename = "artefact_sha256", alias = "artefactSha256", default)]
    artefact_sha256: String,
    #[serde(rename = "artefact_size", alias = "artefactSize", default)]
    artefact_size: i64,
    #[serde(default)]
    changelog: Option<String>,
    /// One build per platform. Absent from manifests before per-platform betas.
    #[serde(default)]
    artefacts: Vec<BetaArtefactRaw>,
}

#[derive(Debug, Clone, Deserialize)]
struct BetaArtefactRaw {
    platform: String,
    #[serde(rename = "artefact_url", alias = "artefactUrl")]
    artefact_url: String,
    #[serde(rename = "artefact_sha256", alias = "artefactSha256")]
    artefact_sha256: String,
    #[serde(rename = "artefact_size", alias = "artefactSize", default)]
    artefact_size: i64,
}

// ── Local-disk paths ────────────────────────────────────────────────────────

/// `~/.hardwave/` — shared with VST plugins (matches `dirs::data_dir()/hardwave`
/// path that VSTs already use for the auth token).
fn hardwave_root() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("hardwave")
}

fn config_path() -> PathBuf {
    hardwave_root().join("config.toml")
}

fn beta_plugins_root() -> PathBuf {
    hardwave_root().join("plugins").join("beta")
}

fn installed_betas_path() -> PathBuf {
    hardwave_root().join("installed-betas.json")
}

// ── Channel persistence (config.toml) ───────────────────────────────────────

#[derive(Debug, Default, Serialize, Deserialize)]
struct SuiteConfig {
    update_channel: Option<String>,
    auto_attach_crash_logs: Option<bool>,
}

fn read_config() -> SuiteConfig {
    std::fs::read_to_string(config_path())
        .ok()
        .and_then(|s| toml::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_config(cfg: &SuiteConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    let body = toml::to_string_pretty(cfg)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&path, body).map_err(|e| format!("Failed to write config: {}", e))
}

pub fn read_update_channel() -> String {
    read_config()
        .update_channel
        .unwrap_or_else(|| "stable".into())
}

pub fn write_update_channel(channel: &str) -> Result<(), String> {
    if channel != "stable" && channel != "beta" {
        return Err(format!("Invalid channel '{}': must be 'stable' or 'beta'", channel));
    }
    let mut cfg = read_config();
    cfg.update_channel = Some(channel.to_string());
    write_config(&cfg)
}

pub fn read_auto_attach_crash_logs() -> bool {
    // Default ON to match the mockup.
    read_config().auto_attach_crash_logs.unwrap_or(true)
}

pub fn write_auto_attach_crash_logs(enabled: bool) -> Result<(), String> {
    let mut cfg = read_config();
    cfg.auto_attach_crash_logs = Some(enabled);
    write_config(&cfg)
}

// ── Installed-betas registry ────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct InstalledBetaRecord {
    slug: String,
    version: String,
    install_dir: String,
    expires_at: String, // RFC3339 / ISO8601
    soft_warned: bool,
    expired: bool,
}

fn read_installed_betas() -> Vec<InstalledBetaRecord> {
    std::fs::read_to_string(installed_betas_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_installed_betas(records: &[InstalledBetaRecord]) -> Result<(), String> {
    let path = installed_betas_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    let body = serde_json::to_string_pretty(records)
        .map_err(|e| format!("Failed to serialize installed-betas: {}", e))?;
    std::fs::write(&path, body).map_err(|e| format!("Failed to write installed-betas: {}", e))
}

fn upsert_installed_beta(record: InstalledBetaRecord) -> Result<(), String> {
    let mut all = read_installed_betas();
    all.retain(|r| r.slug != record.slug);
    all.push(record);
    write_installed_betas(&all)
}

// ── Backend API calls ───────────────────────────────────────────────────────

pub async fn fetch_subscription(token: &str) -> Result<SubscriptionInfo, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/subscription", BASE_URL))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Subscription request failed: {}", e))?;

    let body = res
        .text()
        .await
        .map_err(|e| format!("Failed to read subscription response: {}", e))?;

    let raw: SubscriptionRaw = serde_json::from_str(&body).map_err(|e| {
        format!(
            "Subscription parse error: {} | body: {}",
            e,
            &body[..body.len().min(500)]
        )
    })?;

    if !raw.success && raw.error.is_some() {
        return Err(raw.error.unwrap_or_default());
    }

    let detail = raw.subscription.unwrap_or(SubscriptionDetailRaw {
        plan_name: None,
        status: None,
        current_period_end: None,
    });

    Ok(SubscriptionInfo {
        has_subscription: raw.has_subscription,
        beta_eligible: raw.beta_eligible,
        plan_name: detail.plan_name,
        status: detail.status,
        current_period_end: detail.current_period_end,
    })
}

pub async fn fetch_beta_manifest(token: &str) -> Result<Vec<BetaPlugin>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/beta/manifest", BASE_URL))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Beta manifest request failed: {}", e))?;

    let body = res
        .text()
        .await
        .map_err(|e| format!("Failed to read beta manifest response: {}", e))?;

    let raw: ManifestRaw = serde_json::from_str(&body).map_err(|e| {
        format!(
            "Beta manifest parse error: {} | body: {}",
            e,
            &body[..body.len().min(500)]
        )
    })?;

    Ok(raw
        .plugins
        .into_iter()
        .map(|p| {
            let legacy = (p.artefact_url.as_str(), p.artefact_sha256.as_str(), p.artefact_size);
            let picked = pick_artefact(&p.artefacts, legacy, std::env::consts::OS);
            let platforms = platforms_of(&p.artefacts, &p.artefact_url);
            let available_here = picked.is_some();
            let (artefact_url, artefact_sha256, artefact_size) = picked.unwrap_or_default();
            BetaPlugin {
                id: p.id,
                plugin_slug: p.plugin_slug,
                version: p.version,
                released_at: p.released_at,
                expires_at: p.expires_at,
                hours_until_expiry: p.hours_until_expiry,
                hours_until_soft_warn: p.hours_until_soft_warn,
                artefact_url,
                artefact_sha256,
                artefact_size,
                changelog: p.changelog,
                available_here,
                platforms,
            }
        })
        .collect())
}

// ── Beta install pipeline ───────────────────────────────────────────────────

/// Last path segment of the artefact URL, without a query string.
fn artefact_filename(url: &str) -> Option<String> {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    let name = path.rsplit('/').next().unwrap_or("");
    let lower = name.to_lowercase();
    let is_archive = lower.ends_with(".zip") || lower.ends_with(".tar.gz") || lower.ends_with(".tgz");
    // The name becomes part of a temp path and decides how it is unpacked.
    if !is_archive || name.contains("..") || name.contains('\\') {
        return None;
    }
    Some(name.to_string())
}

/// The OS an artefact's file name says it was built for, if it says so.
fn os_of_filename(filename: &str) -> Option<&'static str> {
    let name = filename.to_lowercase();
    if name.contains("windows") || name.contains("win64") || name.contains("-win-") {
        Some("windows")
    } else if name.contains("macos") || name.contains("darwin") || name.contains("-mac-") {
        Some("macos")
    } else if name.contains("linux") {
        Some("linux")
    } else {
        None
    }
}

fn os_label(os: &str) -> &'static str {
    match os {
        "windows" => "Windows",
        "macos" => "macOS",
        _ => "Linux",
    }
}

/// The OS an artefact name says it was built for, when that is not `os`.
/// Last line of defence at install time; the manifest picker already chose.
fn built_for_other_os(filename: &str, os: &str) -> Option<&'static str> {
    os_of_filename(filename).filter(|t| *t != os).map(os_label)
}

/// The build of a beta for `os`. A manifest with per-platform artefacts is
/// matched on platform. An older manifest carries one artefact, which is used
/// unless its name says it is for another OS.
fn pick_artefact(
    artefacts: &[BetaArtefactRaw],
    legacy: (&str, &str, i64),
    os: &str,
) -> Option<(String, String, i64)> {
    if !artefacts.is_empty() {
        return artefacts
            .iter()
            .find(|a| a.platform == os)
            .map(|a| (a.artefact_url.clone(), a.artefact_sha256.clone(), a.artefact_size));
    }
    let (url, sha256, size) = legacy;
    let name = artefact_filename(url)?;
    match os_of_filename(&name) {
        Some(target) if target != os => None,
        _ => Some((url.to_string(), sha256.to_string(), size)),
    }
}

/// Platforms a beta has a build for, to tell users on other systems what exists.
fn platforms_of(artefacts: &[BetaArtefactRaw], legacy_url: &str) -> Vec<String> {
    if !artefacts.is_empty() {
        return artefacts.iter().map(|a| a.platform.clone()).collect();
    }
    artefact_filename(legacy_url)
        .and_then(|n| os_of_filename(&n))
        .map(|os| vec![os.to_string()])
        .unwrap_or_default()
}

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty() && slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Download a beta artefact and verify its sha256. Returns the temp file and the
/// artefact's filename; the caller installs it and removes the temp file.
///
/// The checksum is required: a beta goes into the same folders the DAW loads
/// stable builds from.
pub async fn download_verified_artefact(
    token: Option<&str>,
    slug: &str,
    url: &str,
    sha256: &str,
) -> Result<(PathBuf, String), String> {
    if !valid_slug(slug) {
        return Err(format!("Invalid plug-in slug '{}'", slug));
    }
    let filename = artefact_filename(url)
        .ok_or_else(|| "Beta artefact must be a .zip or .tar.gz archive".to_string())?;
    if let Some(other) = built_for_other_os(&filename, std::env::consts::OS) {
        return Err(format!(
            "This beta build is for {} only. A build for your system will follow with the release.",
            other
        ));
    }
    let expected = sha256.trim().to_lowercase();
    if expected.len() != 64 || !expected.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Beta artefact has no valid sha256, refusing to install it".into());
    }

    let tmp_path = std::env::temp_dir().join(format!("hw_beta_{}_{}", slug, filename));
    let _ = std::fs::remove_file(&tmp_path);

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| format!("HTTP client build failed: {}", e))?;

    let mut req = client.get(url);
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let res = req
        .send()
        .await
        .map_err(|e| format!("Beta download failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Beta download failed: HTTP {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Beta download read failed: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let actual = format!("{:x}", hasher.finalize());
    if actual != expected {
        return Err(format!(
            "Beta artefact sha256 mismatch (expected {}, got {})",
            expected, actual
        ));
    }

    std::fs::write(&tmp_path, &bytes)
        .map_err(|e| format!("Failed to write beta artefact: {}", e))?;

    Ok((tmp_path, filename))
}

/// Record an installed beta so the watcher can warn before it expires.
pub fn record_installed_beta(
    slug: &str,
    version: &str,
    install_dir: &Path,
    expires_at: &str,
) -> Result<(), String> {
    upsert_installed_beta(InstalledBetaRecord {
        slug: slug.to_string(),
        version: version.to_string(),
        install_dir: install_dir.to_string_lossy().to_string(),
        expires_at: expires_at.to_string(),
        soft_warned: false,
        expired: false,
    })?;

    // Betas from before this change sat in the old beta folder, where no DAW
    // looked. The build is in the plug-in folders now, so remove them.
    let legacy_root = beta_plugins_root();
    let _ = std::fs::remove_dir_all(legacy_root.join(slug));
    let _ = std::fs::remove_dir_all(legacy_root.join(format!("{}.expired", slug)));
    Ok(())
}

/// Forget a plug-in's beta after a stable install or an uninstall replaced it.
pub fn forget_installed_beta(slug: &str) {
    let mut all = read_installed_betas();
    let before = all.len();
    all.retain(|r| r.slug != slug);
    if all.len() != before {
        let _ = write_installed_betas(&all);
    }
}

// ── Expiry watcher ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
struct BetaWarningPayload {
    slug: String,
    version: String,
    expires_at: String,
}

/// Spawn a tokio task that re-checks installed betas every 60 seconds.
/// Emits `beta:soft-warning` once when a build crosses its soft-warn point
/// (24h before expiry by default) and `beta:expired` once when it elapses.
/// An expired build keeps working until the stable build replaces it: it lives
/// in the real plug-in folder now, and moving it aside would leave the user
/// with no copy of the plug-in at all. Only builds still in the old beta folder
/// are renamed to `<slug>.expired`.
pub fn spawn_expiry_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            if let Err(e) = tick(&app).await {
                eprintln!("[beta watcher] tick failed: {}", e);
            }
            tokio::time::sleep(Duration::from_secs(60)).await;
        }
    });
}

async fn tick(app: &AppHandle) -> Result<(), String> {
    let mut records = read_installed_betas();
    if records.is_empty() {
        return Ok(());
    }

    let now = chrono::Utc::now();
    let mut dirty = false;

    for rec in records.iter_mut() {
        // Parse expires_at; skip silently if malformed.
        let expiry = match chrono::DateTime::parse_from_rfc3339(&rec.expires_at) {
            Ok(dt) => dt.with_timezone(&chrono::Utc),
            Err(_) => continue,
        };
        let hours_left = (expiry - now).num_minutes() as f64 / 60.0;

        if !rec.expired && hours_left <= 0.0 {
            rec.expired = true;
            dirty = true;

            // Never rename the recorded folder unless it is the old per-slug beta
            // folder: for a beta in the plug-in folders it is the shared VST3
            // folder itself, and renaming it would hide every plug-in in it.
            let install_dir = PathBuf::from(&rec.install_dir);
            if let Some(target) = legacy_expiry_target(&install_dir, &rec.slug, &beta_plugins_root()) {
                if install_dir.exists() {
                    let _ = std::fs::remove_dir_all(&target);
                    let _ = std::fs::rename(&install_dir, &target);
                }
            }

            let _ = app.emit(
                "beta:expired",
                BetaWarningPayload {
                    slug: rec.slug.clone(),
                    version: rec.version.clone(),
                    expires_at: rec.expires_at.clone(),
                },
            );
        } else if !rec.soft_warned && !rec.expired && hours_left > 0.0 && hours_left <= 24.0 {
            rec.soft_warned = true;
            dirty = true;
            let _ = app.emit(
                "beta:soft-warning",
                BetaWarningPayload {
                    slug: rec.slug.clone(),
                    version: rec.version.clone(),
                    expires_at: rec.expires_at.clone(),
                },
            );
        }
    }

    if dirty {
        write_installed_betas(&records)?;
    }
    Ok(())
}

/// Where an expired build may be moved aside: only an install in the old
/// `plugins/beta/<slug>` folder, matched exactly.
fn legacy_expiry_target(install_dir: &Path, slug: &str, legacy_root: &Path) -> Option<PathBuf> {
    use std::path::Component;
    if !valid_slug(slug) || install_dir.components().any(|c| matches!(c, Component::ParentDir)) {
        return None;
    }
    if install_dir != legacy_root.join(slug) {
        return None;
    }
    Some(legacy_root.join(format!("{}.expired", slug)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        PathBuf::from("/data/hardwave/plugins/beta")
    }

    #[test]
    fn expiry_never_touches_the_plugin_folders() {
        let system = PathBuf::from("/Program Files/Common Files/VST3");
        assert_eq!(legacy_expiry_target(&system, "wettboi", &root()), None);
        let per_user = PathBuf::from("/home/u/.vst3");
        assert_eq!(legacy_expiry_target(&per_user, "wettboi", &root()), None);
    }

    #[test]
    fn expiry_moves_only_the_exact_legacy_folder() {
        assert_eq!(
            legacy_expiry_target(&root().join("wettboi"), "wettboi", &root()),
            Some(root().join("wettboi.expired"))
        );
        assert_eq!(legacy_expiry_target(&root(), "wettboi", &root()), None);
        assert_eq!(legacy_expiry_target(&root().join("loudlab"), "wettboi", &root()), None);
        assert_eq!(legacy_expiry_target(&root().join("wettboi"), "../wettboi", &root()), None);
        assert_eq!(
            legacy_expiry_target(&root().join("x").join("..").join("wettboi"), "wettboi", &root()),
            None
        );
    }

    #[test]
    fn artefact_filename_accepts_archives_only() {
        assert_eq!(
            artefact_filename("https://github.com/o/r/releases/download/v0.4.0-rc1/WettBoi-windows.zip"),
            Some("WettBoi-windows.zip".into())
        );
        assert_eq!(
            artefact_filename("https://cdn.example/b/plug.tar.gz?sig=abc#x"),
            Some("plug.tar.gz".into())
        );
        assert_eq!(artefact_filename("https://cdn.example/b/plug.exe"), None);
        assert_eq!(artefact_filename("https://cdn.example/b/"), None);
        assert_eq!(artefact_filename("https://cdn.example/b/..%2f.zip"), None);
        assert_eq!(artefact_filename("https://cdn.example/b/a\\..\\x.zip"), None);
    }

    #[test]
    fn refuses_builds_for_another_os() {
        let win = "hardwave-wettboi-windows-x64.zip";
        assert_eq!(built_for_other_os(win, "windows"), None);
        assert_eq!(built_for_other_os(win, "macos"), Some("Windows"));
        let mac = "hardwave-wettboi-macos-universal.zip";
        assert_eq!(built_for_other_os(mac, "macos"), None);
        assert_eq!(built_for_other_os(mac, "windows"), Some("macOS"));
        assert_eq!(built_for_other_os("hardwave-wettboi-linux-x64.zip", "windows"), Some("Linux"));
        assert_eq!(built_for_other_os("hardwave-wettboi.zip", "macos"), None);
    }

    fn artefact(platform: &str, url: &str) -> BetaArtefactRaw {
        BetaArtefactRaw {
            platform: platform.into(),
            artefact_url: url.into(),
            artefact_sha256: "a".repeat(64),
            artefact_size: 10,
        }
    }

    #[test]
    fn picks_the_build_for_this_os() {
        let list = vec![
            artefact("windows", "https://x/hardwave-wettboi-windows-x64.zip"),
            artefact("macos", "https://x/hardwave-wettboi-macos-universal.zip"),
        ];
        let legacy = ("https://x/hardwave-wettboi-windows-x64.zip", "b", 5);
        let mac = pick_artefact(&list, legacy, "macos").expect("mac build");
        assert!(mac.0.ends_with("macos-universal.zip"));
        assert!(pick_artefact(&list, legacy, "windows").unwrap().0.ends_with("windows-x64.zip"));
        // Per-platform list without Linux: no fallback to the legacy Windows zip.
        assert_eq!(pick_artefact(&list, legacy, "linux"), None);
        assert_eq!(platforms_of(&list, legacy.0), vec!["windows", "macos"]);
    }

    #[test]
    fn older_manifests_fall_back_to_the_single_artefact() {
        let win = ("https://x/hardwave-wettboi-windows-x64.zip", "b", 5);
        assert!(pick_artefact(&[], win, "windows").is_some());
        assert_eq!(pick_artefact(&[], win, "macos"), None);
        let unnamed = ("https://x/hardwave-wettboi.zip", "b", 5);
        assert!(pick_artefact(&[], unnamed, "linux").is_some());
        assert_eq!(pick_artefact(&[], ("", "", 0), "windows"), None);
        assert_eq!(platforms_of(&[], win.0), vec!["windows"]);
        assert!(platforms_of(&[], unnamed.0).is_empty());
    }

    #[test]
    fn slugs_are_plain() {
        assert!(valid_slug("wettboi"));
        assert!(valid_slug("hardwave-analyser"));
        assert!(!valid_slug(""));
        assert!(!valid_slug("../x"));
        assert!(!valid_slug("Wett Boi"));
    }
}
