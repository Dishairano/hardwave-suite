use serde::Deserialize;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::sync::Mutex;

use crate::collabs::CollabState;

const BRIDGE_PORT: u16 = 9900;

/// State received from the FL Studio MIDI Script.
#[derive(Debug, Clone, Deserialize)]
struct FlStatePost {
    state: serde_json::Value,
    ops: Vec<serde_json::Value>,
    active_window: Option<String>,
}

/// Bridge state: holds the last FL state, pending remote commands, and relay sender.
pub struct BridgeState {
    last_state: Mutex<Option<serde_json::Value>>,
    pending_commands: Mutex<Vec<serde_json::Value>>,
    bridge_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl BridgeState {
    pub fn new() -> Self {
        Self {
            last_state: Mutex::new(None),
            pending_commands: Mutex::new(Vec::new()),
            bridge_task: Mutex::new(None),
        }
    }

    /// Queue a remote command for the FL Script to pick up.
    pub async fn queue_command(&self, cmd: serde_json::Value) {
        self.pending_commands.lock().await.push(cmd);
    }

    /// Drain all pending commands (FL Script polls this).
    pub async fn drain_commands(&self) -> Vec<serde_json::Value> {
        let mut cmds = self.pending_commands.lock().await;
        std::mem::take(&mut *cmds)
    }
}

/// Start the local HTTP bridge server on port 9900.
/// FL Studio MIDI Script posts state here; polls for remote commands.
pub async fn start_bridge(
    bridge: Arc<BridgeState>,
    collab: Arc<CollabState>,
) -> Result<(), String> {
    // Stop existing bridge
    if let Some(task) = bridge.bridge_task.lock().await.take() {
        task.abort();
    }

    let bridge_clone = bridge.clone();
    let collab_clone = collab.clone();

    let task = tokio::spawn(async move {
        let listener = match TcpListener::bind(format!("127.0.0.1:{BRIDGE_PORT}")).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Bridge: failed to bind port {BRIDGE_PORT}: {e}");
                return;
            }
        };

        println!("Bridge: listening on 127.0.0.1:{BRIDGE_PORT}");

        loop {
            let (mut stream, _) = match listener.accept().await {
                Ok(s) => s,
                Err(_) => continue,
            };

            let bridge = bridge_clone.clone();
            let collab = collab_clone.clone();

            tokio::spawn(async move {
                let mut buf = vec![0u8; 65536];
                let n = match stream.read(&mut buf).await {
                    Ok(n) if n > 0 => n,
                    _ => return,
                };

                let request = String::from_utf8_lossy(&buf[..n]);

                // Parse the HTTP method and path from the first line
                let first_line = request.lines().next().unwrap_or("");
                let parts: Vec<&str> = first_line.split_whitespace().collect();
                if parts.len() < 2 {
                    let _ = send_response(&mut stream, 400, "Bad Request").await;
                    return;
                }

                let method = parts[0];
                let path = parts[1];

                match (method, path) {
                    ("POST", "/fl-state") => {
                        // Find the body after the empty line
                        let body = if let Some(idx) = request.find("\r\n\r\n") {
                            &request[idx + 4..]
                        } else if let Some(idx) = request.find("\n\n") {
                            &request[idx + 2..]
                        } else {
                            ""
                        };

                        if let Ok(post) = serde_json::from_str::<FlStatePost>(body) {
                            // Store the latest state
                            *bridge.last_state.lock().await = Some(post.state.clone());

                            // Forward ops to relay as state_delta if we have any
                            if !post.ops.is_empty() && collab.is_connected().await {
                                let msg = serde_json::json!({
                                    "type": "state_delta",
                                    "domain": "fl_studio",
                                    "ops": post.ops,
                                });
                                // Use the collab send channel directly
                                if let Some(tx) = &*collab.tx_ref().await {
                                    let _ = tx.send(msg.to_string());
                                }
                            }

                            // Forward presence
                            if let Some(window) = &post.active_window {
                                if collab.is_connected().await {
                                    let msg = serde_json::json!({
                                        "type": "presence",
                                        "active_window": window,
                                        "cursor": null,
                                    });
                                    if let Some(tx) = &*collab.tx_ref().await {
                                        let _ = tx.send(msg.to_string());
                                    }
                                }
                            }

                            let _ = send_response(&mut stream, 200, r#"{"ok":true}"#).await;
                        } else {
                            let _ = send_response(&mut stream, 400, r#"{"error":"invalid json"}"#).await;
                        }
                    }

                    ("GET", "/fl-commands") => {
                        let commands = bridge.drain_commands().await;
                        let body = serde_json::json!({ "commands": commands }).to_string();
                        let _ = send_response(&mut stream, 200, &body).await;
                    }

                    ("GET", "/health") => {
                        let connected = collab.is_connected().await;
                        let body = serde_json::json!({
                            "bridge": "ok",
                            "relay_connected": connected,
                        }).to_string();
                        let _ = send_response(&mut stream, 200, &body).await;
                    }

                    _ => {
                        let _ = send_response(&mut stream, 404, r#"{"error":"not found"}"#).await;
                    }
                }
            });
        }
    });

    *bridge.bridge_task.lock().await = Some(task);
    Ok(())
}

async fn send_response(
    stream: &mut tokio::net::TcpStream,
    status: u16,
    body: &str,
) -> Result<(), std::io::Error> {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Error",
    };
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{}",
        status, status_text, body.len(), body
    );
    stream.write_all(response.as_bytes()).await?;
    stream.flush().await
}
