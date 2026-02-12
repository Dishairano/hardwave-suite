use std::path::Path;
use std::time::SystemTime;
use walkdir::WalkDir;
use sha2::{Sha256, Digest};
use std::fs;
use std::io::Read;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use crate::models::File;

const AUDIO_EXTENSIONS: [&str; 6] = ["wav", "mp3", "flac", "aiff", "ogg", "m4a"];
const PROJECT_EXTENSIONS: [&str; 1] = ["flp"];
const MIDI_EXTENSIONS: [&str; 2] = ["mid", "midi"];

#[derive(Default)]
struct AudioMetadata {
    duration: Option<f64>,
    sample_rate: Option<i32>,
    bit_depth: Option<i32>,
    channels: Option<i32>,
    bpm: Option<f64>,
}

fn get_file_type(ext: &str) -> Option<&'static str> {
    let ext_lower = ext.to_lowercase();
    if AUDIO_EXTENSIONS.contains(&ext_lower.as_str()) {
        Some("sample")
    } else if PROJECT_EXTENSIONS.contains(&ext_lower.as_str()) {
        Some("project")
    } else if MIDI_EXTENSIONS.contains(&ext_lower.as_str()) {
        Some("midi")
    } else {
        None
    }
}

fn hash_file(path: &Path) -> std::io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = file.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(hex::encode(hasher.finalize()))
}

fn system_time_to_millis(time: SystemTime) -> i64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn extract_audio_metadata(path: &Path) -> AudioMetadata {
    let mut metadata = AudioMetadata::default();

    // Open the file
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return metadata,
    };

    // Create a media source stream
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    // Create a hint to help the format detection
    let mut hint = Hint::new();
    if let Some(ext) = path.extension() {
        hint.with_extension(&ext.to_string_lossy());
    }

    // Probe the media source
    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();

    let probed = match symphonia::default::get_probe().format(
        &hint,
        mss,
        &format_opts,
        &metadata_opts,
    ) {
        Ok(p) => p,
        Err(_) => return metadata,
    };

    let format = probed.format;

    // Get the default track
    if let Some(track) = format.default_track() {
        let codec_params = &track.codec_params;

        // Extract sample rate
        if let Some(sample_rate) = codec_params.sample_rate {
            metadata.sample_rate = Some(sample_rate as i32);
        }

        // Extract channels
        if let Some(channels) = codec_params.channels {
            metadata.channels = Some(channels.count() as i32);
        }

        // Extract bit depth
        if let Some(bits_per_sample) = codec_params.bits_per_sample {
            metadata.bit_depth = Some(bits_per_sample as i32);
        }

        // Calculate duration
        if let Some(n_frames) = codec_params.n_frames {
            if let Some(sample_rate) = codec_params.sample_rate {
                if sample_rate > 0 {
                    let duration_secs = n_frames as f64 / sample_rate as f64;
                    metadata.duration = Some(duration_secs);

                    // Attempt BPM detection for short samples (< 30 seconds)
                    if duration_secs < 30.0 {
                        metadata.bpm = estimate_bpm_from_duration(duration_secs);
                    }
                }
            }
        }

        // Try to get duration from time base if frames not available
        if metadata.duration.is_none() {
            if let Some(tb) = track.codec_params.time_base {
                if let Some(dur) = track.codec_params.n_frames {
                    let duration = tb.calc_time(dur);
                    metadata.duration = Some(duration.seconds as f64 + duration.frac);
                }
            }
        }
    }

    metadata
}

/// Estimate BPM for loop-style samples based on duration
/// Common loop lengths at various BPMs:
/// - 150 BPM: 1 bar = 1.6s, 2 bars = 3.2s, 4 bars = 6.4s
/// - 160 BPM: 1 bar = 1.5s, 2 bars = 3.0s, 4 bars = 6.0s
/// - 170 BPM: 1 bar = 1.41s, 2 bars = 2.82s, 4 bars = 5.65s
fn estimate_bpm_from_duration(duration: f64) -> Option<f64> {
    // Common hardstyle/hardcore BPM range
    let bpm_range: Vec<f64> = (140..=180).map(|b| b as f64).collect();

    for bars in [1, 2, 4, 8] {
        for &bpm in &bpm_range {
            // Calculate expected duration for this BPM and bar count
            // 1 bar = 4 beats, duration = (4 * bars * 60) / bpm
            let expected_duration = (4.0 * bars as f64 * 60.0) / bpm;

            // Allow 2% tolerance
            let tolerance = expected_duration * 0.02;
            if (duration - expected_duration).abs() < tolerance {
                return Some(bpm);
            }
        }
    }

    None
}

/// Auto-generate tags from folder path
pub fn generate_tags_from_path(file_path: &str) -> Vec<String> {
    let mut tags = Vec::new();
    let path = Path::new(file_path);

    // Get parent folders (up to 3 levels)
    let mut current = path.parent();
    let mut depth = 0;

    while let Some(parent) = current {
        if depth >= 3 {
            break;
        }

        if let Some(folder_name) = parent.file_name() {
            let name = folder_name.to_string_lossy().to_lowercase();

            // Skip common non-descriptive folder names
            let skip_names = ["samples", "sounds", "audio", "music", "downloads", "desktop"];
            if !skip_names.contains(&name.as_str()) && !name.is_empty() {
                // Clean up the tag name
                let tag = name
                    .replace('_', " ")
                    .replace('-', " ")
                    .trim()
                    .to_string();

                if !tag.is_empty() && tag.len() > 1 {
                    tags.push(tag);
                }
            }
        }

        current = parent.parent();
        depth += 1;
    }

    // Also extract tags from filename
    if let Some(stem) = path.file_stem() {
        let name = stem.to_string_lossy().to_lowercase();

        // Common sample type indicators
        let type_indicators = [
            ("kick", "kick"), ("snare", "snare"), ("hat", "hihat"), ("clap", "clap"),
            ("perc", "percussion"), ("bass", "bass"), ("lead", "lead"), ("pad", "pad"),
            ("fx", "fx"), ("vox", "vocal"), ("vocal", "vocal"), ("loop", "loop"),
            ("one shot", "one shot"), ("oneshot", "one shot"),
        ];

        for (indicator, tag) in type_indicators {
            if name.contains(indicator) {
                tags.push(tag.to_string());
                break;
            }
        }
    }

    tags
}

pub async fn scan_folder(folder_path: &str) -> Result<Vec<File>, Box<dyn std::error::Error + Send + Sync>> {
    let mut files = Vec::new();
    let now = system_time_to_millis(SystemTime::now());

    for entry in WalkDir::new(folder_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Skip directories
        if !path.is_file() {
            continue;
        }

        // Get extension
        let extension = match path.extension() {
            Some(ext) => ext.to_string_lossy().to_lowercase(),
            None => continue,
        };

        // Check if it's a supported file type
        let file_type = match get_file_type(&extension) {
            Some(ft) => ft,
            None => continue,
        };

        // Get file metadata
        let metadata = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        // Calculate hash
        let hash = match hash_file(path) {
            Ok(h) => h,
            Err(_) => continue,
        };

        let filename = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        let created_at = metadata.created()
            .map(system_time_to_millis)
            .unwrap_or(now);

        let modified_at = metadata.modified()
            .map(system_time_to_millis)
            .unwrap_or(now);

        // Extract audio metadata for audio files
        let audio_meta = if file_type == "sample" {
            extract_audio_metadata(path)
        } else {
            AudioMetadata::default()
        };

        files.push(File {
            id: None,
            file_path: path.to_string_lossy().to_string(),
            filename,
            file_type: file_type.to_string(),
            file_extension: extension.clone(),
            file_size: metadata.len() as i64,
            hash,
            created_at,
            modified_at,
            indexed_at: now,
            duration: audio_meta.duration,
            sample_rate: audio_meta.sample_rate,
            bit_depth: audio_meta.bit_depth,
            channels: audio_meta.channels,
            bpm: audio_meta.bpm,
            detected_key: None, // Key detection requires more complex analysis
            detected_scale: None,
            energy_level: None,
            notes: None,
            rating: 0,
            color_code: None,
            is_favorite: false,
            use_count: 0,
        });
    }

    Ok(files)
}
