//! WebSocket server for receiving audio data from VST plugin

use futures_util::{SinkExt, StreamExt};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Notify;
use tokio_tungstenite::{accept_async, tungstenite::Message};

use super::audio_state::AudioState;
use super::protocol::AudioPacket;

/// WebSocket server for VST bridge
pub struct WebSocketServer {
    /// Shared audio state
    audio_state: Arc<AudioState>,

    /// Running flag
    running: Arc<AtomicBool>,

    /// Shutdown notifier
    shutdown_notify: Arc<Notify>,
}

impl WebSocketServer {
    /// Create new server with shared audio state
    pub fn new(audio_state: Arc<AudioState>) -> Self {
        Self {
            audio_state,
            running: Arc::new(AtomicBool::new(false)),
            shutdown_notify: Arc::new(Notify::new()),
        }
    }

    /// Check if server is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Start the server on the specified port
    pub async fn start(&self, port: u16) -> Result<(), String> {
        if self.running.load(Ordering::SeqCst) {
            return Err("Server already running".to_string());
        }

        let addr = format!("127.0.0.1:{}", port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

        self.running.store(true, Ordering::SeqCst);
        log::info!("WebSocket server listening on {}", addr);

        let audio_state = Arc::clone(&self.audio_state);
        let running = Arc::clone(&self.running);
        let shutdown_notify = Arc::clone(&self.shutdown_notify);

        // Spawn server task
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Wait for new connection
                    result = listener.accept() => {
                        match result {
                            Ok((stream, addr)) => {
                                log::info!("VST client connected from {}", addr);
                                let state = Arc::clone(&audio_state);
                                tokio::spawn(handle_connection(stream, state));
                            }
                            Err(e) => {
                                log::error!("Accept error: {}", e);
                            }
                        }
                    }
                    // Wait for shutdown signal
                    _ = shutdown_notify.notified() => {
                        log::info!("WebSocket server shutting down");
                        break;
                    }
                }

                // Check if we should stop
                if !running.load(Ordering::SeqCst) {
                    break;
                }
            }

            running.store(false, Ordering::SeqCst);
        });

        Ok(())
    }

    /// Stop the server
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        self.shutdown_notify.notify_one();
        self.audio_state.set_connected(false);
    }
}

/// Handle a single WebSocket connection
async fn handle_connection(stream: TcpStream, audio_state: Arc<AudioState>) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            log::error!("WebSocket handshake failed: {}", e);
            return;
        }
    };

    audio_state.set_connected(true);
    let (mut _write, mut read) = ws_stream.split();

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Binary(data)) => {
                // Parse audio packet
                match AudioPacket::from_bytes(&data) {
                    Ok(packet) => {
                        if packet.is_fft() {
                            audio_state.update(packet);
                        }
                        // Heartbeat packets just keep connection alive
                    }
                    Err(e) => {
                        log::warn!("Failed to parse packet: {}", e);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                log::info!("VST client disconnected");
                break;
            }
            Ok(Message::Ping(data)) => {
                // Respond with pong (tungstenite handles this automatically)
            }
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    audio_state.set_connected(false);
    log::info!("VST connection closed");
}

impl Drop for WebSocketServer {
    fn drop(&mut self) {
        self.stop();
    }
}
