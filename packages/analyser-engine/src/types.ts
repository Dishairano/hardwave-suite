// Shared types for Hardwave Analyser — used by both the VST webview and browser pages.

export type ResponseTime = 'fast' | 'medium' | 'slow'
export type WeightingMode = 'flat' | 'dBA' | 'dBC'
export type SpectrumMode = 'peak' | 'rms'
export type SpectrumView = 'spectrum' | 'delta'
export type TraceId = 'mix' | 'l' | 'r' | 'm' | 's'
export type TraceToggles = Record<TraceId, boolean>

/** Mirrors the Rust AudioPacket struct (JSON-serialized when sent from wry). */
export interface AudioPacket {
  packet_type: number // 0=FFT, 1=Heartbeat
  sample_rate: number
  timestamp_ms: number
  left_bins: number[]  // 2048 raw FFT magnitude bins in dB (-100..0); bin i = i * sr / FFT_SIZE Hz
  right_bins: number[]
  left_peak: number // dB
  right_peak: number
  left_rms: number // linear 0..1
  right_rms: number
  /** Oscilloscope waveform samples, linear amplitude -1..1, length = WAVE_SIZE */
  left_wave?: number[]
  right_wave?: number[]
}

export interface AnalyserConfig {
  spectrumMode: SpectrumMode
  responseTime: ResponseTime
  /** Tilt in dB/octave, referenced at 1 kHz. Range -9..9, default 4.5. */
  slope: number
  weightingMode: WeightingMode
  frozen: boolean
  peakHold: boolean
  view: SpectrumView
  /** Bottom of dB scale. Range -180..-40. */
  rangeLo: number
  /** Top of dB scale. Range -35..20. */
  rangeHi: number
  /** Low frequency bound of x-axis (Hz). Range 1..500. */
  freqLo: number
  /** High frequency bound of x-axis (Hz). Range 600..96000. */
  freqHi: number
  showAvg: boolean
  showRef: boolean
  traces: TraceToggles
  /** Octave smoothing amount. 0 = off. Typical SPAN values: 0, 1/6, 1/3, 2/3, 1, 2, 3. */
  smoothing: number
}

export interface MeterStats {
  leftPeakDb: number
  rightPeakDb: number
  leftTruePeakDb: number
  rightTruePeakDb: number
  rmsDb: number
  crestDb: number
  correlation: number
  width: number
  dcOffsetL: number
  dcOffsetR: number
  lufsM: number | null
  lufsS: number | null
  lufsI: number | null
  kickFundHz: number | null
  kickNote: string | null
  kickRatios: { sub: number; punch: number; tail: number } | null
}

export interface StereoBand {
  label: string
  lowHz: number
  highHz: number
  correlation: number
  width: number
}

export interface Snapshot {
  id: string
  name: string
  createdAt: number
  trace: Float32Array // mix trace in dB (DISPLAY_BANDS length)
}

export interface HoverInfo {
  freqHz: number
  db: number
  note: string | null
  cents: number | null
  deltaDb: number | null
}

// Constants
export const DISPLAY_BANDS = 256  // display slots rendered on screen
export const VST_BINS = 2048      // raw FFT bins from plugin (FFT_SIZE / 2)
export const WAVE_SIZE = 512
export const MIN_FREQ = 20
export const MAX_FREQ = 20000

export const SMOOTHING_FAST = 0.6
export const SMOOTHING_MEDIUM = 0.8
export const SMOOTHING_SLOW = 0.92

export const SPECTRUM_PAD = { left: 44, right: 14, top: 10, bottom: 20 } as const
