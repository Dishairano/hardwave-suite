//! Thread-safe storage for audio state from VST plugin

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::protocol::{AudioPacket, VstAudioData, NUM_BANDS};

/// Thread-safe audio state storage
pub struct AudioState {
    /// Latest audio packet
    latest_packet: Mutex<Option<AudioPacket>>,

    /// Connection status
    connected: AtomicBool,

    /// Last packet timestamp (for connection timeout)
    last_packet_time: Mutex<Option<Instant>>,

    /// Connection count (for tracking reconnects)
    connection_count: AtomicU64,
}

impl AudioState {
    /// Create new audio state
    pub fn new() -> Self {
        Self {
            latest_packet: Mutex::new(None),
            connected: AtomicBool::new(false),
            last_packet_time: Mutex::new(None),
            connection_count: AtomicU64::new(0),
        }
    }

    /// Update with new packet data
    pub fn update(&self, packet: AudioPacket) {
        if let Ok(mut latest) = self.latest_packet.lock() {
            *latest = Some(packet);
        }
        if let Ok(mut time) = self.last_packet_time.lock() {
            *time = Some(Instant::now());
        }
    }

    /// Set connection status
    pub fn set_connected(&self, connected: bool) {
        let was_connected = self.connected.swap(connected, Ordering::SeqCst);
        if connected && !was_connected {
            self.connection_count.fetch_add(1, Ordering::SeqCst);
        }
        if !connected {
            // Clear packet data on disconnect
            if let Ok(mut latest) = self.latest_packet.lock() {
                *latest = None;
            }
        }
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        // Also check for timeout (no packets for 3 seconds = disconnected)
        if let Ok(time) = self.last_packet_time.lock() {
            if let Some(last_time) = *time {
                if last_time.elapsed() > Duration::from_secs(3) {
                    self.connected.store(false, Ordering::SeqCst);
                    return false;
                }
            }
        }
        self.connected.load(Ordering::SeqCst)
    }

    /// Get connection count
    pub fn connection_count(&self) -> u64 {
        self.connection_count.load(Ordering::SeqCst)
    }

    /// Get latest audio data for frontend
    pub fn get_audio_data(&self) -> VstAudioData {
        if !self.is_connected() {
            return VstAudioData::default();
        }

        if let Ok(latest) = self.latest_packet.lock() {
            if let Some(ref packet) = *latest {
                return VstAudioData::from(packet);
            }
        }

        VstAudioData::default()
    }

    /// Clear all state
    pub fn clear(&self) {
        if let Ok(mut latest) = self.latest_packet.lock() {
            *latest = None;
        }
        if let Ok(mut time) = self.last_packet_time.lock() {
            *time = None;
        }
        self.connected.store(false, Ordering::SeqCst);
    }
}

impl Default for AudioState {
    fn default() -> Self {
        Self::new()
    }
}

// Safety: AudioState uses proper synchronization
unsafe impl Send for AudioState {}
unsafe impl Sync for AudioState {}
