//! Keeps the Suite's sign-in in step with the one every Hardwave program shares.
//!
//! The Suite, the DAW and the plug-in windows keep one account token in one file,
//! `hardwave/auth_token` in the user's data folder (`%APPDATA%\hardwave\auth_token`
//! on Windows). That file is the one source of truth: signing in anywhere writes
//! it, signing out anywhere deletes it. The Suite follows it when it starts, when
//! its window comes to the front and on its background check every 10 minutes: a
//! token there that the site confirms (GET /api/auth/me) is the account the Suite
//! shows, whichever program signed in; no file, or a token the site refuses, means
//! signed out.
//!
//! The Suite writes the file only when it signs in itself (`login` in lib.rs) and
//! when it renews the token, every 12 hours while it runs. A renewal is written only
//! while the file still holds the token that was renewed, so it never undoes a
//! sign-out or a newer sign-in made elsewhere. Only the Suite's own sign-out deletes
//! the file (`logout` in lib.rs).

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

use crate::models::User;

/// How long a renewed token is kept before the Suite renews it again.
pub const RENEW_EVERY_SECS: i64 = 12 * 60 * 60;
/// When a renewal fails (offline, server error), the next try comes this much later.
pub const RETRY_AFTER_SECS: i64 = 60 * 60;
/// A sign-in the site confirmed this recently is not asked about again when the
/// window comes back to the front. After that, the next time it does, the site is
/// asked once more, so a sign-out the site made (sign out everywhere, a new
/// password) shows within minutes.
pub const RECHECK_AFTER_SECS: i64 = 5 * 60;
/// How often the background task looks at the shared file and the clock. The
/// renewal itself follows the wall clock, so a computer that slept through the 12
/// hours renews soon after it wakes.
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
/// Event the main window gets when the Suite renewed the token in use.
pub const RENEWED_EVENT: &str = "auth:renewed";
/// Event the main window gets when the background check found the sign-in changed
/// elsewhere (a `Session`).
pub const CHANGED_EVENT: &str = "auth:changed";

/// The running Suite's sign-in. The two times change only while `token` is locked,
/// so all three always describe the same token.
#[derive(Default)]
pub struct SessionState {
    /// The token every request uses.
    token: Mutex<Option<String>>,
    /// Unix time of the next background renewal of `token`.
    renew_at: AtomicI64,
    /// Unix time the site last confirmed `token`; 0 while it has not.
    confirmed_at: AtomicI64,
}

impl SessionState {
    /// The token in use, for a request.
    pub fn token(&self) -> Option<String> {
        self.token.lock().unwrap().clone()
    }

    /// The token in use and when the site last confirmed it.
    fn snapshot(&self) -> (Option<String>, i64) {
        let token = self.token.lock().unwrap();
        (token.clone(), self.confirmed_at.load(Ordering::Relaxed))
    }

    /// The Suite signed in itself: the site just issued `token`, so it counts as
    /// confirmed, and its first renewal is 12 hours away.
    pub fn signed_in(&self, token: String, now: i64) {
        let mut slot = self.token.lock().unwrap();
        *slot = Some(token);
        self.confirmed_at.store(now, Ordering::Relaxed);
        self.renew_at
            .store(now.saturating_add(RENEW_EVERY_SECS), Ordering::Relaxed);
    }

    /// A token handed over by a window from before `sync_session`. It is used but
    /// not confirmed, so the next follow asks the site about it.
    pub fn use_unconfirmed(&self, token: String, now: i64) {
        let mut slot = self.token.lock().unwrap();
        self.renew_at
            .store(first_renewal(&token, now), Ordering::Relaxed);
        self.confirmed_at.store(0, Ordering::Relaxed);
        *slot = Some(token);
    }

    /// Forgets the token in this app and returns it. The shared file is not
    /// touched here.
    pub fn sign_out(&self) -> Option<String> {
        let mut slot = self.token.lock().unwrap();
        self.confirmed_at.store(0, Ordering::Relaxed);
        slot.take()
    }

    /// Whether the background renewal is due.
    pub fn renewal_due(&self, now: i64) -> bool {
        let slot = self.token.lock().unwrap();
        renewal_due(slot.is_some(), self.renew_at.load(Ordering::Relaxed), now)
    }
}

/// A token whose payload could be read. The signature is not checked here: the
/// server does that on every request.
struct Token {
    exp: i64,
    claims: serde_json::Map<String, serde_json::Value>,
}

impl Token {
    /// Reads a JWT's payload. Anything that is not three base64url parts with a
    /// JSON object holding a numeric `exp` in the middle is refused.
    fn parse(raw: &str) -> Option<Self> {
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
        let exp = Self::seconds(claims.get("exp")?)?;
        Some(Token { exp, claims })
    }

    /// A time claim in seconds; some JWT libraries write fractions.
    fn seconds(value: &serde_json::Value) -> Option<i64> {
        match value {
            serde_json::Value::Number(n) => n
                .as_i64()
                .or_else(|| n.as_f64().filter(|f| f.is_finite()).map(|f| f as i64)),
            _ => None,
        }
    }

    fn is_valid(&self, now: i64) -> bool {
        self.exp.saturating_sub(EXPIRY_MARGIN_SECS) > now
    }

    /// When the token was issued, if it says.
    fn issued_at(&self) -> Option<i64> {
        self.claims.get("iat").and_then(Self::seconds)
    }

    /// The account id the site puts in its tokens.
    fn user_id(&self) -> Option<i64> {
        self.claims
            .get("userId")
            .or_else(|| self.claims.get("user_id"))
            .and_then(serde_json::Value::as_i64)
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

/// Whether two tokens belong to the same account. A token that cannot be read
/// belongs to none.
pub fn same_account(a: &str, b: &str) -> bool {
    match (Token::parse(a), Token::parse(b)) {
        (Some(a), Some(b)) => a.same_account(&b),
        _ => false,
    }
}

/// When a token the Suite takes over from the shared file is first renewed: 12
/// hours after it was issued, so one another program just renewed is left alone
/// and an older one is renewed at the next check.
fn first_renewal(token: &str, now: i64) -> i64 {
    let renew_every = |iat: i64| iat.saturating_add(RENEW_EVERY_SECS);
    Token::parse(token)
        .and_then(|t| t.issued_at())
        .map_or(now, renew_every)
        .min(now.saturating_add(RENEW_EVERY_SECS))
}

/// A reply to a renewal is used only when it is a valid token of the same account
/// that does not expire before the one it replaces.
fn is_renewal_of(new: &str, current: &str, now: i64) -> bool {
    match (Token::parse(new), Token::parse(current)) {
        (Some(n), Some(c)) => n.is_valid(now) && n.same_account(&c) && n.exp >= c.exp,
        _ => false,
    }
}

/// What the shared file means for the Suite's sign-in.
#[derive(Debug, PartialEq, Eq)]
enum Follow {
    /// No token the site could take: no file, an unreadable one, or a token that
    /// has run out. Signed out.
    SignedOut,
    /// The token in use, which the site confirmed a short while ago. Nothing to do.
    Same,
    /// A token to ask the site about: a new one (signed in elsewhere, or renewed by
    /// another program), or the one in use when its last confirmation is a while
    /// back.
    Check(String),
}

/// Decides what the shared token file means, given the token in use (`in_use`),
/// when the site last confirmed it (`confirmed_at`, 0 for never) and the file's
/// token (`shared`).
fn follow(in_use: Option<&str>, confirmed_at: i64, shared: Option<&str>, now: i64) -> Follow {
    let Some(shared) = shared.filter(|s| Token::parse(s).is_some_and(|t| t.is_valid(now))) else {
        return Follow::SignedOut;
    };
    let since = now.saturating_sub(confirmed_at);
    let confirmed_recently = confirmed_at > 0 && (0..RECHECK_AFTER_SECS).contains(&since);
    if in_use == Some(shared) && confirmed_recently {
        Follow::Same
    } else {
        Follow::Check(shared.to_string())
    }
}

/// What the site said about a token (GET /api/auth/me).
#[derive(Debug, PartialEq)]
pub enum Me {
    /// The account the token belongs to.
    Account(User),
    /// The site refused the token (HTTP 401 or 403): run out, signed out, from
    /// before a password change, or the account was switched off.
    Refused,
    /// The site could not be asked, or gave no usable answer. The reason never
    /// holds the token.
    Unreachable(String),
}

/// Where the Suite's sign-in stands after following the shared file. The window
/// gets this as JSON, `{"state": "signedIn", ...}`.
#[derive(Clone, PartialEq, serde::Serialize)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum Session {
    /// Nobody is signed in on this computer, or the site refused the sign-in that
    /// is there.
    SignedOut,
    /// Signed in as `user`; the site just confirmed `token`.
    SignedIn { token: String, user: User },
    /// The file holds a sign-in the site could not be asked about (offline). It is
    /// in use; `user_id` is the account it names, so the window can show the
    /// account it last saw when it is that one.
    Unconfirmed {
        token: String,
        #[serde(rename = "userId")]
        user_id: Option<i64>,
    },
    /// Nothing changed.
    Unchanged,
}

/// Never prints the token.
impl std::fmt::Debug for Session {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Session::SignedOut => f.write_str("SignedOut"),
            Session::SignedIn { user, .. } => write!(f, "SignedIn(user {})", user.id),
            Session::Unconfirmed { user_id, .. } => write!(f, "Unconfirmed(user {user_id:?})"),
            Session::Unchanged => f.write_str("Unchanged"),
        }
    }
}

/// Follows the shared file: a token there is used once the site confirms it
/// (`ask_me`, GET /api/auth/me), and the Suite signs out when the file is gone or
/// the site refuses its token. The file itself is never written or deleted here.
/// When the Suite signed in or out, or the file changed, while the site was being
/// asked, nothing is changed: that newer change stands, and the next follow sees it.
/// Without a data folder there is no shared file to follow, and nothing changes.
pub async fn follow_shared<F, Fut>(
    state: &SessionState,
    shared_file: Option<&Path>,
    now: i64,
    ask_me: F,
) -> Session
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Me>,
{
    let Some(shared_file) = shared_file else {
        return Session::Unchanged;
    };
    let (before, confirmed_at) = state.snapshot();
    let shared = read_shared_token(shared_file);
    let answer = match follow(before.as_deref(), confirmed_at, shared.as_deref(), now) {
        Follow::Same => return Session::Unchanged,
        Follow::SignedOut => None,
        Follow::Check(token) => {
            let me = ask_me(token.clone()).await;
            Some((token, me))
        }
    };

    let mut slot = state.token.lock().unwrap();
    if *slot != before || read_shared_token(shared_file) != shared {
        return Session::Unchanged;
    }
    if matches!(answer, Some((_, Me::Refused))) {
        log::info!("[session] the site no longer takes the shared sign-in");
    }
    match answer {
        None | Some((_, Me::Refused)) => {
            *slot = None;
            state.confirmed_at.store(0, Ordering::Relaxed);
            Session::SignedOut
        }
        Some((token, Me::Account(user))) => {
            if slot.as_deref() != Some(token.as_str()) {
                state
                    .renew_at
                    .store(first_renewal(&token, now), Ordering::Relaxed);
            }
            *slot = Some(token.clone());
            state.confirmed_at.store(now, Ordering::Relaxed);
            Session::SignedIn { token, user }
        }
        Some((token, Me::Unreachable(why))) => {
            log::warn!("[session] could not confirm the sign-in: {why}");
            if slot.as_deref() == Some(token.as_str()) {
                return Session::Unchanged;
            }
            let user_id = Token::parse(&token).and_then(|t| t.user_id());
            state
                .renew_at
                .store(first_renewal(&token, now), Ordering::Relaxed);
            state.confirmed_at.store(0, Ordering::Relaxed);
            *slot = Some(token.clone());
            Session::Unconfirmed { token, user_id }
        }
    }
}

/// What a renewal did.
#[derive(Debug, PartialEq, Eq)]
pub enum Renewal {
    /// The server issued a new token; it is now in use and in the shared file.
    Renewed(String),
    /// No new token (offline, server error, unusable reply, the file could not be
    /// written). The token in use stays, the file is left as it is, and the next
    /// try comes in an hour.
    Kept { why: String },
    /// Nothing to renew: no token in use, one that has run out, or the shared file
    /// no longer holds it (another program signed in or out; following the file
    /// comes first). Nothing was asked or changed.
    Skipped,
    /// The Suite signed in or out, or the shared file changed, while the request
    /// was out. Nothing was changed.
    Stale,
}

/// Renews the token in use (`refresh`, POST /api/auth/refresh) and puts the new one
/// in the shared file, but only while the file still holds the token that was
/// renewed: a sign-out or a newer sign-in made elsewhere meanwhile stands.
pub async fn renew_in_use<F, Fut>(
    state: &SessionState,
    shared_file: Option<&Path>,
    now: i64,
    refresh: F,
) -> Renewal
where
    F: FnOnce(String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let Some(current) = state.token() else {
        return Renewal::Skipped;
    };
    let in_file = |path: &Path| read_shared_token(path).as_deref() == Some(current.as_str());
    if !Token::parse(&current).is_some_and(|t| t.is_valid(now))
        || shared_file.is_some_and(|path| !in_file(path))
    {
        return Renewal::Skipped;
    }
    let reply = refresh(current.clone()).await;

    let mut slot = state.token.lock().unwrap();
    if slot.as_deref() != Some(current.as_str()) {
        return Renewal::Stale;
    }
    let retry = || {
        state
            .renew_at
            .store(now.saturating_add(RETRY_AFTER_SECS), Ordering::Relaxed)
    };
    let new = match reply {
        Ok(new) if is_renewal_of(&new, &current, now) => new,
        Ok(_) => {
            retry();
            return Renewal::Kept {
                why: "the server's reply held no usable token".into(),
            };
        }
        Err(why) => {
            retry();
            return Renewal::Kept { why };
        }
    };
    // Written under the lock, so a sign-out in this Suite that clears the slot first
    // is never undone by this write.
    if let Some(path) = shared_file {
        match replace_shared_token(path, &current, &new) {
            Ok(true) => {}
            Ok(false) => return Renewal::Stale,
            Err(e) => {
                retry();
                return Renewal::Kept {
                    why: format!("could not write the shared token file: {e}"),
                };
            }
        }
    }
    *slot = Some(new.clone());
    state
        .renew_at
        .store(now.saturating_add(RENEW_EVERY_SECS), Ordering::Relaxed);
    state.confirmed_at.store(now, Ordering::Relaxed);
    Renewal::Renewed(new)
}

/// Whether the background task should renew now.
pub fn renewal_due(has_token: bool, renew_at: i64, now: i64) -> bool {
    has_token && now >= renew_at
}

/// Renews the token in use and tells the main window the new one, so it can save
/// it.
pub async fn renew_and_tell(app: &AppHandle, state: &SessionState, now: i64) {
    let shared_file = crate::shared_vst_token_path();
    let outcome = renew_in_use(state, shared_file.as_deref(), now, |token| async move {
        crate::api::refresh_token(&token).await
    })
    .await;
    match &outcome {
        Renewal::Renewed(token) => {
            log::info!("[session] token renewed");
            if let Err(e) = app.emit_to("main", RENEWED_EVENT, token) {
                log::warn!("[session] could not hand the renewed token to the window: {e}");
            }
        }
        Renewal::Kept { why } => log::warn!("[session] token not renewed: {why}"),
        Renewal::Skipped | Renewal::Stale => {}
    }
}

/// Follows the shared file with the live site.
pub async fn follow_live(state: &SessionState, now: i64) -> Session {
    let shared_file = crate::shared_vst_token_path();
    follow_shared(state, shared_file.as_deref(), now, |token| async move {
        crate::api::me(&token).await
    })
    .await
}

/// Every 10 minutes while the Suite runs: follows the shared file when it no longer
/// holds the token in use, and tells the main window (`auth:changed`), so a sign-in
/// or sign-out elsewhere shows even while the window stays in the background.
/// Otherwise renews the token when it is due (every 12 hours).
pub fn spawn_background(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(CHECK_EVERY).await;
            let state = app.state::<crate::AppState>();
            let now = chrono::Utc::now().timestamp();
            let in_file = crate::shared_vst_token_path()
                .as_deref()
                .and_then(read_shared_token);
            if in_file != state.session.token() {
                let session = follow_live(&state.session, now).await;
                if session != Session::Unchanged {
                    if let Err(e) = app.emit_to("main", CHANGED_EVENT, &session) {
                        log::warn!("[session] could not tell the window the sign-in changed: {e}");
                    }
                }
            } else if state.session.renewal_due(now) {
                renew_and_tell(&app, &state.session, now).await;
            }
        }
    });
}

/// Writes `new` to the shared file only while it still holds `expected`, so a
/// renewal never replaces a sign-out or a newer sign-in another program made
/// meanwhile. Returns whether it wrote. Another program could still change the
/// file between this read and the write; that window is a few milliseconds, and the
/// DAW checks the same way.
fn replace_shared_token(path: &Path, expected: &str, new: &str) -> std::io::Result<bool> {
    if read_shared_token(path).as_deref() != Some(expected) {
        return Ok(false);
    }
    write_private(path, new)?;
    Ok(true)
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
    const HOUR: i64 = 60 * 60;

    /// A token the parser accepts; the signature part is not checked.
    fn jwt(claims: serde_json::Value) -> String {
        let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"HS256","typ":"JWT"}"#);
        let payload = URL_SAFE_NO_PAD.encode(claims.to_string());
        format!("{header}.{payload}.c2lnbmF0dXJl")
    }

    /// A token the way the site makes them: 7 days, issued `exp - 7 days`.
    fn token_for(user: i64, exp: i64) -> String {
        jwt(serde_json::json!({
            "userId": user, "email": format!("user{user}@example.com"), "isAdmin": false,
            "tv": 0, "iat": exp - 7 * DAY, "exp": exp,
        }))
    }

    fn user(id: i64) -> User {
        User {
            id,
            email: format!("user{id}@example.com"),
            display_name: Some(format!("User {id}")),
            avatar_url: None,
            is_admin: false,
        }
    }

    /// Stands in for the site: records the bearer token of each request and
    /// answers with a fixed reply.
    struct MockSite<R: Clone> {
        reply: R,
        seen: Mutex<Vec<String>>,
    }

    impl<R: Clone> MockSite<R> {
        fn replying(reply: R) -> Self {
            MockSite {
                reply,
                seen: Mutex::new(Vec::new()),
            }
        }

        fn ask(&self, token: String) -> std::future::Ready<R> {
            self.seen.lock().unwrap().push(token);
            std::future::ready(self.reply.clone())
        }

        fn seen(&self) -> Vec<String> {
            self.seen.lock().unwrap().clone()
        }
    }

    /// GET /api/auth/me.
    fn me_says(answer: Me) -> MockSite<MeReply> {
        MockSite::replying(MeReply(answer))
    }

    /// `Me` without Clone in the main code: the mock hands out copies.
    struct MeReply(Me);

    impl Clone for MeReply {
        fn clone(&self) -> Self {
            MeReply(match &self.0 {
                Me::Account(u) => Me::Account(u.clone()),
                Me::Refused => Me::Refused,
                Me::Unreachable(why) => Me::Unreachable(why.clone()),
            })
        }
    }

    /// The Suite's in-memory session and the shared file, in a fresh folder.
    struct Suite {
        dir: PathBuf,
        session: SessionState,
    }

    impl Suite {
        fn new(name: &str) -> Self {
            let dir =
                std::env::temp_dir().join(format!("hw-session-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            Suite {
                dir,
                session: SessionState::default(),
            }
        }

        fn shared_file(&self) -> PathBuf {
            self.dir.join("hardwave").join("auth_token")
        }

        /// Another program (the DAW, a plug-in) signs in or renews.
        fn put_shared(&self, token: &str) {
            sync_shared_token(&self.shared_file(), Some(token));
        }

        /// Another program signs out.
        fn delete_shared(&self) {
            sync_shared_token(&self.shared_file(), None);
        }

        fn shared(&self) -> Option<String> {
            std::fs::read_to_string(self.shared_file()).ok()
        }

        fn in_use(&self) -> Option<String> {
            self.session.token()
        }

        fn renew_at(&self) -> i64 {
            self.session.renew_at.load(Ordering::Relaxed)
        }

        async fn follow(&self, now: i64, site: &MockSite<MeReply>) -> Session {
            let file = self.shared_file();
            follow_shared(&self.session, Some(&file), now, |t| async move {
                site.ask(t).await.0
            })
            .await
        }

        async fn renew(&self, now: i64, site: &MockSite<Result<String, String>>) -> Renewal {
            let file = self.shared_file();
            renew_in_use(&self.session, Some(&file), now, |t| site.ask(t)).await
        }
    }

    impl Drop for Suite {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }

    // ── What the shared file means ──

    #[test]
    fn no_usable_token_in_the_file_means_signed_out() {
        let in_use = token_for(7, NOW + 3 * DAY);
        for shared in [
            None,
            Some("garbage".to_string()),
            Some(token_for(7, NOW - DAY)),
            Some(token_for(7, NOW + EXPIRY_MARGIN_SECS)),
        ] {
            assert_eq!(
                follow(Some(&in_use), NOW, shared.as_deref(), NOW),
                Follow::SignedOut,
                "{shared:?}"
            );
            assert_eq!(follow(None, 0, shared.as_deref(), NOW), Follow::SignedOut);
        }
    }

    #[test]
    fn a_new_token_in_the_file_is_checked_whatever_the_account() {
        let in_use = token_for(7, NOW + 3 * DAY);
        let same_account = token_for(7, NOW + 6 * DAY);
        let other_account = token_for(8, NOW + 6 * DAY);
        for shared in [&same_account, &other_account] {
            assert_eq!(
                follow(Some(&in_use), NOW, Some(shared), NOW),
                Follow::Check(shared.clone())
            );
            assert_eq!(
                follow(None, 0, Some(shared), NOW),
                Follow::Check(shared.clone())
            );
        }
    }

    #[test]
    fn the_token_in_use_is_asked_about_again_only_after_five_minutes() {
        let token = token_for(7, NOW + 3 * DAY);
        let at =
            |confirmed_at: i64, now: i64| follow(Some(&token), confirmed_at, Some(&token), now);

        assert_eq!(at(NOW, NOW), Follow::Same);
        assert_eq!(at(NOW, NOW + RECHECK_AFTER_SECS - 1), Follow::Same);
        assert_eq!(
            at(NOW, NOW + RECHECK_AFTER_SECS),
            Follow::Check(token.clone())
        );
        // Never confirmed (taken over while offline), or a clock that went back.
        assert_eq!(at(0, NOW), Follow::Check(token.clone()));
        assert_eq!(at(NOW + HOUR, NOW), Follow::Check(token.clone()));
    }

    #[test]
    fn a_token_taken_over_is_renewed_12_hours_after_it_was_issued() {
        // Just renewed by the DAW: left alone for 12 hours.
        let fresh = token_for(7, NOW + 7 * DAY);
        assert_eq!(first_renewal(&fresh, NOW), NOW + RENEW_EVERY_SECS);
        // Two days old: renewed at the next check.
        let older = token_for(7, NOW + 5 * DAY);
        assert!(first_renewal(&older, NOW) <= NOW);
        // No issue time, or one in the future: no later than 12 hours from now.
        let no_iat = jwt(serde_json::json!({ "userId": 7, "exp": NOW + DAY }));
        assert_eq!(first_renewal(&no_iat, NOW), NOW);
        let future = token_for(7, NOW + 9 * DAY);
        assert_eq!(first_renewal(&future, NOW), NOW + RENEW_EVERY_SECS);
    }

    #[test]
    fn accounts_are_told_apart_by_their_claims() {
        let a = token_for(7, NOW + DAY);
        assert!(same_account(&a, &token_for(7, NOW + 5 * DAY)));
        assert!(!same_account(&a, &token_for(8, NOW + DAY)));
        assert!(!same_account(&a, "garbage"));
    }

    // ── Following the file ──

    #[tokio::test]
    async fn a_sign_in_made_elsewhere_is_picked_up_once_the_site_confirms_it() {
        let suite = Suite::new("pick-up");
        let from_daw = token_for(8, NOW + 7 * DAY);
        suite.put_shared(&from_daw);
        let site = me_says(Me::Account(user(8)));

        let session = suite.follow(NOW, &site).await;

        assert_eq!(
            session,
            Session::SignedIn {
                token: from_daw.clone(),
                user: user(8)
            }
        );
        assert_eq!(site.seen(), vec![from_daw.clone()]);
        assert_eq!(suite.in_use(), Some(from_daw.clone()));
        assert_eq!(suite.renew_at(), NOW + RENEW_EVERY_SECS);
        // Following never writes the file.
        assert_eq!(suite.shared(), Some(from_daw));
    }

    #[tokio::test]
    async fn another_account_signed_in_elsewhere_replaces_the_one_shown() {
        let suite = Suite::new("switch");
        suite
            .session
            .signed_in(token_for(7, NOW + 6 * DAY), NOW - HOUR);
        let other = token_for(8, NOW + 7 * DAY);
        suite.put_shared(&other);
        let site = me_says(Me::Account(user(8)));

        let session = suite.follow(NOW, &site).await;

        assert_eq!(
            session,
            Session::SignedIn {
                token: other.clone(),
                user: user(8)
            }
        );
        assert_eq!(suite.in_use(), Some(other));
    }

    #[tokio::test]
    async fn a_sign_out_elsewhere_signs_the_suite_out_without_asking_the_site() {
        let suite = Suite::new("sign-out-elsewhere");
        let token = token_for(7, NOW + 6 * DAY);
        suite.put_shared(&token);
        suite.session.signed_in(token, NOW);
        suite.delete_shared();
        let site = me_says(Me::Account(user(7)));

        let session = suite.follow(NOW + 60, &site).await;

        assert_eq!(session, Session::SignedOut);
        assert!(site.seen().is_empty());
        assert_eq!(suite.in_use(), None);
        assert_eq!(suite.shared(), None);
    }

    #[tokio::test]
    async fn a_token_the_site_refuses_signs_the_suite_out_and_leaves_the_file() {
        let suite = Suite::new("refused");
        let token = token_for(7, NOW + 6 * DAY);
        suite.put_shared(&token);
        let site = me_says(Me::Refused);

        assert_eq!(suite.follow(NOW, &site).await, Session::SignedOut);
        assert_eq!(suite.in_use(), None);
        assert_eq!(suite.shared(), Some(token));
    }

    #[tokio::test]
    async fn the_site_is_asked_about_the_token_in_use_at_most_every_five_minutes() {
        let suite = Suite::new("recheck");
        let token = token_for(7, NOW + 6 * DAY);
        suite.put_shared(&token);
        let site = me_says(Me::Account(user(7)));
        suite.follow(NOW, &site).await;

        assert_eq!(suite.follow(NOW + 60, &site).await, Session::Unchanged);
        assert_eq!(site.seen().len(), 1);

        // Signed out everywhere on the website meanwhile.
        let refusing = me_says(Me::Refused);
        let later = NOW + RECHECK_AFTER_SECS;
        assert_eq!(suite.follow(later, &refusing).await, Session::SignedOut);
        assert_eq!(refusing.seen(), vec![token]);
        assert_eq!(suite.in_use(), None);
    }

    #[tokio::test]
    async fn offline_a_new_sign_in_is_used_unconfirmed_and_confirmed_later() {
        let suite = Suite::new("offline");
        let token = token_for(8, NOW + 7 * DAY);
        suite.put_shared(&token);
        let offline = me_says(Me::Unreachable("Auth check failed: offline".into()));

        let session = suite.follow(NOW, &offline).await;

        assert_eq!(
            session,
            Session::Unconfirmed {
                token: token.clone(),
                user_id: Some(8)
            }
        );
        assert_eq!(suite.in_use(), Some(token.clone()));
        // Still offline: nothing changes.
        assert_eq!(suite.follow(NOW + 60, &offline).await, Session::Unchanged);
        assert_eq!(suite.in_use(), Some(token.clone()));
        // Back online: the next follow asks again, though only a minute passed.
        let online = me_says(Me::Account(user(8)));
        assert_eq!(
            suite.follow(NOW + 120, &online).await,
            Session::SignedIn {
                token: token.clone(),
                user: user(8)
            }
        );
        assert_eq!(online.seen(), vec![token]);
    }

    #[tokio::test]
    async fn offline_the_confirmed_sign_in_in_use_stays() {
        let suite = Suite::new("offline-same");
        let token = token_for(7, NOW + 6 * DAY);
        suite.put_shared(&token);
        suite.session.signed_in(token.clone(), NOW);
        let offline = me_says(Me::Unreachable("Auth check answered HTTP 502".into()));

        let later = NOW + RECHECK_AFTER_SECS;
        assert_eq!(suite.follow(later, &offline).await, Session::Unchanged);
        assert_eq!(suite.in_use(), Some(token));
    }

    #[tokio::test]
    async fn a_sign_in_or_sign_out_in_the_suite_while_the_site_is_asked_wins() {
        let suite = Suite::new("race-suite");
        let from_daw = token_for(8, NOW + 7 * DAY);
        suite.put_shared(&from_daw);
        let file = suite.shared_file();
        let own = token_for(7, NOW + 7 * DAY);

        // The person signs in to the Suite while the site is asked about the DAW's token.
        let session = follow_shared(&suite.session, Some(&file), NOW, |_| {
            suite.session.signed_in(own.clone(), NOW);
            sync_shared_token(&file, Some(&own));
            std::future::ready(Me::Account(user(8)))
        })
        .await;

        assert_eq!(session, Session::Unchanged);
        assert_eq!(suite.in_use(), Some(own.clone()));
        assert_eq!(suite.shared(), Some(own));
    }

    #[tokio::test]
    async fn a_change_to_the_file_while_the_site_is_asked_wins() {
        let suite = Suite::new("race-file");
        suite.put_shared(&token_for(8, NOW + 7 * DAY));
        let file = suite.shared_file();

        // The DAW signs out while the site is asked.
        let session = follow_shared(&suite.session, Some(&file), NOW, |_| {
            sync_shared_token(&file, None);
            std::future::ready(Me::Account(user(8)))
        })
        .await;

        assert_eq!(session, Session::Unchanged);
        assert_eq!(suite.in_use(), None);
        // The next follow sees the sign-out.
        let site = me_says(Me::Account(user(8)));
        assert_eq!(suite.follow(NOW, &site).await, Session::SignedOut);
    }

    #[test]
    fn the_window_gets_the_session_as_tagged_json() {
        let token = token_for(7, NOW + DAY);
        let json = |s: &Session| serde_json::to_value(s).unwrap();
        assert_eq!(
            json(&Session::SignedIn {
                token: token.clone(),
                user: user(7)
            }),
            serde_json::json!({
                "state": "signedIn", "token": token,
                "user": { "id": 7, "email": "user7@example.com", "displayName": "User 7",
                          "avatarUrl": null, "isAdmin": false },
            })
        );
        assert_eq!(
            json(&Session::Unconfirmed {
                token: token.clone(),
                user_id: Some(7)
            }),
            serde_json::json!({ "state": "unconfirmed", "token": token, "userId": 7 })
        );
        assert_eq!(
            json(&Session::SignedOut),
            serde_json::json!({ "state": "signedOut" })
        );
        assert_eq!(
            json(&Session::Unchanged),
            serde_json::json!({ "state": "unchanged" })
        );
        // Debug output (logs, test failures) never holds the token.
        let shown = format!(
            "{:?}",
            Session::SignedIn {
                token: token.clone(),
                user: user(7)
            }
        );
        assert!(!shown.contains(&token), "{shown}");
    }

    // ── Renewing ──

    #[tokio::test]
    async fn a_renewal_is_written_while_the_file_holds_the_renewed_token() {
        let suite = Suite::new("renew");
        let token = token_for(7, NOW + 3 * DAY);
        suite.put_shared(&token);
        suite.session.signed_in(token.clone(), NOW - DAY);
        let renewed = token_for(7, NOW + 7 * DAY);
        let site = MockSite::replying(Ok(renewed.clone()));

        let outcome = suite.renew(NOW, &site).await;

        assert_eq!(outcome, Renewal::Renewed(renewed.clone()));
        assert_eq!(site.seen(), vec![token]);
        assert_eq!(suite.in_use(), Some(renewed.clone()));
        assert_eq!(suite.shared(), Some(renewed));
        assert_eq!(suite.renew_at(), NOW + RENEW_EVERY_SECS);
    }

    #[tokio::test]
    async fn a_sign_out_elsewhere_is_never_undone_by_a_renewal() {
        let suite = Suite::new("no-undo");
        let token = token_for(7, NOW + 3 * DAY);
        suite.put_shared(&token);
        suite.session.signed_in(token, NOW - DAY);
        suite.delete_shared();
        let site = MockSite::replying(Ok(token_for(7, NOW + 7 * DAY)));

        assert_eq!(suite.renew(NOW, &site).await, Renewal::Skipped);
        assert!(
            site.seen().is_empty(),
            "no request for a token no longer shared"
        );
        assert_eq!(suite.shared(), None);
        // The background check then follows the file.
        let me = me_says(Me::Account(user(7)));
        assert_eq!(suite.follow(NOW, &me).await, Session::SignedOut);
        assert_eq!(suite.shared(), None);
    }

    #[tokio::test]
    async fn a_sign_out_elsewhere_during_the_renewal_wins() {
        let suite = Suite::new("sign-out-during");
        let token = token_for(7, NOW + 3 * DAY);
        suite.put_shared(&token);
        suite.session.signed_in(token.clone(), NOW - DAY);
        let file = suite.shared_file();

        let outcome = renew_in_use(&suite.session, Some(&file), NOW, |_| {
            sync_shared_token(&file, None);
            std::future::ready(Ok(token_for(7, NOW + 7 * DAY)))
        })
        .await;

        assert_eq!(outcome, Renewal::Stale);
        assert_eq!(suite.shared(), None);
        assert_eq!(suite.in_use(), Some(token));
    }

    #[tokio::test]
    async fn a_newer_sign_in_elsewhere_during_the_renewal_wins() {
        let suite = Suite::new("sign-in-during");
        let token = token_for(7, NOW + 3 * DAY);
        suite.put_shared(&token);
        suite.session.signed_in(token, NOW - DAY);
        let file = suite.shared_file();
        let other = token_for(8, NOW + 7 * DAY);

        let outcome = renew_in_use(&suite.session, Some(&file), NOW, |_| {
            sync_shared_token(&file, Some(&other));
            std::future::ready(Ok(token_for(7, NOW + 7 * DAY)))
        })
        .await;

        assert_eq!(outcome, Renewal::Stale);
        assert_eq!(suite.shared(), Some(other));
    }

    #[tokio::test]
    async fn a_sign_out_in_the_suite_during_the_renewal_wins() {
        let suite = Suite::new("own-sign-out-during");
        let token = token_for(7, NOW + 3 * DAY);
        suite.put_shared(&token);
        suite.session.signed_in(token, NOW - DAY);
        let file = suite.shared_file();

        let outcome = renew_in_use(&suite.session, Some(&file), NOW, |_| {
            suite.session.sign_out();
            sync_shared_token(&file, None);
            std::future::ready(Ok(token_for(7, NOW + 7 * DAY)))
        })
        .await;

        assert_eq!(outcome, Renewal::Stale);
        assert_eq!(suite.in_use(), None);
        assert_eq!(suite.shared(), None);
        assert_eq!(suite.renew_at(), NOW - DAY + RENEW_EVERY_SECS);
    }

    #[tokio::test]
    async fn a_failed_renewal_leaves_the_file_alone_and_tries_again_sooner() {
        let token = token_for(7, NOW + 3 * DAY);
        for reply in [
            Err("Refresh refused (HTTP 503)".to_string()),
            Ok("not a token".to_string()),
            Ok(token_for(8, NOW + 7 * DAY)),
            Ok(token_for(7, NOW - DAY)),
            Ok(token_for(7, NOW + DAY)),
        ] {
            let suite = Suite::new("kept");
            suite.put_shared(&token);
            suite.session.signed_in(token.clone(), NOW - DAY);
            let modified = std::fs::metadata(suite.shared_file())
                .unwrap()
                .modified()
                .unwrap();
            let site = MockSite::replying(reply);

            let outcome = suite.renew(NOW, &site).await;

            assert!(matches!(outcome, Renewal::Kept { .. }), "{outcome:?}");
            assert_eq!(suite.in_use(), Some(token.clone()));
            assert_eq!(suite.shared(), Some(token.clone()));
            let after = std::fs::metadata(suite.shared_file())
                .unwrap()
                .modified()
                .unwrap();
            assert_eq!(after, modified, "the file is not written again");
            assert_eq!(suite.renew_at(), NOW + RETRY_AFTER_SECS);
        }
    }

    #[tokio::test]
    async fn an_expired_token_or_none_is_not_renewed() {
        let suite = Suite::new("skip");
        let site = MockSite::replying(Ok(token_for(7, NOW + 7 * DAY)));
        assert_eq!(suite.renew(NOW, &site).await, Renewal::Skipped);

        let expired = token_for(7, NOW - DAY);
        suite.put_shared(&expired);
        suite.session.signed_in(expired.clone(), NOW - 8 * DAY);
        assert_eq!(suite.renew(NOW, &site).await, Renewal::Skipped);
        assert!(site.seen().is_empty());
        assert_eq!(suite.shared(), Some(expired));
    }

    #[tokio::test]
    async fn the_running_suite_renews_every_12_hours() {
        let suite = Suite::new("periodic");
        let token = token_for(7, NOW + 7 * DAY);
        suite.put_shared(&token);
        let me = me_says(Me::Account(user(7)));
        suite.follow(NOW, &me).await;
        let renew_at = suite.renew_at();

        assert_eq!(RENEW_EVERY_SECS, 12 * 60 * 60);
        assert!(!suite.session.renewal_due(NOW + RENEW_EVERY_SECS - 1));
        assert!(suite.session.renewal_due(NOW + RENEW_EVERY_SECS));
        assert!(!renewal_due(true, renew_at, NOW + RENEW_EVERY_SECS - 1));
        assert!(!renewal_due(false, renew_at, NOW + 2 * RENEW_EVERY_SECS));

        // 12 hours later the background task renews the token in use.
        let later = NOW + RENEW_EVERY_SECS;
        let renewed = token_for(7, later + 7 * DAY);
        let site = MockSite::replying(Ok(renewed.clone()));
        let outcome = suite.renew(later, &site).await;

        assert_eq!(outcome, Renewal::Renewed(renewed.clone()));
        assert_eq!(site.seen(), vec![token]);
        assert_eq!(suite.in_use(), Some(renewed.clone()));
        assert_eq!(suite.shared(), Some(renewed));
        assert_eq!(suite.renew_at(), later + RENEW_EVERY_SECS);
    }

    #[test]
    fn signing_out_in_the_suite_forgets_the_token() {
        let suite = Suite::new("forget");
        let token = token_for(7, NOW + DAY);
        suite.session.signed_in(token.clone(), NOW);
        assert_eq!(suite.session.sign_out(), Some(token));
        assert_eq!(suite.in_use(), None);
        assert!(!suite.session.renewal_due(NOW + 2 * RENEW_EVERY_SECS));
    }

    #[test]
    fn a_handed_over_token_is_used_but_asked_about_on_the_next_follow() {
        let suite = Suite::new("handed-over");
        let token = token_for(7, NOW + 7 * DAY);
        suite.session.use_unconfirmed(token.clone(), NOW);
        let (in_use, confirmed_at) = suite.session.snapshot();
        assert_eq!(in_use.as_deref(), Some(token.as_str()));
        assert_eq!(
            follow(in_use.as_deref(), confirmed_at, Some(&token), NOW),
            Follow::Check(token)
        );
    }

    // ── The file ──

    #[test]
    fn only_an_explicit_sync_with_none_deletes_the_shared_file() {
        let suite = Suite::new("sign-out-file");
        suite.put_shared(&token_for(7, NOW + DAY));
        assert!(suite.shared().is_some());
        sync_shared_token(&suite.shared_file(), None);
        assert_eq!(suite.shared(), None);
    }

    #[test]
    fn a_conditional_write_only_replaces_the_expected_token() {
        let suite = Suite::new("replace");
        let path = suite.shared_file();
        assert!(!replace_shared_token(&path, "a.b.c", "d.e.f").unwrap());
        assert_eq!(suite.shared(), None, "a deleted file stays deleted");
        suite.put_shared("x.y.z");
        assert!(!replace_shared_token(&path, "a.b.c", "d.e.f").unwrap());
        assert_eq!(suite.shared().as_deref(), Some("x.y.z"));
        assert!(replace_shared_token(&path, "x.y.z", "d.e.f").unwrap());
        assert_eq!(suite.shared().as_deref(), Some("d.e.f"));
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

        // A renewal's conditional write keeps it that way.
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
        assert!(replace_shared_token(&path, "new", "newer").unwrap());
        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
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
        assert_eq!(Token::parse(&good).and_then(|t| t.user_id()), Some(7));
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
