//! Keeps the Suite signed in, and the plug-ins' shared token file in step with it.
//!
//! Suite tokens are 7-day JWTs. On start the Suite renews a still-valid saved
//! token, and while it runs it renews again every 12 hours. When the saved
//! token has expired but a plug-in has put a newer, still-valid token of the
//! same account in the shared file, the Suite carries on with that one. An
//! expired session never deletes the shared file: only an explicit sign-out
//! does (`logout` in lib.rs).

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use std::future::Future;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicI64, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_log::log;

/// How long a renewed token is kept before the Suite renews it again.
pub const RENEW_EVERY_SECS: i64 = 12 * 60 * 60;
/// When a renewal fails (offline, server error), the next try comes this much later.
pub const RETRY_AFTER_SECS: i64 = 60 * 60;
/// How often the background task looks at the clock. The renewal itself follows
/// the wall clock, so a computer that slept through the 12 hours renews soon after
/// it wakes.
const CHECK_EVERY: Duration = Duration::from_secs(10 * 60);
/// A token this close to its expiry counts as expired, so a renewal never goes out
/// with a token that runs out on the way.
const EXPIRY_MARGIN_SECS: i64 = 60;
/// Longest token accepted from the shared file or the server. Suite tokens are a
/// few hundred bytes.
pub const MAX_TOKEN_LEN: usize = 8 * 1024;
/// The claims that name the account in a token. Two tokens with a different value
/// for any of these belong to different accounts.
const ACCOUNT_CLAIMS: [&str; 5] = ["sub", "userId", "user_id", "id", "email"];
/// Event the main window gets when the token in use changed in the background.
pub const RENEWED_EVENT: &str = "auth:renewed";

/// What a renewal did.
#[derive(Debug, PartialEq, Eq)]
pub enum Renewal {
    /// The server issued a new token; it is now in use and in the shared file.
    Renewed(String),
    /// No new token (offline, server error, unusable reply). The newest valid
    /// token there was is in use and in the shared file.
    Kept { token: String, why: String },
    /// Neither the token in use nor the shared file holds a valid token of the
    /// account. Nothing was changed, and the shared file stays.
    Expired,
    /// The session changed while the request was out (signed out, or signed in
    /// again). Nothing was changed.
    Stale,
}

impl Renewal {
    /// The token in use after this renewal, if it changed or confirmed one.
    pub fn token(&self) -> Option<&str> {
        match self {
            Renewal::Renewed(token) | Renewal::Kept { token, .. } => Some(token),
            Renewal::Expired | Renewal::Stale => None,
        }
    }
}

/// A token whose payload could be read. The signature is not checked here: the
/// server does that on every request.
struct Token<'a> {
    raw: &'a str,
    exp: i64,
    claims: serde_json::Map<String, serde_json::Value>,
}

impl<'a> Token<'a> {
    /// Reads a JWT's payload. Anything that is not three base64url parts with a
    /// JSON object holding a numeric `exp` in the middle is refused.
    fn parse(raw: &'a str) -> Option<Self> {
        if raw.is_empty()
            || raw.len() > MAX_TOKEN_LEN
            || !raw
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'='))
        {
            return None;
        }
        let mut parts = raw.split('.');
        let (_header, payload, _signature) = (parts.next()?, parts.next()?, parts.next()?);
        if parts.next().is_some() {
            return None;
        }
        let bytes = URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
        let claims = match serde_json::from_slice(&bytes).ok()? {
            serde_json::Value::Object(map) => map,
            _ => return None,
        };
        let exp = match claims.get("exp")? {
            serde_json::Value::Number(n) => n
                .as_i64()
                .or_else(|| n.as_f64().filter(|f| f.is_finite()).map(|f| f as i64))?,
            _ => return None,
        };
        Some(Token { raw, exp, claims })
    }

    fn is_valid(&self, now: i64) -> bool {
        self.exp.saturating_sub(EXPIRY_MARGIN_SECS) > now
    }

    fn same_account(&self, other: &Token) -> bool {
        ACCOUNT_CLAIMS.iter().all(
            |key| match (self.claims.get(*key), other.claims.get(*key)) {
                (Some(a), Some(b)) => a == b,
                _ => true,
            },
        )
    }
}

/// The token to carry on with: the newest still-valid one of `own` (the token in
/// use, or the saved one on start) and `shared` (the plug-ins' file). The shared
/// token only counts when it belongs to the same account as `own`.
fn pick<'a>(own: Option<&'a str>, shared: Option<&'a str>, now: i64) -> Option<&'a str> {
    let own = own.and_then(Token::parse);
    let shared = shared
        .and_then(Token::parse)
        .filter(|s| s.is_valid(now) && own.as_ref().is_some_and(|o| o.same_account(s)));
    let own = own.filter(|o| o.is_valid(now));
    let newest = match (own, shared) {
        (Some(o), Some(s)) => Some(if s.exp > o.exp { s } else { o }),
        (o, s) => o.or(s),
    };
    newest.map(|t| t.raw)
}

/// A reply to a renewal is used only when it is a valid token of the same account
/// that does not expire before the one it replaces.
fn is_renewal_of(new: &str, current: &str, now: i64) -> bool {
    match (Token::parse(new), Token::parse(current)) {
        (Some(n), Some(c)) => n.is_valid(now) && n.same_account(&c) && n.exp >= c.exp,
        _ => false,
    }
}

/// Picks the token to carry on with and asks the server to renew it.
async fn renew<F, Fut>(own: Option<&str>, shared: Option<&str>, now: i64, refresh: F) -> Renewal
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let Some(current) = pick(own, shared, now) else {
        return Renewal::Expired;
    };
    match refresh(current.to_string()).await {
        Ok(new) if is_renewal_of(&new, current, now) => Renewal::Renewed(new),
        Ok(_) => Renewal::Kept {
            token: current.to_string(),
            why: "the server's reply held no usable token".into(),
        },
        Err(why) => Renewal::Kept {
            token: current.to_string(),
            why,
        },
    }
}

/// Renews the session and stores the outcome everywhere the Suite keeps its token:
/// `token_slot` (the token every command uses) and the plug-ins' shared file, the
/// same write `sync_vst_token(Some(..))` does. The front end saves the returned
/// token in its own session.
///
/// `own` is the saved token on start, and the token in use for the 12-hourly
/// renewal. Nothing is stored when the session expired, or when it changed while
/// the request was out.
pub async fn renew_session<F, Fut>(
    own: Option<String>,
    token_slot: &Mutex<Option<String>>,
    renew_at: &AtomicI64,
    shared_file: Option<&Path>,
    now: i64,
    refresh: F,
) -> Renewal
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let before = token_slot.lock().unwrap().clone();
    let shared = shared_file.and_then(read_shared_token);
    let outcome = renew(own.as_deref(), shared.as_deref(), now, refresh).await;

    let Some(token) = outcome.token() else {
        return outcome;
    };
    let mut slot = token_slot.lock().unwrap();
    if *slot != before {
        return Renewal::Stale;
    }
    *slot = Some(token.to_string());
    // Written under the lock, so a sign-out that clears the slot first is never
    // undone by this write.
    if let Some(path) = shared_file {
        sync_shared_token(path, Some(token));
    }
    let next = match outcome {
        Renewal::Renewed(_) => RENEW_EVERY_SECS,
        _ => RETRY_AFTER_SECS,
    };
    renew_at.store(now.saturating_add(next), Ordering::Relaxed);
    outcome
}

/// Whether the background task should renew now.
pub fn renewal_due(has_token: bool, renew_at: i64, now: i64) -> bool {
    has_token && now >= renew_at
}

/// Renews the token in the background every 12 hours while the Suite runs, and
/// tells the main window when the token in use changed, so it can save it.
pub fn spawn_renewal(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(CHECK_EVERY).await;
            let state = app.state::<crate::AppState>();
            let own = state.api_token.lock().unwrap().clone();
            let now = chrono::Utc::now().timestamp();
            if !renewal_due(own.is_some(), state.renew_at.load(Ordering::Relaxed), now) {
                continue;
            }
            let shared_file = crate::shared_vst_token_path();
            let outcome = renew_session(
                own.clone(),
                &state.api_token,
                &state.renew_at,
                shared_file.as_deref(),
                now,
                |token| async move { crate::api::refresh_token(&token).await },
            )
            .await;
            match &outcome {
                Renewal::Renewed(_) => log::info!("[session] token renewed"),
                Renewal::Kept { why, .. } => log::warn!("[session] token not renewed: {why}"),
                Renewal::Expired | Renewal::Stale => {}
            }
            if let Some(token) = outcome.token().filter(|t| Some(*t) != own.as_deref()) {
                if let Err(e) = app.emit_to("main", RENEWED_EVENT, token) {
                    log::warn!("[session] could not hand the renewed token to the window: {e}");
                }
            }
        }
    });
}

/// Reads the plug-ins' shared token file. Anything too long or not UTF-8 is
/// ignored, as is an empty file.
pub fn read_shared_token(path: &Path) -> Option<String> {
    let file = std::fs::File::open(path).ok()?;
    let mut bytes = Vec::new();
    file.take(MAX_TOKEN_LEN as u64 + 1)
        .read_to_end(&mut bytes)
        .ok()?;
    if bytes.len() > MAX_TOKEN_LEN {
        return None;
    }
    let text = String::from_utf8(bytes).ok()?;
    let token = text.trim();
    (!token.is_empty()).then(|| token.to_string())
}

/// Writes (`Some`) or deletes (`None`) the plug-ins' shared token file at `path`.
/// The file is readable by this user only.
pub fn sync_shared_token(path: &Path, token: Option<&str>) {
    match token {
        Some(t) => {
            if let Err(e) = write_private(path, t) {
                log::warn!("[session] could not write the plug-ins' token file: {e}");
            }
        }
        None => {
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

/// Writes `contents` to `path` through a temporary file in the same folder that is
/// restricted to this user before it replaces the old file, so a plug-in never reads
/// half a token and the token is never readable by others.
fn write_private(path: &Path, contents: &str) -> std::io::Result<()> {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let dir = path
        .parent()
        .ok_or_else(|| std::io::Error::other("the token file has no folder"))?;
    std::fs::create_dir_all(dir)?;
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    let tmp = dir.join(format!(
        ".{name}.{}.{}.tmp",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let written = write_and_replace(&tmp, path, contents);
    if written.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    written
}

fn write_and_replace(tmp: &Path, path: &Path, contents: &str) -> std::io::Result<()> {
    let mut file = open_private(tmp)?;
    file.write_all(contents.as_bytes())?;
    file.sync_all()?;
    drop(file);
    restrict_to_user(tmp)?;
    std::fs::rename(tmp, path)
}

#[cfg(unix)]
fn open_private(path: &Path) -> std::io::Result<std::fs::File> {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(0o600)
        .open(path)
}

#[cfg(not(unix))]
fn open_private(path: &Path) -> std::io::Result<std::fs::File> {
    std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)
}

/// Read and write for the owner only (0600), whatever the umask or an older file had.
#[cfg(unix)]
fn restrict_to_user(path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
}

/// Replaces the file's access list with one entry: full access for the user this
/// process runs as. Nothing is inherited from the folder, so other accounts on the
/// computer cannot read the token.
#[cfg(windows)]
fn restrict_to_user(path: &Path) -> std::io::Result<()> {
    use std::io::Error;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{
        CloseHandle, LocalFree, ERROR_SUCCESS, GENERIC_ALL, HANDLE,
    };
    use windows_sys::Win32::Security::Authorization::{
        SetEntriesInAclW, SetNamedSecurityInfoW, EXPLICIT_ACCESS_W, NO_MULTIPLE_TRUSTEE,
        SET_ACCESS, SE_FILE_OBJECT, TRUSTEE_IS_SID, TRUSTEE_IS_USER, TRUSTEE_W,
    };
    use windows_sys::Win32::Security::{
        GetTokenInformation, TokenUser, ACL, DACL_SECURITY_INFORMATION, NO_INHERITANCE,
        PROTECTED_DACL_SECURITY_INFORMATION, TOKEN_QUERY, TOKEN_USER,
    };
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    let mut process_token: HANDLE = std::ptr::null_mut();
    // SAFETY: GetCurrentProcess returns a pseudo handle that needs no closing, and
    // `process_token` is a valid place for the opened handle.
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut process_token) } == 0 {
        return Err(Error::last_os_error());
    }
    // TOKEN_USER and the SID it points to; a SID is at most 68 bytes, so 256 bytes
    // hold both. u64 elements keep the buffer aligned for TOKEN_USER.
    let mut buf = [0u64; 32];
    let mut len = 0u32;
    // SAFETY: `process_token` is open with TOKEN_QUERY, and `buf` is writable for
    // the byte length passed.
    let ok = unsafe {
        GetTokenInformation(
            process_token,
            TokenUser,
            buf.as_mut_ptr().cast(),
            std::mem::size_of_val(&buf) as u32,
            &mut len,
        )
    };
    let query_error = Error::last_os_error();
    // SAFETY: `process_token` was opened above and is closed exactly once.
    unsafe { CloseHandle(process_token) };
    if ok == 0 {
        return Err(query_error);
    }
    // SAFETY: the call succeeded, so `buf` starts with an aligned TOKEN_USER whose
    // SID points into `buf`, which outlives every use of `sid` below.
    let sid = unsafe { (*buf.as_ptr().cast::<TOKEN_USER>()).User.Sid };

    let access = EXPLICIT_ACCESS_W {
        grfAccessPermissions: GENERIC_ALL,
        grfAccessMode: SET_ACCESS,
        grfInheritance: NO_INHERITANCE,
        Trustee: TRUSTEE_W {
            pMultipleTrustee: std::ptr::null_mut(),
            MultipleTrusteeOperation: NO_MULTIPLE_TRUSTEE,
            TrusteeForm: TRUSTEE_IS_SID,
            TrusteeType: TRUSTEE_IS_USER,
            ptstrName: sid.cast(),
        },
    };
    let mut acl: *mut ACL = std::ptr::null_mut();
    // SAFETY: one complete EXPLICIT_ACCESS_W whose SID is valid for this call, no
    // old list to merge, and `acl` is a valid place for the new list.
    let status = unsafe { SetEntriesInAclW(1, &access, std::ptr::null(), &mut acl) };
    if status != ERROR_SUCCESS {
        return Err(Error::from_raw_os_error(status as i32));
    }
    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    // SAFETY: `wide` is a NUL-terminated path, `acl` is the list built above, and
    // the null owner, group and audit list leave those parts unchanged.
    let status = unsafe {
        SetNamedSecurityInfoW(
            wide.as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            acl,
            std::ptr::null(),
        )
    };
    // SAFETY: SetEntriesInAclW allocated `acl` with LocalAlloc; this is its last use
    // and it is freed exactly once.
    unsafe { LocalFree(acl.cast()) };
    if status != ERROR_SUCCESS {
        return Err(Error::from_raw_os_error(status as i32));
    }
    Ok(())
}

#[cfg(not(any(unix, windows)))]
fn restrict_to_user(_path: &Path) -> std::io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    const NOW: i64 = 1_793_000_000;
    const DAY: i64 = 24 * 60 * 60;

    /// A token the parser accepts; the signature part is not checked.
    fn jwt(claims: serde_json::Value) -> String {
        let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
        let payload = URL_SAFE_NO_PAD.encode(claims.to_string());
        format!("{header}.{payload}.c2lnbmF0dXJl")
    }

    fn token_for(user: i64, exp: i64) -> String {
        jwt(serde_json::json!({ "userId": user, "iat": exp - 7 * DAY, "exp": exp }))
    }

    /// Stands in for POST /api/auth/refresh: records the bearer token of each
    /// request and answers with a fixed reply.
    struct MockServer {
        reply: Result<String, String>,
        seen: Mutex<Vec<String>>,
    }

    impl MockServer {
        fn replying(reply: Result<String, String>) -> Self {
            MockServer {
                reply,
                seen: Mutex::new(Vec::new()),
            }
        }

        fn refresh(&self, token: String) -> std::future::Ready<Result<String, String>> {
            self.seen.lock().unwrap().push(token);
            std::future::ready(self.reply.clone())
        }

        fn seen(&self) -> Vec<String> {
            self.seen.lock().unwrap().clone()
        }
    }

    /// The Suite's in-memory session and the shared file, in a fresh folder.
    struct Suite {
        dir: PathBuf,
        token: Mutex<Option<String>>,
        renew_at: AtomicI64,
    }

    impl Suite {
        fn new(name: &str) -> Self {
            let dir =
                std::env::temp_dir().join(format!("hw-session-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            Suite {
                dir,
                token: Mutex::new(None),
                renew_at: AtomicI64::new(0),
            }
        }

        fn shared_file(&self) -> PathBuf {
            self.dir.join("hardwave").join("auth_token")
        }

        fn put_shared(&self, token: &str) {
            sync_shared_token(&self.shared_file(), Some(token));
        }

        fn shared(&self) -> Option<String> {
            std::fs::read_to_string(self.shared_file()).ok()
        }

        fn in_use(&self) -> Option<String> {
            self.token.lock().unwrap().clone()
        }

        async fn start(&self, saved: &str, server: &MockServer) -> Renewal {
            let shared_file = self.shared_file();
            renew_session(
                Some(saved.to_string()),
                &self.token,
                &self.renew_at,
                Some(&shared_file),
                NOW,
                |t| server.refresh(t),
            )
            .await
        }
    }

    impl Drop for Suite {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    #[tokio::test]
    async fn a_valid_saved_token_is_renewed_and_saved_everywhere() {
        let suite = Suite::new("renew");
        let saved = token_for(7, NOW + 3 * DAY);
        let renewed = token_for(7, NOW + 7 * DAY);
        let server = MockServer::replying(Ok(renewed.clone()));

        let outcome = suite.start(&saved, &server).await;

        assert_eq!(outcome, Renewal::Renewed(renewed.clone()));
        assert_eq!(server.seen(), vec![saved]);
        assert_eq!(suite.in_use(), Some(renewed.clone()));
        assert_eq!(suite.shared(), Some(renewed));
        assert_eq!(
            suite.renew_at.load(Ordering::Relaxed),
            NOW + RENEW_EVERY_SECS
        );
    }

    #[tokio::test]
    async fn a_failed_renewal_keeps_the_valid_token_and_tries_again_sooner() {
        let suite = Suite::new("offline");
        let saved = token_for(7, NOW + 3 * DAY);
        let server = MockServer::replying(Err("Refresh refused (HTTP 503)".into()));

        let outcome = suite.start(&saved, &server).await;

        assert_eq!(outcome.token(), Some(saved.as_str()));
        assert!(matches!(outcome, Renewal::Kept { .. }));
        assert_eq!(suite.in_use(), Some(saved.clone()));
        assert_eq!(suite.shared(), Some(saved));
        assert_eq!(
            suite.renew_at.load(Ordering::Relaxed),
            NOW + RETRY_AFTER_SECS
        );
    }

    #[tokio::test]
    async fn an_unusable_reply_is_not_saved() {
        let saved = token_for(7, NOW + 3 * DAY);
        for reply in [
            "not a token".to_string(),
            token_for(8, NOW + 7 * DAY),
            token_for(7, NOW - DAY),
            token_for(7, NOW + DAY),
        ] {
            let suite = Suite::new("unusable");
            let server = MockServer::replying(Ok(reply));

            let outcome = suite.start(&saved, &server).await;

            assert!(matches!(outcome, Renewal::Kept { .. }), "{outcome:?}");
            assert_eq!(suite.in_use(), Some(saved.clone()));
            assert_eq!(suite.shared(), Some(saved.clone()));
        }
    }

    #[tokio::test]
    async fn a_newer_shared_token_is_renewed_rather_than_an_older_saved_one() {
        let suite = Suite::new("newer-valid");
        let saved = token_for(7, NOW + 2 * DAY);
        let from_plugin = token_for(7, NOW + 6 * DAY);
        suite.put_shared(&from_plugin);
        let renewed = token_for(7, NOW + 7 * DAY);
        let server = MockServer::replying(Ok(renewed.clone()));

        suite.start(&saved, &server).await;

        assert_eq!(server.seen(), vec![from_plugin]);
        assert_eq!(suite.shared(), Some(renewed));
    }

    #[tokio::test]
    async fn an_older_shared_token_does_not_replace_a_valid_saved_one() {
        let suite = Suite::new("older-shared");
        let saved = token_for(7, NOW + 5 * DAY);
        suite.put_shared(&token_for(7, NOW + 2 * DAY));
        let server = MockServer::replying(Err("offline".into()));

        suite.start(&saved, &server).await;

        assert_eq!(server.seen(), vec![saved.clone()]);
        assert_eq!(suite.shared(), Some(saved));
    }

    #[tokio::test]
    async fn an_expired_saved_token_adopts_a_newer_shared_token() {
        let suite = Suite::new("adopt");
        let saved = token_for(7, NOW - DAY);
        let from_plugin = token_for(7, NOW + 6 * DAY);
        suite.put_shared(&from_plugin);
        let renewed = token_for(7, NOW + 7 * DAY);
        let server = MockServer::replying(Ok(renewed.clone()));

        let outcome = suite.start(&saved, &server).await;

        assert_eq!(outcome, Renewal::Renewed(renewed.clone()));
        assert_eq!(server.seen(), vec![from_plugin]);
        assert_eq!(suite.in_use(), Some(renewed.clone()));
        assert_eq!(suite.shared(), Some(renewed));
    }

    #[tokio::test]
    async fn an_adopted_token_stays_in_use_when_the_renewal_fails() {
        let suite = Suite::new("adopt-offline");
        let saved = token_for(7, NOW - DAY);
        let from_plugin = token_for(7, NOW + 6 * DAY);
        suite.put_shared(&from_plugin);
        let server = MockServer::replying(Err("offline".into()));

        let outcome = suite.start(&saved, &server).await;

        assert_eq!(outcome.token(), Some(from_plugin.as_str()));
        assert_eq!(suite.in_use(), Some(from_plugin.clone()));
        assert_eq!(suite.shared(), Some(from_plugin));
    }

    #[tokio::test]
    async fn an_expired_session_leaves_the_shared_file_alone() {
        let saved = token_for(7, NOW - DAY);
        let stale_shared = token_for(7, NOW - 2 * DAY);
        for shared in [
            None,
            Some(stale_shared.clone()),
            Some("garbage".to_string()),
            Some(token_for(7, NOW + 30)),
        ] {
            let suite = Suite::new("expired");
            if let Some(s) = &shared {
                suite.put_shared(s);
            }
            let server = MockServer::replying(Ok(token_for(7, NOW + 7 * DAY)));

            let outcome = suite.start(&saved, &server).await;

            assert_eq!(outcome, Renewal::Expired);
            assert!(
                server.seen().is_empty(),
                "no request for an expired session"
            );
            assert_eq!(suite.in_use(), None);
            assert_eq!(suite.shared(), shared);
        }
    }

    #[tokio::test]
    async fn a_shared_token_of_another_account_is_not_adopted() {
        let suite = Suite::new("other-account");
        let saved = token_for(7, NOW - DAY);
        let someone_else = token_for(8, NOW + 6 * DAY);
        suite.put_shared(&someone_else);
        let server = MockServer::replying(Ok(token_for(8, NOW + 7 * DAY)));

        let outcome = suite.start(&saved, &server).await;

        assert_eq!(outcome, Renewal::Expired);
        assert!(server.seen().is_empty());
        assert_eq!(suite.in_use(), None);
        assert_eq!(suite.shared(), Some(someone_else));
    }

    #[tokio::test]
    async fn a_sign_out_during_the_renewal_wins() {
        let suite = Suite::new("sign-out");
        let in_use = token_for(7, NOW + 3 * DAY);
        *suite.token.lock().unwrap() = Some(in_use.clone());
        let shared_file = suite.shared_file();
        let token_slot = &suite.token;

        // The person signs out while the request is out.
        let outcome = renew_session(
            Some(in_use.clone()),
            token_slot,
            &suite.renew_at,
            Some(&shared_file),
            NOW,
            |t| {
                *token_slot.lock().unwrap() = None;
                sync_shared_token(&shared_file, None);
                std::future::ready(if t == in_use {
                    Ok(token_for(7, NOW + 7 * DAY))
                } else {
                    Err("unexpected token".to_string())
                })
            },
        )
        .await;

        assert_eq!(outcome, Renewal::Stale);
        assert_eq!(suite.in_use(), None);
        assert_eq!(suite.shared(), None);
        assert_eq!(suite.renew_at.load(Ordering::Relaxed), 0);
    }

    #[tokio::test]
    async fn the_running_suite_renews_every_12_hours() {
        let suite = Suite::new("periodic");
        let saved = token_for(7, NOW + 3 * DAY);
        let server = MockServer::replying(Ok(token_for(7, NOW + 7 * DAY)));
        suite.start(&saved, &server).await;
        let renew_at = suite.renew_at.load(Ordering::Relaxed);

        assert_eq!(RENEW_EVERY_SECS, 12 * 60 * 60);
        assert!(!renewal_due(true, renew_at, NOW + RENEW_EVERY_SECS - 1));
        assert!(renewal_due(true, renew_at, NOW + RENEW_EVERY_SECS));
        assert!(!renewal_due(false, renew_at, NOW + 2 * RENEW_EVERY_SECS));

        // 12 hours later the background task renews the token in use.
        let later = NOW + RENEW_EVERY_SECS;
        let in_use = suite.in_use();
        let renewed = token_for(7, later + 7 * DAY);
        let server = MockServer::replying(Ok(renewed.clone()));
        let shared_file = suite.shared_file();
        let outcome = renew_session(
            in_use.clone(),
            &suite.token,
            &suite.renew_at,
            Some(&shared_file),
            later,
            |t| server.refresh(t),
        )
        .await;

        assert_eq!(outcome, Renewal::Renewed(renewed.clone()));
        assert_eq!(server.seen(), vec![in_use.unwrap()]);
        assert_eq!(suite.in_use(), Some(renewed.clone()));
        assert_eq!(suite.shared(), Some(renewed));
        assert_eq!(
            suite.renew_at.load(Ordering::Relaxed),
            later + RENEW_EVERY_SECS
        );
    }

    #[test]
    fn only_an_explicit_sync_with_none_deletes_the_shared_file() {
        let suite = Suite::new("sign-out-file");
        suite.put_shared(&token_for(7, NOW + DAY));
        assert!(suite.shared().is_some());
        sync_shared_token(&suite.shared_file(), None);
        assert_eq!(suite.shared(), None);
    }

    #[cfg(unix)]
    #[test]
    fn the_shared_file_is_readable_by_its_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let suite = Suite::new("mode");
        let path = suite.shared_file();
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        // A file left by an older Suite, readable by everyone.
        std::fs::write(&path, "old").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();

        suite.put_shared("new");

        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        assert_eq!(suite.shared().as_deref(), Some("new"));
        let leftovers = std::fs::read_dir(path.parent().unwrap()).unwrap().count();
        assert_eq!(leftovers, 1, "no temporary file left behind");
    }

    #[test]
    fn the_shared_file_is_checked_before_use() {
        let suite = Suite::new("read");
        let path = suite.shared_file();
        assert_eq!(read_shared_token(&path), None);

        suite.put_shared("  abc.def.ghi\n");
        assert_eq!(read_shared_token(&path).as_deref(), Some("abc.def.ghi"));

        suite.put_shared(&"a".repeat(MAX_TOKEN_LEN + 1));
        assert_eq!(read_shared_token(&path), None);

        std::fs::write(&path, [0xff, 0xfe, b'a']).unwrap();
        assert_eq!(read_shared_token(&path), None);

        suite.put_shared("   ");
        assert_eq!(read_shared_token(&path), None);
    }

    #[test]
    fn tokens_that_are_not_well_formed_are_refused() {
        let good = token_for(7, NOW + DAY);
        assert!(Token::parse(&good).is_some());
        let payload = good.split('.').nth(1).unwrap();
        let no_exp = jwt(serde_json::json!({ "userId": 7 }));
        let text_exp = jwt(serde_json::json!({ "userId": 7, "exp": "tomorrow" }));
        let list = format!("e30.{}.c2ln", URL_SAFE_NO_PAD.encode("[1,2]"));
        for bad in [
            String::new(),
            "abc".to_string(),
            format!("e30.{payload}"),
            format!("e30.{payload}.c2ln.extra"),
            format!("e30.{payload}.c2ln\n"),
            format!("e30.{payload}.sïg"),
            "e30.!!!.c2ln".to_string(),
            "e30.a.c2ln".to_string(),
            no_exp,
            text_exp,
            list,
            format!("e30.{}.c2ln", "a".repeat(MAX_TOKEN_LEN)),
        ] {
            assert!(Token::parse(&bad).is_none(), "{bad:?}");
        }
        // A fractional expiry from some JWT libraries still reads.
        let fractional = jwt(serde_json::json!({ "userId": 7, "exp": 1_793_086_400.5 }));
        assert_eq!(
            Token::parse(&fractional).map(|t| t.exp),
            Some(1_793_086_400)
        );
    }

    #[test]
    fn a_token_about_to_expire_counts_as_expired() {
        assert!(Token::parse(&token_for(7, NOW + EXPIRY_MARGIN_SECS + 1))
            .unwrap()
            .is_valid(NOW));
        assert!(!Token::parse(&token_for(7, NOW + EXPIRY_MARGIN_SECS))
            .unwrap()
            .is_valid(NOW));
    }
}
