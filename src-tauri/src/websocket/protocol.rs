//! Binary protocol for audio data - mirrors the VST plugin protocol

use serde::{Deserialize, Serialize};
use serde_big_array::BigArray;

/// Number of frequency bands
pub const NUM_BANDS: usize = 64;

/// Packet type identifiers
pub const PACKET_TYPE_FFT: u8 = 0;
pub const PACKET_TYPE_HEARTBEAT: u8 = 1;

/// Audio packet received from VST plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioPacket {
    /// Packet type (0=FFT, 1=Heartbeat)
    pub packet_type: u8,

    /// Sample rate of the audio context
    pub sample_rate: u32,

    /// Timestamp in milliseconds since plugin start
    pub timestamp_ms: u64,

    /// Left channel FFT bands in dB (-100 to 0)
    #[serde(with = "BigArray")]
    pub left_bands: [f32; NUM_BANDS],

    /// Right channel FFT bands in dB (-100 to 0)
    #[serde(with = "BigArray")]
    pub right_bands: [f32; NUM_BANDS],

    /// Left channel peak level in dB
    pub left_peak: f32,

    /// Right channel peak level in dB
    pub right_peak: f32,

    /// Left channel RMS level (linear, 0-1)
    pub left_rms: f32,

    /// Right channel RMS level (linear, 0-1)
    pub right_rms: f32,
}

impl AudioPacket {
    /// Deserialize from binary data
    pub fn from_bytes(data: &[u8]) -> Result<Self, bincode::Error> {
        bincode::deserialize(data)
    }

    /// Check if this is an FFT packet
    pub fn is_fft(&self) -> bool {
        self.packet_type == PACKET_TYPE_FFT
    }

    /// Check if this is a heartbeat packet
    pub fn is_heartbeat(&self) -> bool {
        self.packet_type == PACKET_TYPE_HEARTBEAT
    }
}

/// Serializable version for frontend
#[derive(Debug, Clone, Serialize)]
pub struct VstAudioData {
    pub connected: bool,
    pub sample_rate: u32,
    pub timestamp_ms: u64,
    pub left_bands: Vec<f32>,
    pub right_bands: Vec<f32>,
    pub left_peak: f32,
    pub right_peak: f32,
    pub left_rms: f32,
    pub right_rms: f32,
}

impl From<&AudioPacket> for VstAudioData {
    fn from(packet: &AudioPacket) -> Self {
        Self {
            connected: true,
            sample_rate: packet.sample_rate,
            timestamp_ms: packet.timestamp_ms,
            left_bands: packet.left_bands.to_vec(),
            right_bands: packet.right_bands.to_vec(),
            left_peak: packet.left_peak,
            right_peak: packet.right_peak,
            left_rms: packet.left_rms,
            right_rms: packet.right_rms,
        }
    }
}

impl Default for VstAudioData {
    fn default() -> Self {
        Self {
            connected: false,
            sample_rate: 0,
            timestamp_ms: 0,
            left_bands: vec![-100.0; NUM_BANDS],
            right_bands: vec![-100.0; NUM_BANDS],
            left_peak: -100.0,
            right_peak: -100.0,
            left_rms: 0.0,
            right_rms: 0.0,
        }
    }
}
