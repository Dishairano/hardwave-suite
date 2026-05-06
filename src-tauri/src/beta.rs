// Beta channel: subscription check, beta manifest fetch, channel persistence,
// installer dispatch into a separate ~/.hardwave/plugins/beta/ namespace,
// and a tokio expiry watcher that emits soft-warn / expired events.

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
    #[serde(rename = "artefact_url", alias = "artefactUrl")]
    artefact_url: String,
    #[serde(rename = "artefact_sha256", alias = "artefactSha256")]
    artefact_sha256: String,
    #[serde(rename = "artefact_size", alias = "artefactSize", default)]
    artefact_size: i64,
    #[serde(default)]
    changelog: Option<String>,
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

fn beta_install_dir(slug: &str) -> PathBuf {
    beta_plugins_root().join(slug)
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
        .map(|p| BetaPlugin {
            id: p.id,
            plugin_slug: p.plugin_slug,
            version: p.version,
            released_at: p.released_at,
            expires_at: p.expires_at,
            hours_until_expiry: p.hours_until_expiry,
            hours_until_soft_warn: p.hours_until_soft_warn,
            artefact_url: p.artefact_url,
            artefact_sha256: p.artefact_sha256,
            artefact_size: p.artefact_size,
            changelog: p.changelog,
        })
        .collect())
}

// ── Beta install pipeline ───────────────────────────────────────────────────

/// Download a beta artefact, verify its sha256, then extract into
/// `~/.hardwave/plugins/beta/<slug>/`. Records the install + expiry so the
/// watcher can disable expired builds. Returns the install directory.
pub async fn install_beta_build(
    token: Option<&str>,
    slug: &str,
    version: &str,
    url: &str,
    sha256: &str,
    expires_at: &str,
) -> Result<String, String> {
    let install_dir = beta_install_dir(slug);
    let parent = install_dir
        .parent()
        .ok_or_else(|| "beta install dir has no parent".to_string())?;
    std::fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create beta plugins root: {}", e))?;

    // Wipe any prior install for this slug so versions never overlap.
    if install_dir.exists() {
        std::fs::remove_dir_all(&install_dir)
            .map_err(|e| format!("Failed to clean prior beta install: {}", e))?;
    }
    let expired_dir = parent.join(format!("{}.expired", slug));
    if expired_dir.exists() {
        let _ = std::fs::remove_dir_all(&expired_dir);
    }

    // Download to a temp file.
    let filename = url
        .rsplit('/')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or(slug)
        .to_string();
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

    // Verify sha256.
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let actual = format!("{:x}", hasher.finalize());
    let expected = sha256.trim().to_lowercase();
    if !expected.is_empty() && actual != expected {
        return Err(format!(
            "Beta artefact sha256 mismatch (expected {}, got {})",
            expected, actual
        ));
    }

    std::fs::write(&tmp_path, &bytes)
        .map_err(|e| format!("Failed to write beta artefact: {}", e))?;

    // Extract zip / tar.gz into install_dir.
    std::fs::create_dir_all(&install_dir)
        .map_err(|e| format!("Failed to create beta install dir: {}", e))?;

    let lower = filename.to_lowercase();
    if lower.ends_with(".zip") {
        extract_zip(&tmp_path, &install_dir)?;
    } else if lower.ends_with(".tar.gz") || lower.ends_with(".tgz") {
        extract_tar_gz(&tmp_path, &install_dir)?;
    } else {
        // Single file — just copy it in.
        std::fs::copy(&tmp_path, install_dir.join(&filename))
            .map_err(|e| format!("Failed to copy beta artefact: {}", e))?;
    }
    let _ = std::fs::remove_file(&tmp_path);

    upsert_installed_beta(InstalledBetaRecord {
        slug: slug.to_string(),
        version: version.to_string(),
        install_dir: install_dir.to_string_lossy().to_string(),
        expires_at: expires_at.to_string(),
        soft_warned: false,
        expired: false,
    })?;

    Ok(install_dir.to_string_lossy().to_string())
}

fn extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| format!("Open zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Read zip: {}", e))?;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Zip entry: {}", e))?;
        let name = entry.name().to_string();
        let out_path = dest_dir.join(&name);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("mkdir {}: {}", name, e))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("mkdir parent: {}", e))?;
            }
            let mut out_file = std::fs::File::create(&out_path)
                .map_err(|e| format!("create {}: {}", name, e))?;
            std::io::copy(&mut entry, &mut out_file)
                .map_err(|e| format!("extract {}: {}", name, e))?;
        }
    }
    Ok(())
}

fn extract_tar_gz(archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive_path).map_err(|e| format!("Open tar: {}", e))?;
    let gz = flate2::read::GzDecoder::new(file);
    let mut tar = tar::Archive::new(gz);
    tar.unpack(dest_dir)
        .map_err(|e| format!("Extract tar.gz: {}", e))
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
/// Expired builds are renamed to `<slug>.expired` so DAW scans skip them.
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

            // Best-effort rename to `<slug>.expired` so DAWs skip the bundle.
            let install_dir = PathBuf::from(&rec.install_dir);
            if install_dir.exists() {
                let parent = install_dir.parent().unwrap_or(Path::new("."));
                let target = parent.join(format!("{}.expired", rec.slug));
                let _ = std::fs::remove_dir_all(&target);
                let _ = std::fs::rename(&install_dir, &target);
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
