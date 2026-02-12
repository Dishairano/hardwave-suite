//! WebSocket server module for receiving audio data from VST plugin

pub mod audio_state;
pub mod protocol;
pub mod server;

pub use audio_state::AudioState;
pub use protocol::AudioPacket;
pub use server::WebSocketServer;
