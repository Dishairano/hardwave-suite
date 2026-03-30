//! AutoMix — AI-assisted stem mixing engine.
//!
//! Accepts WAV/FLAC stems, analyzes each (instrument detection, spectral profile,
//! dynamics, stereo info), then applies genre-aware mixing rules: level balancing,
//! EQ, compression, stereo placement. Emits progress events to the webview.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

// ─── Types ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StemType {
    Kick,
    Snare,
    HiHat,
    Percussion,
    Bass,
    Lead,
    Pad,
    Vocal,
    FX,
    Sub,
    Unknown,
}

impl StemType {
    fn from_name(name: &str) -> Self {
        let n = name.to_lowercase();
        if n.contains("kick") { return Self::Kick; }
        if n.contains("snare") || n.contains("clap") { return Self::Snare; }
        if n.contains("hihat") || n.contains("hi-hat") || n.contains("hat") { return Self::HiHat; }
        if n.contains("perc") || n.contains("ride") || n.contains("crash") || n.contains("cymbal") { return Self::Percussion; }
        if n.contains("bass") && !n.contains("sub") { return Self::Bass; }
        if n.contains("sub") { return Self::Sub; }
        if n.contains("lead") || n.contains("synth") { return Self::Lead; }
        if n.contains("pad") || n.contains("atmo") || n.contains("ambient") { return Self::Pad; }
        if n.contains("vocal") || n.contains("vox") || n.contains("voice") { return Self::Vocal; }
        if n.contains("fx") || n.contains("riser") || n.contains("impact") || n.contains("sweep") { return Self::FX; }
        Self::Unknown
    }

    /// Detect from spectral analysis when filename doesn't help.
    fn from_spectral(centroid_hz: f32, peak_hz: f32, crest_db: f32) -> Self {
        if peak_hz < 80.0 && centroid_hz < 200.0 {
            if crest_db > 12.0 { return Self::Kick; }
            return Self::Sub;
        }
        if peak_hz < 250.0 && centroid_hz < 500.0 { return Self::Bass; }
        if crest_db > 15.0 && centroid_hz > 1000.0 && centroid_hz < 6000.0 { return Self::Snare; }
        if centroid_hz > 6000.0 { return Self::HiHat; }
        if centroid_hz > 2000.0 && centroid_hz < 6000.0 { return Self::Lead; }
        if crest_db < 6.0 && centroid_hz < 3000.0 { return Self::Pad; }
        Self::Unknown
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum MixGenre {
    Hardstyle,
    Rawstyle,
    Hardcore,
    Frenchcore,
    EDM,
    HipHop,
    Pop,
}

/// Per-stem analysis results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemAnalysis {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub stem_type: StemType,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_secs: f32,
    pub peak_db: f32,
    pub rms_db: f32,
    pub lufs: f32,
    pub crest_factor_db: f32,
    pub spectral_centroid_hz: f32,
    pub peak_freq_hz: f32,
    /// 32-band spectral profile (each band's average energy in dB).
    pub spectral_profile: Vec<f32>,
    /// Stereo width (0.0 = mono, 1.0 = normal, >1.0 = wide).
    pub stereo_width: f32,
    /// Correlation (-1 to 1, 1 = perfect mono compatibility).
    pub stereo_correlation: f32,
}

/// Mix settings applied per stem.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemMixSettings {
    pub id: String,
    pub gain_db: f32,
    pub pan: f32,          // -1.0 (L) to 1.0 (R)
    pub eq_low_db: f32,    // shelf at 80 Hz
    pub eq_mid_db: f32,    // bell at 2.5 kHz
    pub eq_high_db: f32,   // shelf at 8 kHz
    pub comp_threshold_db: f32,
    pub comp_ratio: f32,
    pub width: f32,        // 0.0 = mono, 1.0 = normal, 2.0 = wide
    pub mute: bool,
    pub solo: bool,
}

/// Full session state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoMixSession {
    pub stems: Vec<StemAnalysis>,
    pub mix_settings: Vec<StemMixSettings>,
    pub genre: MixGenre,
    pub master_gain_db: f32,
    pub target_lufs: f32,
}

/// Progress events sent to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoMixProgress {
    pub stage: String,
    pub current: usize,
    pub total: usize,
    pub message: String,
}

// ─── State ─────────────────────────────────────────────────────────────────

pub struct AutoMixState {
    pub session: Mutex<Option<AutoMixSession>>,
}

impl AutoMixState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
        }
    }
}

// ─── WAV reader (minimal, supports 16/24/32-bit PCM and 32-bit float) ────

struct WavData {
    sample_rate: u32,
    channels: u16,
    samples: Vec<Vec<f32>>, // per channel
}

fn read_wav(path: &Path) -> Result<WavData, String> {
    use std::io::{Read, Seek, SeekFrom};
    let mut f = std::fs::File::open(path).map_err(|e| format!("Cannot open {}: {}", path.display(), e))?;
    let mut header = [0u8; 12];
    f.read_exact(&mut header).map_err(|e| e.to_string())?;
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Err("Not a valid WAV file".into());
    }

    let mut sample_rate = 0u32;
    let mut channels = 0u16;
    let mut bits_per_sample = 0u16;
    let mut audio_format = 1u16; // PCM
    let mut data_samples: Vec<Vec<f32>> = Vec::new();

    loop {
        let mut chunk_hdr = [0u8; 8];
        if f.read_exact(&mut chunk_hdr).is_err() { break; }
        let chunk_id = [chunk_hdr[0], chunk_hdr[1], chunk_hdr[2], chunk_hdr[3]];
        let chunk_size = u32::from_le_bytes([chunk_hdr[4], chunk_hdr[5], chunk_hdr[6], chunk_hdr[7]]) as usize;

        match &chunk_id {
            b"fmt " => {
                let mut fmt = vec![0u8; chunk_size];
                f.read_exact(&mut fmt).map_err(|e| e.to_string())?;
                audio_format = u16::from_le_bytes([fmt[0], fmt[1]]);
                channels = u16::from_le_bytes([fmt[2], fmt[3]]);
                sample_rate = u32::from_le_bytes([fmt[4], fmt[5], fmt[6], fmt[7]]);
                bits_per_sample = u16::from_le_bytes([fmt[14], fmt[15]]);
            }
            b"data" => {
                let mut raw = vec![0u8; chunk_size];
                f.read_exact(&mut raw).map_err(|e| e.to_string())?;
                let ch = channels.max(1) as usize;
                let bytes_per_sample = (bits_per_sample / 8) as usize;
                let frame_size = ch * bytes_per_sample;
                let num_frames = raw.len() / frame_size;
                data_samples = vec![Vec::with_capacity(num_frames); ch];

                for frame in 0..num_frames {
                    for c in 0..ch {
                        let offset = frame * frame_size + c * bytes_per_sample;
                        let sample = match (audio_format, bits_per_sample) {
                            (1, 16) => {
                                let v = i16::from_le_bytes([raw[offset], raw[offset + 1]]);
                                v as f32 / 32768.0
                            }
                            (1, 24) => {
                                let v = ((raw[offset] as i32) | ((raw[offset + 1] as i32) << 8) | ((raw[offset + 2] as i32) << 16)) << 8 >> 8;
                                v as f32 / 8388608.0
                            }
                            (1, 32) => {
                                let v = i32::from_le_bytes([raw[offset], raw[offset + 1], raw[offset + 2], raw[offset + 3]]);
                                v as f32 / 2147483648.0
                            }
                            (3, 32) => {
                                f32::from_le_bytes([raw[offset], raw[offset + 1], raw[offset + 2], raw[offset + 3]])
                            }
                            _ => 0.0,
                        };
                        data_samples[c].push(sample);
                    }
                }
            }
            _ => {
                // Skip unknown chunks
                f.seek(SeekFrom::Current(chunk_size as i64)).map_err(|e| e.to_string())?;
            }
        }
        // Chunks must be word-aligned
        if chunk_size % 2 != 0 {
            f.seek(SeekFrom::Current(1)).ok();
        }
    }

    if data_samples.is_empty() {
        return Err("No audio data found in WAV".into());
    }

    Ok(WavData { sample_rate, channels, samples: data_samples })
}

// ─── Analysis ──────────────────────────────────────────────────────────────

fn analyze_stem(path: &Path) -> Result<StemAnalysis, String> {
    let wav = read_wav(path)?;
    let n = wav.samples[0].len();
    if n == 0 { return Err("Empty audio file".into()); }

    let sr = wav.sample_rate as f32;
    let ch = wav.channels;

    // Mono-sum for spectral analysis
    let mono: Vec<f32> = if wav.samples.len() >= 2 {
        wav.samples[0].iter().zip(&wav.samples[1]).map(|(l, r)| (l + r) * 0.5).collect()
    } else {
        wav.samples[0].clone()
    };

    // Peak and RMS
    let mut peak = 0.0f32;
    let mut sum_sq = 0.0f64;
    for &s in &mono {
        peak = peak.max(s.abs());
        sum_sq += (s as f64) * (s as f64);
    }
    let rms = (sum_sq / n as f64).sqrt() as f32;
    let peak_db = if peak > 1e-10 { 20.0 * peak.log10() } else { -120.0 };
    let rms_db = if rms > 1e-10 { 20.0 * rms.log10() } else { -120.0 };
    let lufs = rms_db - 0.691; // Simplified LUFS (no K-weighting here)
    let crest = peak_db - rms_db;

    // Spectral analysis: 4096-point FFT using DFT (simple but correct)
    let fft_size = 4096usize;
    let num_bins = fft_size / 2;
    let mut spectrum = vec![0.0f64; num_bins];
    let num_frames = (mono.len() / fft_size).max(1);

    for frame_idx in 0..num_frames {
        let start = frame_idx * fft_size;
        if start + fft_size > mono.len() { break; }
        let window = &mono[start..start + fft_size];

        // Apply Hann window and compute magnitude via Goertzel-like DFT for key bins
        // For efficiency, just compute 32 bands
        let band_edges: Vec<f32> = (0..=32).map(|i| {
            20.0 * (20000.0 / 20.0_f32).powf(i as f32 / 32.0)
        }).collect();

        for band in 0..32 {
            let lo = band_edges[band];
            let hi = band_edges[band + 1];
            let bin_lo = ((lo / sr * fft_size as f32) as usize).max(1);
            let bin_hi = ((hi / sr * fft_size as f32) as usize).min(num_bins);
            if bin_lo >= bin_hi { continue; }

            let mut band_energy = 0.0f64;
            for bin in bin_lo..bin_hi {
                let freq = std::f64::consts::TAU * bin as f64 / fft_size as f64;
                let mut re = 0.0f64;
                let mut im = 0.0f64;
                for (k, &s) in window.iter().enumerate() {
                    // Hann window
                    let w = 0.5 * (1.0 - (std::f64::consts::TAU * k as f64 / fft_size as f64).cos());
                    let v = s as f64 * w;
                    re += v * (freq * k as f64).cos();
                    im -= v * (freq * k as f64).sin();
                }
                band_energy += re * re + im * im;
            }
            spectrum[band] += band_energy / (bin_hi - bin_lo) as f64;
        }
    }

    // Convert to dB
    let spectral_profile: Vec<f32> = spectrum.iter().take(32).map(|&e| {
        let avg = e / num_frames.max(1) as f64;
        if avg > 1e-20 { 10.0 * (avg as f32).log10() } else { -120.0 }
    }).collect();

    // Spectral centroid
    let total_energy: f32 = spectral_profile.iter().map(|&db| 10.0f32.powf(db / 10.0)).sum();
    let band_centers: Vec<f32> = (0..32).map(|i| {
        20.0 * (20000.0 / 20.0_f32).powf((i as f32 + 0.5) / 32.0)
    }).collect();
    let centroid = if total_energy > 1e-20 {
        spectral_profile.iter().zip(&band_centers).map(|(&db, &fc)| {
            10.0f32.powf(db / 10.0) * fc
        }).sum::<f32>() / total_energy
    } else {
        1000.0
    };

    // Peak frequency
    let peak_band = spectral_profile.iter().enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
        .map(|(i, _)| i).unwrap_or(0);
    let peak_freq = band_centers.get(peak_band).copied().unwrap_or(1000.0);

    // Stereo analysis
    let (width, correlation) = if wav.samples.len() >= 2 {
        let mut sum_ms = 0.0f64;
        let mut sum_ss = 0.0f64;
        let mut sum_lr = 0.0f64;
        let mut sum_ll = 0.0f64;
        let mut sum_rr = 0.0f64;
        for i in 0..n {
            let l = wav.samples[0][i] as f64;
            let r = wav.samples[1][i] as f64;
            let m = (l + r) * 0.5;
            let s = (l - r) * 0.5;
            sum_ms += m * m;
            sum_ss += s * s;
            sum_lr += l * r;
            sum_ll += l * l;
            sum_rr += r * r;
        }
        let w = if sum_ms > 1e-20 { (sum_ss / sum_ms).sqrt() as f32 } else { 0.0 };
        let denom = (sum_ll * sum_rr).sqrt();
        let corr = if denom > 1e-20 { (sum_lr / denom) as f32 } else { 1.0 };
        (w.min(2.0), corr)
    } else {
        (0.0, 1.0)
    };

    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let stem_type_name = StemType::from_name(&file_name);
    let stem_type = if stem_type_name == StemType::Unknown {
        StemType::from_spectral(centroid, peak_freq, crest)
    } else {
        stem_type_name
    };

    Ok(StemAnalysis {
        id: uuid_simple(),
        file_name,
        file_path: path.to_string_lossy().to_string(),
        stem_type,
        sample_rate: wav.sample_rate,
        channels: ch,
        duration_secs: n as f32 / sr,
        peak_db,
        rms_db,
        lufs,
        crest_factor_db: crest,
        spectral_centroid_hz: centroid,
        peak_freq_hz: peak_freq,
        spectral_profile,
        stereo_width: width,
        stereo_correlation: correlation,
    })
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:x}{:04x}", t.as_millis(), rand_u16())
}

fn rand_u16() -> u16 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    (t.subsec_nanos() & 0xFFFF) as u16
}

// ─── Mix engine (genre-aware rule application) ─────────────────────────────

struct GenreTargets {
    stem_lufs: HashMap<StemType, f32>,
    stem_pan: HashMap<StemType, f32>,
    stem_width: HashMap<StemType, f32>,
    stem_eq_low: HashMap<StemType, f32>,
    stem_eq_mid: HashMap<StemType, f32>,
    stem_eq_high: HashMap<StemType, f32>,
    stem_comp_thresh: HashMap<StemType, f32>,
    stem_comp_ratio: HashMap<StemType, f32>,
}

fn genre_targets(genre: MixGenre) -> GenreTargets {
    let mut t = GenreTargets {
        stem_lufs: HashMap::new(),
        stem_pan: HashMap::new(),
        stem_width: HashMap::new(),
        stem_eq_low: HashMap::new(),
        stem_eq_mid: HashMap::new(),
        stem_eq_high: HashMap::new(),
        stem_comp_thresh: HashMap::new(),
        stem_comp_ratio: HashMap::new(),
    };

    // Base target LUFS per stem type (relative to target_lufs)
    // Higher = louder in the mix
    let (kick_l, snare_l, hat_l, perc_l, bass_l, sub_l, lead_l, pad_l, vox_l, fx_l) = match genre {
        MixGenre::Hardstyle | MixGenre::Rawstyle => (0.0, -3.0, -8.0, -6.0, -2.0, -4.0, -4.0, -12.0, -5.0, -10.0),
        MixGenre::Hardcore | MixGenre::Frenchcore => (0.0, -2.0, -7.0, -5.0, -1.0, -3.0, -3.0, -14.0, -4.0, -8.0),
        MixGenre::EDM => (-1.0, -4.0, -8.0, -7.0, -2.0, -3.0, -3.0, -10.0, -3.0, -9.0),
        MixGenre::HipHop => (-1.0, -3.0, -9.0, -7.0, -1.0, -2.0, -5.0, -12.0, 0.0, -10.0),
        MixGenre::Pop => (-2.0, -4.0, -9.0, -8.0, -3.0, -4.0, -4.0, -10.0, 0.0, -9.0),
    };

    let types_and_lufs = [
        (StemType::Kick, kick_l), (StemType::Snare, snare_l), (StemType::HiHat, hat_l),
        (StemType::Percussion, perc_l), (StemType::Bass, bass_l), (StemType::Sub, sub_l),
        (StemType::Lead, lead_l), (StemType::Pad, pad_l), (StemType::Vocal, vox_l),
        (StemType::FX, fx_l), (StemType::Unknown, -6.0),
    ];
    for (st, l) in types_and_lufs { t.stem_lufs.insert(st, l); }

    // Pan positions (0.0 = center)
    let pans = [
        (StemType::Kick, 0.0), (StemType::Snare, 0.0), (StemType::HiHat, 0.3),
        (StemType::Percussion, -0.25), (StemType::Bass, 0.0), (StemType::Sub, 0.0),
        (StemType::Lead, 0.0), (StemType::Pad, 0.0), (StemType::Vocal, 0.0),
        (StemType::FX, 0.4), (StemType::Unknown, 0.0),
    ];
    for (st, p) in pans { t.stem_pan.insert(st, p); }

    // Stereo width targets
    let widths = [
        (StemType::Kick, 0.0), (StemType::Snare, 0.3), (StemType::HiHat, 0.8),
        (StemType::Percussion, 0.7), (StemType::Bass, 0.0), (StemType::Sub, 0.0),
        (StemType::Lead, 0.5), (StemType::Pad, 1.4), (StemType::Vocal, 0.3),
        (StemType::FX, 1.2), (StemType::Unknown, 0.5),
    ];
    for (st, w) in widths { t.stem_width.insert(st, w); }

    // EQ hints (dB adjustments)
    let eq_low = [
        (StemType::Kick, 2.0), (StemType::Snare, -2.0), (StemType::HiHat, -6.0),
        (StemType::Percussion, -3.0), (StemType::Bass, 1.0), (StemType::Sub, 3.0),
        (StemType::Lead, -2.0), (StemType::Pad, -4.0), (StemType::Vocal, -3.0),
        (StemType::FX, -4.0), (StemType::Unknown, 0.0),
    ];
    let eq_mid = [
        (StemType::Kick, -2.0), (StemType::Snare, 1.5), (StemType::HiHat, -1.0),
        (StemType::Percussion, 0.0), (StemType::Bass, -1.0), (StemType::Sub, -3.0),
        (StemType::Lead, 2.0), (StemType::Pad, -1.0), (StemType::Vocal, 2.5),
        (StemType::FX, 0.0), (StemType::Unknown, 0.0),
    ];
    let eq_high = [
        (StemType::Kick, -1.0), (StemType::Snare, 2.0), (StemType::HiHat, 1.5),
        (StemType::Percussion, 1.0), (StemType::Bass, -3.0), (StemType::Sub, -6.0),
        (StemType::Lead, 1.5), (StemType::Pad, 2.0), (StemType::Vocal, 1.5),
        (StemType::FX, 1.0), (StemType::Unknown, 0.0),
    ];
    for (st, v) in eq_low { t.stem_eq_low.insert(st, v); }
    for (st, v) in eq_mid { t.stem_eq_mid.insert(st, v); }
    for (st, v) in eq_high { t.stem_eq_high.insert(st, v); }

    // Compression targets
    let comp = [
        (StemType::Kick, (-10.0, 4.0)), (StemType::Snare, (-12.0, 3.5)),
        (StemType::HiHat, (-18.0, 2.0)), (StemType::Percussion, (-15.0, 2.5)),
        (StemType::Bass, (-8.0, 4.0)), (StemType::Sub, (-6.0, 3.0)),
        (StemType::Lead, (-14.0, 2.5)), (StemType::Pad, (-20.0, 1.5)),
        (StemType::Vocal, (-12.0, 3.0)), (StemType::FX, (-16.0, 2.0)),
        (StemType::Unknown, (-15.0, 2.0)),
    ];
    for (st, (th, r)) in comp {
        t.stem_comp_thresh.insert(st, th);
        t.stem_comp_ratio.insert(st, r);
    }

    t
}

fn compute_mix_settings(stems: &[StemAnalysis], genre: MixGenre, target_lufs: f32) -> Vec<StemMixSettings> {
    let targets = genre_targets(genre);

    stems.iter().map(|stem| {
        let st = stem.stem_type;
        let target_offset = targets.stem_lufs.get(&st).copied().unwrap_or(-6.0);
        let target_stem_lufs = target_lufs + target_offset;

        // Gain to reach target
        let gain_db = (target_stem_lufs - stem.lufs).clamp(-18.0, 18.0);

        StemMixSettings {
            id: stem.id.clone(),
            gain_db,
            pan: targets.stem_pan.get(&st).copied().unwrap_or(0.0),
            eq_low_db: targets.stem_eq_low.get(&st).copied().unwrap_or(0.0),
            eq_mid_db: targets.stem_eq_mid.get(&st).copied().unwrap_or(0.0),
            eq_high_db: targets.stem_eq_high.get(&st).copied().unwrap_or(0.0),
            comp_threshold_db: targets.stem_comp_thresh.get(&st).copied().unwrap_or(-15.0),
            comp_ratio: targets.stem_comp_ratio.get(&st).copied().unwrap_or(2.0),
            width: targets.stem_width.get(&st).copied().unwrap_or(0.5),
            mute: false,
            solo: false,
        }
    }).collect()
}

// ─── WAV writer ────────────────────────────────────────────────────────────

fn write_wav(path: &Path, samples: &[Vec<f32>], sample_rate: u32) -> Result<(), String> {
    use std::io::Write;
    let channels = samples.len() as u16;
    let num_frames = samples[0].len() as u32;
    let bits = 32u16; // 32-bit float
    let byte_rate = sample_rate * channels as u32 * 4;
    let block_align = channels * 4;
    let data_size = num_frames * channels as u32 * 4;
    let file_size = 36 + data_size;

    let mut f = std::fs::File::create(path).map_err(|e| format!("Cannot create {}: {}", path.display(), e))?;
    f.write_all(b"RIFF").map_err(|e| e.to_string())?;
    f.write_all(&file_size.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(b"WAVE").map_err(|e| e.to_string())?;

    // fmt chunk (float)
    f.write_all(b"fmt ").map_err(|e| e.to_string())?;
    f.write_all(&16u32.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&3u16.to_le_bytes()).map_err(|e| e.to_string())?; // IEEE float
    f.write_all(&channels.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&sample_rate.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&byte_rate.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&block_align.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&bits.to_le_bytes()).map_err(|e| e.to_string())?;

    // data chunk
    f.write_all(b"data").map_err(|e| e.to_string())?;
    f.write_all(&data_size.to_le_bytes()).map_err(|e| e.to_string())?;

    for frame in 0..num_frames as usize {
        for ch in 0..channels as usize {
            let s = samples[ch].get(frame).copied().unwrap_or(0.0);
            f.write_all(&s.to_le_bytes()).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

// ─── Simple DSP for rendering ──────────────────────────────────────────────

fn apply_gain(samples: &mut [f32], gain_db: f32) {
    let lin = 10.0f32.powf(gain_db / 20.0);
    for s in samples.iter_mut() { *s *= lin; }
}

fn apply_pan(left: &mut [f32], right: &mut [f32], pan: f32) {
    // Equal-power panning
    let angle = (pan + 1.0) * 0.25 * std::f32::consts::PI;
    let gl = angle.cos();
    let gr = angle.sin();
    for s in left.iter_mut() { *s *= gl * std::f32::consts::SQRT_2; }
    for s in right.iter_mut() { *s *= gr * std::f32::consts::SQRT_2; }
}

/// Simple 1-pole EQ shelf approximation.
fn apply_simple_eq(samples: &mut [f32], sr: f32, low_db: f32, mid_db: f32, high_db: f32) {
    let low_gain = 10.0f32.powf(low_db / 20.0);
    let mid_gain = 10.0f32.powf(mid_db / 20.0);
    let high_gain = 10.0f32.powf(high_db / 20.0);

    // Simple 3-band split using 1-pole filters
    let lp_alpha = 1.0 - (-std::f32::consts::TAU * 200.0 / sr).exp();
    let hp_alpha = 1.0 - (-std::f32::consts::TAU * 4000.0 / sr).exp();

    let mut lp_state = 0.0f32;
    let mut hp_state = 0.0f32;

    for s in samples.iter_mut() {
        lp_state += lp_alpha * (*s - lp_state);
        hp_state += hp_alpha * (*s - hp_state);
        let low = lp_state;
        let high = *s - hp_state;
        let mid = *s - low - high;
        *s = low * low_gain + mid * mid_gain + high * high_gain;
    }
}

/// Simple peak compressor.
fn apply_compression(samples: &mut [f32], sr: f32, threshold_db: f32, ratio: f32) {
    let thresh_lin = 10.0f32.powf(threshold_db / 20.0);
    let attack = (-1.0 / (0.005 * sr)).exp();
    let release = (-1.0 / (0.050 * sr)).exp();
    let mut env = 0.0f32;

    for s in samples.iter_mut() {
        let abs = s.abs();
        let coeff = if abs > env { attack } else { release };
        env = coeff * env + (1.0 - coeff) * abs;

        if env > thresh_lin {
            let over_db = 20.0 * (env / thresh_lin).log10();
            let gr_db = over_db * (1.0 - 1.0 / ratio);
            let gr_lin = 10.0f32.powf(-gr_db / 20.0);
            *s *= gr_lin;
        }
    }
}

/// Apply stereo width via mid/side.
fn apply_width(left: &mut [f32], right: &mut [f32], width: f32) {
    for i in 0..left.len() {
        let m = (left[i] + right[i]) * 0.5;
        let s = (left[i] - right[i]) * 0.5 * width;
        left[i] = m + s;
        right[i] = m - s;
    }
}

// ─── Tauri commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn automix_analyze(
    paths: Vec<String>,
    genre: String,
    target_lufs: f32,
    state: tauri::State<'_, super::AppState>,
    app: AppHandle,
) -> Result<AutoMixSession, String> {
    let genre = match genre.to_lowercase().as_str() {
        "hardstyle" => MixGenre::Hardstyle,
        "rawstyle" => MixGenre::Rawstyle,
        "hardcore" => MixGenre::Hardcore,
        "frenchcore" => MixGenre::Frenchcore,
        "edm" => MixGenre::EDM,
        "hiphop" | "hip-hop" => MixGenre::HipHop,
        "pop" => MixGenre::Pop,
        _ => MixGenre::EDM,
    };

    let total = paths.len();
    let mut stems = Vec::with_capacity(total);

    for (i, p) in paths.iter().enumerate() {
        let _ = app.emit("automix:progress", AutoMixProgress {
            stage: "analyzing".into(),
            current: i + 1,
            total,
            message: format!("Analyzing {}", Path::new(p).file_name().unwrap_or_default().to_string_lossy()),
        });

        let path = PathBuf::from(p);
        let stem = analyze_stem(&path)?;
        stems.push(stem);
    }

    let _ = app.emit("automix:progress", AutoMixProgress {
        stage: "mixing".into(), current: total, total,
        message: "Computing mix settings...".into(),
    });

    let mix_settings = compute_mix_settings(&stems, genre, target_lufs);

    let session = AutoMixSession {
        stems,
        mix_settings,
        genre,
        master_gain_db: 0.0,
        target_lufs,
    };

    *state.automix.session.lock().unwrap() = Some(session.clone());

    let _ = app.emit("automix:progress", AutoMixProgress {
        stage: "done".into(), current: total, total,
        message: "Analysis complete".into(),
    });

    Ok(session)
}

#[tauri::command]
pub fn automix_update_setting(
    stem_id: String,
    field: String,
    value: f64,
    state: tauri::State<'_, super::AppState>,
) -> Result<(), String> {
    let mut session = state.automix.session.lock().unwrap();
    let session = session.as_mut().ok_or("No active session")?;
    let setting = session.mix_settings.iter_mut()
        .find(|s| s.id == stem_id)
        .ok_or("Stem not found")?;

    match field.as_str() {
        "gain_db" => setting.gain_db = value as f32,
        "pan" => setting.pan = (value as f32).clamp(-1.0, 1.0),
        "eq_low_db" => setting.eq_low_db = value as f32,
        "eq_mid_db" => setting.eq_mid_db = value as f32,
        "eq_high_db" => setting.eq_high_db = value as f32,
        "comp_threshold_db" => setting.comp_threshold_db = value as f32,
        "comp_ratio" => setting.comp_ratio = (value as f32).max(1.0),
        "width" => setting.width = (value as f32).clamp(0.0, 2.0),
        "mute" => setting.mute = value > 0.5,
        "solo" => setting.solo = value > 0.5,
        _ => return Err(format!("Unknown field: {}", field)),
    }
    Ok(())
}

#[tauri::command]
pub fn automix_update_stem_type(
    stem_id: String,
    stem_type: String,
    state: tauri::State<'_, super::AppState>,
) -> Result<(), String> {
    let mut session = state.automix.session.lock().unwrap();
    let session = session.as_mut().ok_or("No active session")?;
    let stem = session.stems.iter_mut()
        .find(|s| s.id == stem_id)
        .ok_or("Stem not found")?;

    stem.stem_type = match stem_type.to_lowercase().as_str() {
        "kick" => StemType::Kick,
        "snare" => StemType::Snare,
        "hihat" => StemType::HiHat,
        "percussion" => StemType::Percussion,
        "bass" => StemType::Bass,
        "sub" => StemType::Sub,
        "lead" => StemType::Lead,
        "pad" => StemType::Pad,
        "vocal" => StemType::Vocal,
        "fx" => StemType::FX,
        _ => StemType::Unknown,
    };

    // Recompute mix settings for this stem
    let targets = genre_targets(session.genre);
    let target_offset = targets.stem_lufs.get(&stem.stem_type).copied().unwrap_or(-6.0);
    let gain_db = (session.target_lufs + target_offset - stem.lufs).clamp(-18.0, 18.0);

    if let Some(setting) = session.mix_settings.iter_mut().find(|s| s.id == stem_id) {
        setting.gain_db = gain_db;
        setting.pan = targets.stem_pan.get(&stem.stem_type).copied().unwrap_or(0.0);
        setting.width = targets.stem_width.get(&stem.stem_type).copied().unwrap_or(0.5);
        setting.eq_low_db = targets.stem_eq_low.get(&stem.stem_type).copied().unwrap_or(0.0);
        setting.eq_mid_db = targets.stem_eq_mid.get(&stem.stem_type).copied().unwrap_or(0.0);
        setting.eq_high_db = targets.stem_eq_high.get(&stem.stem_type).copied().unwrap_or(0.0);
        setting.comp_threshold_db = targets.stem_comp_thresh.get(&stem.stem_type).copied().unwrap_or(-15.0);
        setting.comp_ratio = targets.stem_comp_ratio.get(&stem.stem_type).copied().unwrap_or(2.0);
    }

    Ok(())
}

#[tauri::command]
pub async fn automix_render(
    output_path: String,
    state: tauri::State<'_, super::AppState>,
    app: AppHandle,
) -> Result<String, String> {
    let session = {
        let guard = state.automix.session.lock().unwrap();
        guard.clone().ok_or("No active session")?
    };

    let _ = app.emit("automix:progress", AutoMixProgress {
        stage: "rendering".into(), current: 0, total: session.stems.len(),
        message: "Loading stems...".into(),
    });

    // Determine output params: use highest sample rate, stereo
    let sr = session.stems.iter().map(|s| s.sample_rate).max().unwrap_or(44100);
    let max_len = session.stems.iter().map(|s| {
        (s.duration_secs * sr as f32) as usize
    }).max().unwrap_or(0);

    let mut mix_l = vec![0.0f32; max_len];
    let mut mix_r = vec![0.0f32; max_len];

    let any_solo = session.mix_settings.iter().any(|s| s.solo);

    for (i, (stem, settings)) in session.stems.iter().zip(&session.mix_settings).enumerate() {
        if settings.mute { continue; }
        if any_solo && !settings.solo { continue; }

        let _ = app.emit("automix:progress", AutoMixProgress {
            stage: "rendering".into(), current: i + 1, total: session.stems.len(),
            message: format!("Processing {}", stem.file_name),
        });

        let wav = read_wav(Path::new(&stem.file_path))?;
        let n = wav.samples[0].len();

        let mut left = wav.samples[0].clone();
        let mut right = if wav.samples.len() >= 2 {
            wav.samples[1].clone()
        } else {
            wav.samples[0].clone()
        };

        // Apply EQ
        apply_simple_eq(&mut left, sr as f32, settings.eq_low_db, settings.eq_mid_db, settings.eq_high_db);
        apply_simple_eq(&mut right, sr as f32, settings.eq_low_db, settings.eq_mid_db, settings.eq_high_db);

        // Apply compression
        apply_compression(&mut left, sr as f32, settings.comp_threshold_db, settings.comp_ratio);
        apply_compression(&mut right, sr as f32, settings.comp_threshold_db, settings.comp_ratio);

        // Apply width
        apply_width(&mut left, &mut right, settings.width);

        // Apply gain
        apply_gain(&mut left, settings.gain_db);
        apply_gain(&mut right, settings.gain_db);

        // Apply pan
        apply_pan(&mut left, &mut right, settings.pan);

        // Sum into mix
        for j in 0..n.min(max_len) {
            mix_l[j] += left[j];
            mix_r[j] += right[j];
        }
    }

    // Apply master gain
    if session.master_gain_db.abs() > 0.01 {
        apply_gain(&mut mix_l, session.master_gain_db);
        apply_gain(&mut mix_r, session.master_gain_db);
    }

    let _ = app.emit("automix:progress", AutoMixProgress {
        stage: "writing".into(), current: session.stems.len(), total: session.stems.len(),
        message: "Writing output file...".into(),
    });

    let out_path = PathBuf::from(&output_path);
    write_wav(&out_path, &[mix_l, mix_r], sr)?;

    let _ = app.emit("automix:progress", AutoMixProgress {
        stage: "done".into(), current: session.stems.len(), total: session.stems.len(),
        message: format!("Rendered to {}", out_path.file_name().unwrap_or_default().to_string_lossy()),
    });

    Ok(output_path)
}

#[tauri::command]
pub fn automix_render_path() -> Result<Option<String>, String> {
    let downloads = dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .ok_or("Cannot find Downloads folder")?;
    let path = downloads.join("automix-output.wav");
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn automix_get_session(
    state: tauri::State<'_, super::AppState>,
) -> Result<Option<AutoMixSession>, String> {
    Ok(state.automix.session.lock().unwrap().clone())
}
