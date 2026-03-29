use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::Message;

use crate::bridge::BridgeState;

/// Relay server URL
const RELAY_URL: &str = "wss://collab.hardwavestudios.com/ws";
/// Fallback for development
const RELAY_URL_DEV: &str = "ws://127.0.0.1:9910/ws";

/// Message types matching the relay server protocol
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ClientMsg {
    CreateRoom,
    JoinRoom { code: String },
    LeaveRoom,
    Chat { text: String },
    Presence { active_window: String, cursor: serde_json::Value },
}

/// Events received from relay, forwarded to React via Tauri events
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CollabEvent {
    RoomCreated { code: String },
    RoomJoined { code: String, participants: Vec<serde_json::Value> },
    ParticipantJoined { user: serde_json::Value },
    ParticipantLeft { user_id: String },
    Chat { from: String, from_name: String, text: String, timestamp: u64 },
    StateDelta { from: String, domain: String, ops: Vec<serde_json::Value> },
    Presence { from: String, active_window: String, cursor: serde_json::Value },
    Connected,
    Disconnected { reason: String },
    Error { message: String },
}

pub struct CollabState {
    /// Channel to send messages to the WebSocket write task
    tx: Mutex<Option<mpsc::UnboundedSender<String>>>,
    /// Handle to the background connection task
    task: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl CollabState {
    pub fn new() -> Self {
        Self {
            tx: Mutex::new(None),
            task: Mutex::new(None),
        }
    }

    /// Check if we're connected to the relay server.
    pub async fn is_connected(&self) -> bool {
        self.tx.lock().await.is_some()
    }

    /// Get a reference to the send channel (for the bridge to forward FL state).
    pub async fn tx_ref(&self) -> tokio::sync::MutexGuard<'_, Option<mpsc::UnboundedSender<String>>> {
        self.tx.lock().await
    }
}

/// Connect to the relay server and start the read/write loops.
/// Events are emitted to the Tauri app as `collab:event`.
pub async fn connect(
    token: &str,
    app: tauri::AppHandle,
    state: Arc<CollabState>,
    bridge: Option<Arc<BridgeState>>,
) -> Result<(), String> {
    // Disconnect existing connection first
    disconnect(state.clone()).await;

    let url = if std::env::var("HARDWAVE_DEV").is_ok() {
        format!("{}?token={}", RELAY_URL_DEV, token)
    } else {
        format!("{}?token={}", RELAY_URL, token)
    };

    let (ws_stream, _) = tokio_tungstenite::connect_async(&url)
        .await
        .map_err(|e| format!("WebSocket connect failed: {e}"))?;

    let (mut write, mut read) = ws_stream.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Store the send channel
    *state.tx.lock().await = Some(tx);

    // Emit connected event
    let _ = app.emit("collab:event", CollabEvent::Connected);

    let app_read = app.clone();
    let state_read = state.clone();

    // Spawn the connection task
    let task = tokio::spawn(async move {
        // Write loop: forward outgoing messages to WebSocket
        let write_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if write.send(Message::Text(msg.into())).await.is_err() {
                    break;
                }
            }
        });

        // Read loop: forward incoming WebSocket messages to Tauri events
        // and route state_delta ops to the bridge for FL Script
        while let Some(msg_result) = read.next().await {
            match msg_result {
                Ok(Message::Text(text)) => {
                    let text_str = text.to_string();
                    if let Ok(event) = serde_json::from_str::<CollabEvent>(&text_str) {
                        // Route state_delta ops to bridge as FL commands
                        if let CollabEvent::StateDelta { ref ops, .. } = event {
                            if let Some(ref b) = bridge {
                                for op in ops {
                                    b.queue_command(op.clone()).await;
                                }
                            }
                        }
                        let _ = app_read.emit("collab:event", event);
                    }
                }
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }

        // Connection closed
        let _ = app_read.emit(
            "collab:event",
            CollabEvent::Disconnected {
                reason: "Connection closed".into(),
            },
        );
        *state_read.tx.lock().await = None;
        write_task.abort();
    });

    *state.task.lock().await = Some(task);
    Ok(())
}

/// Send a JSON message to the relay server.
async fn send(state: &CollabState, msg: &ClientMsg) -> Result<(), String> {
    let tx = state.tx.lock().await;
    let tx = tx.as_ref().ok_or("Not connected")?;
    let json = serde_json::to_string(msg).map_err(|e| e.to_string())?;
    tx.send(json).map_err(|e| format!("Send failed: {e}"))
}

/// Disconnect from the relay server.
pub async fn disconnect(state: Arc<CollabState>) {
    // Send leave message before disconnecting
    if let Some(tx) = state.tx.lock().await.take() {
        let _ = tx.send(serde_json::to_string(&ClientMsg::LeaveRoom).unwrap());
        // Small delay to let the message go through
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    if let Some(task) = state.task.lock().await.take() {
        task.abort();
    }
}

/// Create a room on the relay server.
pub async fn create_room(state: &CollabState) -> Result<(), String> {
    send(state, &ClientMsg::CreateRoom).await
}

/// Join a room by code.
pub async fn join_room(state: &CollabState, code: &str) -> Result<(), String> {
    send(state, &ClientMsg::JoinRoom { code: code.to_uppercase() }).await
}

/// Leave the current room.
pub async fn leave_room(state: &CollabState) -> Result<(), String> {
    send(state, &ClientMsg::LeaveRoom).await
}

/// Send a chat message.
pub async fn send_chat(state: &CollabState, text: &str) -> Result<(), String> {
    send(state, &ClientMsg::Chat { text: text.to_string() }).await
}

/// Send presence update.
pub async fn send_presence(state: &CollabState, active_window: &str) -> Result<(), String> {
    send(
        state,
        &ClientMsg::Presence {
            active_window: active_window.to_string(),
            cursor: serde_json::Value::Null,
        },
    )
    .await
}
