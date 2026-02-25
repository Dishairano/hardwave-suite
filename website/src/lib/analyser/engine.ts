// AnalyserEngine — framework-agnostic signal processing for the Hardwave Analyser.
// Extracted from desktop-app-tauri AnalyserView.tsx (VST data path).

import {
  type AudioPacket,
  type AnalyserConfig,
  type MeterStats,
  type StereoBand,
  type TraceId,
  DISPLAY_BANDS,
  VST_BANDS,
  MIN_FREQ,
  MAX_FREQ,
  SMOOTHING_FAST,
  SMOOTHING_MEDIUM,
  SMOOTHING_SLOW,
} from './types'

import {
  clamp,
  lerp,
  dbToPower,
  powerToDb,
  freqToNote,
  getAWeighting,
  getCWeighting,
} from './math'

const TRACE_IDS: readonly TraceId[] = ['mix', 'l', 'r', 'm', 's']

function makeTraceSet(fill: number): Record<TraceId, Float32Array> {
  const make = () => { const a = new Float32Array(DISPLAY_BANDS); a.fill(fill); return a }
  return { mix: make(), l: make(), r: make(), m: make(), s: make() }
}

/**
 * Stateful audio-analysis engine. Call `processPacket()` every frame with VST data,
 * then read `traces`, `peaks`, `avg`, `meters`, `stereoBands` for rendering.
 */
export class AnalyserEngine {
  // Spectrum data
  traces = makeTraceSet(-100)
  peaks = makeTraceSet(-100)
  peakDecays = makeTraceSet(0)
  avg = (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })()

  // Per-band frequencies (log-spaced)
  bandFreqs: Float32Array

  // Mid/Side power per band (for stereo width computation)
  private midPower = new Float32Array(DISPLAY_BANDS)
  private sidePower = new Float32Array(DISPLAY_BANDS)

  // Level tracking
  private leftPeak = -100
  private rightPeak = -100
  private leftRms = 0
  private rightRms = 0
  private leftPeakHold = -100
  private rightPeakHold = -100
  private truePeakLeft = -100
  private truePeakRight = -100
  private clipLeft = false
  private clipRight = false
  private phaseCorrelation = 0
  private stereoWidth = 0

  // LUFS tracking (not available in VST-only mode without time-domain samples — stubs)
  private lufsM: number | null = null
  private lufsS: number | null = null
  private lufsI: number | null = null

  // Kick detection
  private kickFundHz: number | null = null
  private kickNote: string | null = null
  private kickRatios: { sub: number; punch: number; tail: number } | null = null

  // Stereo bands
  stereoBands: StereoBand[] = []

  // Meter stats (updated at lower rate)
  meters: MeterStats = {
    leftPeakDb: -100, rightPeakDb: -100,
    leftTruePeakDb: -100, rightTruePeakDb: -100,
    rmsDb: -100, crestDb: 0,
    correlation: 0, width: 0,
    dcOffsetL: 0, dcOffsetR: 0,
    lufsM: null, lufsS: null, lufsI: null,
    kickFundHz: null, kickNote: null, kickRatios: null,
  }

  private lastStatsUpdate = 0

  constructor() {
    const a = new Float32Array(DISPLAY_BANDS)
    const logMin = Math.log10(MIN_FREQ)
    const logMax = Math.log10(MAX_FREQ)
    for (let i = 0; i < DISPLAY_BANDS; i++) {
      const t = (i + 0.5) / DISPLAY_BANDS
      a[i] = Math.pow(10, logMin + t * (logMax - logMin))
    }
    this.bandFreqs = a
  }

  /** Reset all state (peak holds, averages, etc.) */
  reset(): void {
    for (const id of TRACE_IDS) {
      this.traces[id].fill(-100)
      this.peaks[id].fill(-100)
      this.peakDecays[id].fill(0)
    }
    this.avg.fill(-100)
    this.leftPeak = -100
    this.rightPeak = -100
    this.leftRms = 0
    this.rightRms = 0
    this.leftPeakHold = -100
    this.rightPeakHold = -100
    this.truePeakLeft = -100
    this.truePeakRight = -100
    this.clipLeft = false
    this.clipRight = false
    this.phaseCorrelation = 0
    this.stereoWidth = 0
    this.lufsM = null
    this.lufsS = null
    this.lufsI = null
    this.kickFundHz = null
    this.kickNote = null
    this.kickRatios = null
    this.stereoBands = []
  }

  /** Process one VST AudioPacket. Call once per animation frame. */
  processPacket(packet: AudioPacket, config: AnalyserConfig): void {
    if (config.frozen) return

    const smoothing = this.getSmoothingFactor(config.responseTime)

    const inLeft = packet.left_bands
    const inRight = packet.right_bands
    const inLen = Math.min(inLeft.length, inRight.length, VST_BANDS)

    let midSum = 0
    let sideSum = 0

    for (let i = 0; i < DISPLAY_BANDS; i++) {
      // Interpolate 64 VST bands → 256 display bands
      const t = (i + 0.5) / DISPLAY_BANDS
      const pos = t * inLen - 0.5
      const j0 = clamp(Math.floor(pos), 0, inLen - 1)
      const j1 = clamp(j0 + 1, 0, inLen - 1)
      const frac = clamp(pos - j0, 0, 1)

      const lDbRaw = lerp(inLeft[j0] ?? -100, inLeft[j1] ?? -100, frac)
      const rDbRaw = lerp(inRight[j0] ?? -100, inRight[j1] ?? -100, frac)

      const pL = dbToPower(lDbRaw)
      const pR = dbToPower(rDbRaw)

      const ampL = Math.sqrt(pL)
      const ampR = Math.sqrt(pR)
      const midAmp = (ampL + ampR) * 0.5
      const sideAmp = Math.abs(ampL - ampR) * 0.5
      const midPower = midAmp * midAmp
      const sidePower = sideAmp * sideAmp
      this.midPower[i] = midPower
      this.sidePower[i] = sidePower
      midSum += midPower
      sideSum += sidePower

      const mixDbRaw = config.spectrumMode === 'peak'
        ? Math.max(lDbRaw, rDbRaw)
        : powerToDb((pL + pR) * 0.5)

      const centerFreq = this.bandFreqs[i]

      // Apply tilt + weighting
      const lDb = this.applyWeighting(this.applyTilt(lDbRaw, centerFreq, config), centerFreq, config)
      const rDb = this.applyWeighting(this.applyTilt(rDbRaw, centerFreq, config), centerFreq, config)
      const mDb = this.applyWeighting(this.applyTilt(powerToDb(midPower), centerFreq, config), centerFreq, config)
      const sDb = this.applyWeighting(this.applyTilt(powerToDb(sidePower), centerFreq, config), centerFreq, config)
      const mixDb = this.applyWeighting(this.applyTilt(mixDbRaw, centerFreq, config), centerFreq, config)

      this.traces.l[i] = this.traces.l[i] * smoothing + lDb * (1 - smoothing)
      this.traces.r[i] = this.traces.r[i] * smoothing + rDb * (1 - smoothing)
      this.traces.m[i] = this.traces.m[i] * smoothing + mDb * (1 - smoothing)
      this.traces.s[i] = this.traces.s[i] * smoothing + sDb * (1 - smoothing)
      this.traces.mix[i] = this.traces.mix[i] * smoothing + mixDb * (1 - smoothing)

      // Slow average
      const avgSmoothing = 0.985
      this.avg[i] = this.avg[i] * avgSmoothing + this.traces.mix[i] * (1 - avgSmoothing)

      // Peak hold
      if (config.peakHold) {
        for (const id of TRACE_IDS) {
          const v = this.traces[id][i]
          if (v > this.peaks[id][i]) {
            this.peaks[id][i] = v
            this.peakDecays[id][i] = 0
          } else {
            this.peakDecays[id][i] += 1
            if (this.peakDecays[id][i] > 60) this.peaks[id][i] -= 0.5
          }
        }
      }
    }

    // Update levels from VST
    this.leftPeak = Math.max(this.leftPeak * 0.95, packet.left_peak)
    this.rightPeak = Math.max(this.rightPeak * 0.95, packet.right_peak)
    this.leftRms = this.leftRms * smoothing + packet.left_rms * (1 - smoothing)
    this.rightRms = this.rightRms * smoothing + packet.right_rms * (1 - smoothing)
    this.truePeakLeft = this.leftPeak
    this.truePeakRight = this.rightPeak

    if (config.peakHold) {
      this.leftPeakHold = Math.max(this.leftPeakHold, packet.left_peak)
      this.rightPeakHold = Math.max(this.rightPeakHold, packet.right_peak)
    }

    if (packet.left_peak > -0.1) this.clipLeft = true
    if (packet.right_peak > -0.1) this.clipRight = true

    // Stereo width & correlation from M/S energy
    const denomMs = midSum + sideSum
    this.stereoWidth = denomMs > 0 ? sideSum / denomMs : 0
    this.phaseCorrelation = denomMs > 0 ? (midSum - sideSum) / denomMs : 0

    // Fast meter update — every frame so peak/RMS canvases are smooth
    const avgRms = (this.leftRms + this.rightRms) * 0.5
    const rmsDb = 20 * Math.log10(avgRms + 1e-10)
    this.meters.leftPeakDb = this.leftPeak
    this.meters.rightPeakDb = this.rightPeak
    this.meters.leftTruePeakDb = this.truePeakLeft
    this.meters.rightTruePeakDb = this.truePeakRight
    this.meters.rmsDb = rmsDb
    this.meters.crestDb = Math.max(this.leftPeak, this.rightPeak) - rmsDb
    this.meters.correlation = this.phaseCorrelation
    this.meters.width = this.stereoWidth

    // Slow update: kick detection + band stereo (~8Hz)
    const now = performance.now()
    if (now - this.lastStatsUpdate > 120) {
      this.lastStatsUpdate = now
      this.updateMeterStats(config)
    }
  }

  private updateMeterStats(config: AnalyserConfig): void {
    // Kick metrics
    const mixTrace = this.traces.mix
    let fundHz: number | null = null
    let fundDb = -200
    let subPow = 0
    let punchPow = 0
    let tailPow = 0
    for (let i = 0; i < DISPLAY_BANDS; i++) {
      const f = this.bandFreqs[i]
      const p = dbToPower(mixTrace[i])
      if (f >= 30 && f <= 200 && mixTrace[i] > fundDb) {
        fundDb = mixTrace[i]
        fundHz = f
      }
      if (f >= 20 && f < 60) subPow += p
      else if (f >= 60 && f < 150) punchPow += p
      else if (f >= 150 && f < 400) tailPow += p
    }
    const totalKick = subPow + punchPow + tailPow
    const ratios = totalKick > 0 ? {
      sub: subPow / totalKick,
      punch: punchPow / totalKick,
      tail: tailPow / totalKick,
    } : null
    const note = fundHz ? freqToNote(fundHz) : null
    this.kickFundHz = fundHz
    this.kickNote = note?.note ?? null
    this.kickRatios = ratios

    // Band stereo width
    const bands: StereoBand[] = [
      { label: 'Sub', lowHz: 20, highHz: 80, correlation: 0, width: 0 },
      { label: 'Bass', lowHz: 80, highHz: 200, correlation: 0, width: 0 },
      { label: 'LowMid', lowHz: 200, highHz: 600, correlation: 0, width: 0 },
      { label: 'Mid', lowHz: 600, highHz: 2000, correlation: 0, width: 0 },
      { label: 'High', lowHz: 2000, highHz: 6000, correlation: 0, width: 0 },
      { label: 'Air', lowHz: 6000, highHz: 20000, correlation: 0, width: 0 },
    ]
    for (const b of bands) {
      let mP = 0
      let sP = 0
      for (let i = 0; i < DISPLAY_BANDS; i++) {
        const f = this.bandFreqs[i]
        if (f < b.lowHz || f >= b.highHz) continue
        mP += this.midPower[i]
        sP += this.sidePower[i]
      }
      const d = mP + sP
      b.width = d > 0 ? sP / d : 0
      b.correlation = d > 0 ? (mP - sP) / d : 0
    }
    this.stereoBands = bands

    // Only update slow fields here — fast fields (peak/rms/correlation) are
    // written every frame in processPacket.
    this.meters.lufsM = this.lufsM
    this.meters.lufsS = this.lufsS
    this.meters.lufsI = this.lufsI
    this.meters.kickFundHz = this.kickFundHz
    this.meters.kickNote = this.kickNote
    this.meters.kickRatios = this.kickRatios
  }

  private getSmoothingFactor(responseTime: string): number {
    switch (responseTime) {
      case 'fast': return SMOOTHING_FAST
      case 'medium': return SMOOTHING_MEDIUM
      case 'slow': return SMOOTHING_SLOW
      default: return SMOOTHING_MEDIUM
    }
  }

  private applyTilt(value: number, freq: number, config: AnalyserConfig): number {
    if (config.tiltMode === 'off') return value
    const tiltPerOctave = config.tiltMode === '-3dB' ? -3 : -4.5
    const octaves = Math.log2(freq / 1000)
    return value + octaves * tiltPerOctave
  }

  private applyWeighting(value: number, freq: number, config: AnalyserConfig): number {
    switch (config.weightingMode) {
      case 'dBA': return value + getAWeighting(freq)
      case 'dBC': return value + getCWeighting(freq)
      default: return value
    }
  }
}
