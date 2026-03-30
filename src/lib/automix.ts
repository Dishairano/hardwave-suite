// AutoMix service layer — wraps Tauri commands for the automix module.

export type StemType =
  | 'Kick' | 'Snare' | 'HiHat' | 'Percussion'
  | 'Bass' | 'Sub' | 'Lead' | 'Pad' | 'Vocal' | 'FX' | 'Unknown'

export const STEM_TYPES: StemType[] = [
  'Kick', 'Snare', 'HiHat', 'Percussion',
  'Bass', 'Sub', 'Lead', 'Pad', 'Vocal', 'FX', 'Unknown',
]

export type MixGenre =
  | 'Hardstyle' | 'Rawstyle' | 'Hardcore' | 'Frenchcore'
  | 'EDM' | 'HipHop' | 'Pop'

export const MIX_GENRES: MixGenre[] = [
  'Hardstyle', 'Rawstyle', 'Hardcore', 'Frenchcore', 'EDM', 'HipHop', 'Pop',
]

export interface StemAnalysis {
  id: string
  file_name: string
  file_path: string
  stem_type: StemType
  sample_rate: number
  channels: number
  duration_secs: number
  peak_db: number
  rms_db: number
  lufs: number
  crest_factor_db: number
  spectral_centroid_hz: number
  peak_freq_hz: number
  spectral_profile: number[]
  stereo_width: number
  stereo_correlation: number
}

export interface StemMixSettings {
  id: string
  gain_db: number
  pan: number
  eq_low_db: number
  eq_mid_db: number
  eq_high_db: number
  comp_threshold_db: number
  comp_ratio: number
  width: number
  mute: boolean
  solo: boolean
}

export interface AutoMixSession {
  stems: StemAnalysis[]
  mix_settings: StemMixSettings[]
  genre: MixGenre
  master_gain_db: number
  target_lufs: number
}

export interface AutoMixProgress {
  stage: string
  current: number
  total: number
  message: string
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

export async function analyze(
  paths: string[],
  genre: string,
  targetLufs: number,
): Promise<AutoMixSession> {
  return invoke<AutoMixSession>('automix_analyze', {
    paths,
    genre,
    targetLufs,
  })
}

export async function updateSetting(
  stemId: string,
  field: string,
  value: number,
): Promise<void> {
  return invoke('automix_update_setting', { stemId, field, value })
}

export async function updateStemType(
  stemId: string,
  stemType: string,
): Promise<void> {
  return invoke('automix_update_stem_type', { stemId, stemType })
}

export async function render(outputPath: string): Promise<string> {
  return invoke<string>('automix_render', { outputPath })
}

export async function getSession(): Promise<AutoMixSession | null> {
  return invoke<AutoMixSession | null>('automix_get_session')
}

export async function onProgress(
  callback: (progress: AutoMixProgress) => void,
): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<AutoMixProgress>('automix:progress', (e) => callback(e.payload))
}

// Stem type display helpers
const STEM_COLORS: Record<StemType, string> = {
  Kick: '#ef4444',
  Snare: '#f97316',
  HiHat: '#eab308',
  Percussion: '#a3e635',
  Bass: '#22c55e',
  Sub: '#14b8a6',
  Lead: '#06b6d4',
  Pad: '#8b5cf6',
  Vocal: '#ec4899',
  FX: '#6366f1',
  Unknown: '#6b7280',
}

const STEM_ICONS: Record<StemType, string> = {
  Kick: '🥁', Snare: '🪘', HiHat: '🔔', Percussion: '🎵',
  Bass: '🎸', Sub: '〰️', Lead: '🎹', Pad: '☁️',
  Vocal: '🎤', FX: '✨', Unknown: '❓',
}

export function stemColor(type: StemType): string {
  return STEM_COLORS[type] ?? '#6b7280'
}

export function stemIcon(type: StemType): string {
  return STEM_ICONS[type] ?? '❓'
}
