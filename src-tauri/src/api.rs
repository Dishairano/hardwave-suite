use crate::models::{AuthResponse, DownloadsResponse, Product};

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

pub async fn logout(token: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
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
    async fn mock_server(
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

    fn client() -> reqwest::Client {
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
