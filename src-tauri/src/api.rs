use crate::models::{AuthResponse, DownloadsResponse, Product, User};
use crate::session::Me;

const BASE_URL: &str = "https://hardwavestudios.com/api";

pub async fn login(email: &str, password: &str) -> Result<AuthResponse, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/auth/login", BASE_URL))
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Login request failed: {}", e))?;

    let body = res
        .text()
        .await
        .map_err(|e| format!("Failed to read login response: {}", e))?;

    // Never put the response body in the error: a login response can carry the auth token, and the
    // error text ends up in logs and on screen. The length is enough to tell an empty reply from HTML.
    serde_json::from_str::<AuthResponse>(&body).map_err(|e| {
        format!(
            "Login parse error: {} (response of {} bytes)",
            e,
            body.len()
        )
    })
}

/// Signing out does not wait long for the site.
const LOGOUT_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(5);

/// Tells the site this token is signed out (POST /auth/logout, Bearer), so it stops
/// working at once rather than when it runs out. Only this token: the account's other
/// devices stay signed in. A failure changes nothing here; the sign-out on this
/// computer has already happened.
pub async fn logout(token: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(LOGOUT_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Logout client failed: {}", e))?;
    let _ = client
        .post(format!("{}/auth/logout", BASE_URL))
        .bearer_auth(token)
        .send()
        .await;
    Ok(())
}

/// Longest reply read from POST /auth/refresh; a token reply is well under a kilobyte.
const MAX_REFRESH_REPLY: usize = 64 * 1024;
/// A renewal on start must not hold the splash screen for long.
const REFRESH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(15);

#[derive(serde::Deserialize)]
struct RefreshResponse {
    #[serde(default)]
    success: Option<bool>,
    #[serde(default)]
    token: Option<String>,
}

/// Swaps a still-valid token for a new one (POST /auth/refresh, Bearer). Error texts
/// never carry the token or the reply body.
pub async fn refresh_token(token: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(REFRESH_TIMEOUT)
        .build()
        .map_err(|e| format!("Refresh client failed: {}", e))?;
    refresh_token_with(&client, BASE_URL, token).await
}

async fn refresh_token_with(
    client: &reqwest::Client,
    base_url: &str,
    token: &str,
) -> Result<String, String> {
    let res = client
        .post(format!("{}/auth/refresh", base_url))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        return Err(format!("Refresh refused (HTTP {})", status.as_u16()));
    }
    if res
        .content_length()
        .is_some_and(|len| len > MAX_REFRESH_REPLY as u64)
    {
        return Err("Refresh reply too large".into());
    }
    let body = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read refresh response: {}", e))?;
    if body.len() > MAX_REFRESH_REPLY {
        return Err("Refresh reply too large".into());
    }

    // serde_json's message can quote a value from the reply, so only its kind and
    // place go into the error.
    let data = serde_json::from_slice::<RefreshResponse>(&body).map_err(|e| {
        format!(
            "Refresh parse error: {:?} at line {} column {} (response of {} bytes)",
            e.classify(),
            e.line(),
            e.column(),
            body.len()
        )
    })?;
    if data.success == Some(false) {
        return Err("Refresh refused by the server".into());
    }
    data.token
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "Refresh reply held no token".to_string())
}

/// A check of who is signed in must not keep the window waiting long.
const ME_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);
/// Longest reply read from GET /auth/me; an account reply is well under a kilobyte.
const MAX_ME_REPLY: usize = 64 * 1024;

/// Who a token belongs to (GET /auth/me, Bearer). The site answers 401 for a token
/// it does not take: run out, signed out, from before a password change, or of an
/// account that was switched off. No redirect is followed, so the token goes to the
/// site only. Reasons never carry the token or the reply body.
pub async fn me(token: &str) -> Me {
    match reqwest::Client::builder()
        .timeout(ME_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
    {
        Ok(client) => me_with(&client, BASE_URL, token).await,
        Err(e) => Me::Unreachable(format!("Auth check client failed: {}", e)),
    }
}

async fn me_with(client: &reqwest::Client, base_url: &str, token: &str) -> Me {
    let res = match client
        .get(format!("{}/auth/me", base_url))
        .bearer_auth(token)
        .send()
        .await
    {
        Ok(res) => res,
        Err(e) => return Me::Unreachable(format!("Auth check failed: {}", e)),
    };
    match res.status().as_u16() {
        200 => {}
        401 | 403 => return Me::Refused,
        status => return Me::Unreachable(format!("Auth check answered HTTP {}", status)),
    }
    if res
        .content_length()
        .is_some_and(|len| len > MAX_ME_REPLY as u64)
    {
        return Me::Unreachable("Auth check reply too large".into());
    }
    let body = match res.bytes().await {
        Ok(body) if body.len() <= MAX_ME_REPLY => body,
        Ok(_) => return Me::Unreachable("Auth check reply too large".into()),
        Err(e) => return Me::Unreachable(format!("Failed to read auth check: {}", e)),
    };
    match serde_json::from_slice::<User>(&body) {
        Ok(user) => Me::Account(user),
        Err(e) => Me::Unreachable(format!(
            "Auth check parse error: {:?} at line {} column {} (response of {} bytes)",
            e.classify(),
            e.line(),
            e.column(),
            body.len()
        )),
    }
}

pub async fn get_auth_status(token: &str) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/auth/me", BASE_URL))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res.status().is_success())
}

pub async fn get_downloads(token: &str) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{}/downloads", BASE_URL))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Downloads request failed: {}", e))?;

    let body = res
        .text()
        .await
        .map_err(|e| format!("Failed to read downloads response: {}", e))?;

    let data = serde_json::from_str::<DownloadsResponse>(&body).map_err(|e| {
        format!(
            "Downloads parse error: {} (response of {} bytes)",
            e,
            body.len()
        )
    })?;

    if !data.success {
        return Err(data.error.unwrap_or("Failed to load downloads".into()));
    }

    Ok(data.products)
}

#[cfg(test)]
mod refresh_tests {
    use super::refresh_token_with;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// Serves one HTTP request on localhost with a fixed reply and hands back the
    /// request it got.
    pub(super) async fn mock_server(
        status: &'static str,
        body: &'static str,
    ) -> (String, tokio::task::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base_url = format!("http://{}/api", listener.local_addr().unwrap());
        let served = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut chunk = [0u8; 1024];
            while !request.windows(4).any(|w| w == b"\r\n\r\n") {
                let n = socket.read(&mut chunk).await.unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&chunk[..n]);
            }
            let reply = format!(
                "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            socket.write_all(reply.as_bytes()).await.unwrap();
            String::from_utf8_lossy(&request).into_owned()
        });
        (base_url, served)
    }

    pub(super) fn client() -> reqwest::Client {
        reqwest::Client::builder().no_proxy().build().unwrap()
    }

    #[tokio::test]
    async fn posts_the_token_as_bearer_and_returns_the_new_one() {
        let (base_url, served) =
            mock_server("200 OK", r#"{"success":true,"token":"new.token.value"}"#).await;

        let renewed = refresh_token_with(&client(), &base_url, "old.token.value").await;

        assert_eq!(renewed, Ok("new.token.value".to_string()));
        let request = served.await.unwrap();
        assert!(request.starts_with("POST /api/auth/refresh HTTP/1.1\r\n"));
        assert!(request
            .to_ascii_lowercase()
            .contains("\r\nauthorization: bearer old.token.value\r\n"));
    }

    #[tokio::test]
    async fn a_reply_with_only_a_token_is_enough() {
        let (base_url, _served) = mock_server("200 OK", r#"{"token":"new.token.value"}"#).await;
        let renewed = refresh_token_with(&client(), &base_url, "old").await;
        assert_eq!(renewed, Ok("new.token.value".to_string()));
    }

    #[tokio::test]
    async fn a_refusal_is_an_error_without_the_token_or_the_body() {
        for (status, body) in [
            (
                "401 Unauthorized",
                r#"{"success":false,"error":"secret.detail"}"#,
            ),
            ("200 OK", r#"{"success":false,"error":"secret.detail"}"#),
            ("200 OK", r#"{"success":true}"#),
            ("200 OK", r#"{"success":true,"token":""}"#),
            ("200 OK", r#"{"success":"secret.detail"}"#),
            ("200 OK", "<html>secret.detail</html>"),
            ("404 Not Found", ""),
        ] {
            let (base_url, _served) = mock_server(status, body).await;
            let err = refresh_token_with(&client(), &base_url, "old.token.value")
                .await
                .unwrap_err();
            assert!(!err.contains("old.token.value"), "{err}");
            assert!(!err.contains("secret.detail"), "{err}");
        }
    }
}

#[cfg(test)]
mod me_tests {
    use super::me_with;
    use super::refresh_tests::{client, mock_server};
    use crate::session::Me;

    #[tokio::test]
    async fn sends_the_token_as_bearer_and_reads_the_account() {
        let (base_url, served) = mock_server(
            "200 OK",
            r#"{"id":8,"email":"a@b.c","displayName":"Dish","avatarUrl":null,"isAdmin":false,"role":"user"}"#,
        )
        .await;

        let me = me_with(&client(), &base_url, "the.token.value").await;

        let user = match me {
            Me::Account(user) => user,
            other => panic!("{other:?}"),
        };
        assert_eq!(user.id, 8);
        assert_eq!(user.display_name.as_deref(), Some("Dish"));
        let request = served.await.unwrap();
        assert!(request.starts_with("GET /api/auth/me HTTP/1.1\r\n"));
        assert!(request
            .to_ascii_lowercase()
            .contains("\r\nauthorization: bearer the.token.value\r\n"));
    }

    #[tokio::test]
    async fn a_refused_token_is_told_apart_from_a_site_that_cannot_answer() {
        for status in ["401 Unauthorized", "403 Forbidden"] {
            let (base_url, _served) = mock_server(status, r#"{"error":"Unauthorized"}"#).await;
            assert_eq!(
                me_with(&client(), &base_url, "the.token.value").await,
                Me::Refused
            );
        }
        for (status, body) in [
            ("500 Internal Server Error", r#"{"error":"secret.detail"}"#),
            ("502 Bad Gateway", "<html>secret.detail</html>"),
            ("200 OK", "<html>secret.detail</html>"),
            ("200 OK", r#"{"email":"secret.detail"}"#),
        ] {
            let (base_url, _served) = mock_server(status, body).await;
            match me_with(&client(), &base_url, "the.token.value").await {
                Me::Unreachable(why) => {
                    assert!(!why.contains("the.token.value"), "{why}");
                    assert!(!why.contains("secret.detail"), "{why}");
                }
                other => panic!("{status}: {other:?}"),
            }
        }
    }
}
