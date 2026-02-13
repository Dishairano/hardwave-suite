export type LogTick = {
  freq: number
  label: string
  major: boolean
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Interprets `db` as amplitude dB (20*log10(amp)).
export function dbToAmp(db: number): number {
  return Math.pow(10, db / 20)
}

// Returns amplitude dB (20*log10(amp)).
export function ampToDb(amp: number): number {
  return 20 * Math.log10(Math.max(amp, 1e-20))
}

// Converts amplitude dB to linear power ratio.
export function dbToPower(db: number): number {
  return Math.pow(10, db / 10)
}

// Returns amplitude dB from linear power ratio.
export function powerToDb(power: number): number {
  return 10 * Math.log10(Math.max(power, 1e-20))
}

export function formatFreq(freqHz: number): string {
  if (!Number.isFinite(freqHz) || freqHz <= 0) return '--'
  if (freqHz >= 1000) {
    const khz = freqHz / 1000
    return khz >= 10 ? `${khz.toFixed(1)}k` : `${khz.toFixed(2)}k`
  }
  return freqHz >= 100 ? `${Math.round(freqHz)}Hz` : `${freqHz.toFixed(1)}Hz`
}

export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return '--'
  // Use -inf for very small values.
  if (db < -240) return '-∞'
  return `${db.toFixed(1)} dB`
}

export function freqToX(freqHz: number, minHz: number, maxHz: number, width: number): number {
  const clamped = clamp(freqHz, minHz, maxHz)
  const logMin = Math.log10(minHz)
  const logMax = Math.log10(maxHz)
  const logF = Math.log10(clamped)
  const t = (logF - logMin) / (logMax - logMin)
  return t * width
}

export function xToFreq(x: number, minHz: number, maxHz: number, width: number): number {
  const t = clamp(width > 0 ? x / width : 0, 0, 1)
  const logMin = Math.log10(minHz)
  const logMax = Math.log10(maxHz)
  const logF = logMin + t * (logMax - logMin)
  return Math.pow(10, logF)
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export type NoteInfo = {
  midi: number
  note: string
  cents: number
}

export function freqToNote(freqHz: number): NoteInfo | null {
  if (!Number.isFinite(freqHz) || freqHz <= 0) return null

  const midiFloat = 69 + 12 * Math.log2(freqHz / 440)
  const midi = Math.round(midiFloat)
  const cents = Math.round((midiFloat - midi) * 100)
  const name = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return { midi, note: `${name}${octave}`, cents }
}

export function generateLogTicks(minHz: number, maxHz: number): LogTick[] {
  const ticks: LogTick[] = []

  const logMin = Math.floor(Math.log10(minHz))
  const logMax = Math.ceil(Math.log10(maxHz))

  // 1-2-5 ticks per decade (plus minor 3 for better readability in 20-20000).
  const bases = [1, 2, 3, 5] as const

  for (let decade = logMin; decade <= logMax; decade++) {
    const scale = Math.pow(10, decade)
    for (const base of bases) {
      const freq = base * scale
      if (freq < minHz || freq > maxHz) continue
      const major = base === 1 || base === 2 || base === 5
      const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`
      ticks.push({ freq, label, major })
    }
  }

  ticks.sort((a, b) => a.freq - b.freq)
  return ticks
}

export function randomId(prefix: string = 'id'): string {
  // Good enough for UI state keys.
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

