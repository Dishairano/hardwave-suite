'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AnalyserEngine } from './engine'
import { AnalyserRenderer } from './renderer'
import type {
  AnalyserConfig,
  AudioPacket,
  MeterStats,
  StereoBand,
  Snapshot,
  HoverInfo,
  ResponseTime,
  WeightingMode,
} from './types'
import { DISPLAY_BANDS, SPECTRUM_PAD } from './types'
import { clamp, formatFreq, formatDb, freqToNote, randomId } from './math'
import type { KickZone } from './renderer'

type AnalyserTab = 'mixing' | 'kick'

const KICK_ZONES: KickZone[] = [
  { label: 'Sub',   low: 20,  high: 60,  color: '#06b6d4' },
  { label: 'Punch', low: 60,  high: 150, color: '#22c55e' },
  { label: 'Tail',  low: 150, high: 400, color: '#f97316' },
]

// ─── NumberInput ─────────────────────────────────────────────────────────────
// Supports both slider drag and direct typing. Applies on blur or Enter.

function NumberInput({
  value, min, max, step, onChange, className,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  // When the config value changes externally (e.g. slider drag), drop the draft
  useEffect(() => { setDraft(null) }, [value])

  const commit = (raw: string) => {
    const n = parseFloat(raw)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
    setDraft(null)
  }

  return (
    <input
      type="number"
      min={min} max={max} step={step}
      value={draft ?? value}
      className={className}
      onChange={e => setDraft(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

// ─── Preset ─────────────────────────────────────────────────────────────────

interface Preset {
  id: string
  name: string
  config: AnalyserConfig
}

const STORAGE_CONFIG         = 'hw-analyser-config'
const STORAGE_PRESETS        = 'hw-analyser-presets'
const STORAGE_DEFAULT_PRESET = 'hw-analyser-default-preset'

const DEFAULT_CONFIG: AnalyserConfig = {
  spectrumMode: 'peak',
  responseTime: 'medium',
  slope: 4.5,
  weightingMode: 'flat',
  frozen: false,
  peakHold: true,
  view: 'spectrum',
  rangeLo: -78,
  rangeHi: -18,
  freqLo: 20,
  freqHi: 20000,
  showAvg: true,
  showRef: true,
  traces: { mix: true, l: false, r: false, m: false, s: false },
  smoothing: 0,
}

function loadConfig(): AnalyserConfig {
  try {
    const s = localStorage.getItem(STORAGE_CONFIG)
    if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s), frozen: false }
  } catch {}
  return DEFAULT_CONFIG
}

function loadPresets(): Preset[] {
  try {
    const s = localStorage.getItem(STORAGE_PRESETS)
    if (s) return JSON.parse(s)
  } catch {}
  return []
}

// ─── Component ──────────────────────────────────────────────────────────────

interface AnalyserCanvasProps {
  vstMode?: boolean
}

export function AnalyserCanvas({ vstMode = false }: AnalyserCanvasProps) {
  const [config, setConfig] = useState<AnalyserConfig>(DEFAULT_CONFIG)
  const [showSettings, setShowSettings] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetName, setPresetName] = useState('')
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(null)
  const [analyserTab, setAnalyserTab] = useState<AnalyserTab>('mixing')
  const [specPeakHoldEnabled, setSpecPeakHoldEnabled] = useState(false)

  const [meterStats, setMeterStats] = useState<MeterStats>({
    leftPeakDb: -100, rightPeakDb: -100,
    leftTruePeakDb: -100, rightTruePeakDb: -100,
    rmsDb: -100, crestDb: 0,
    correlation: 0, width: 0,
    dcOffsetL: 0, dcOffsetR: 0,
    lufsM: null, lufsS: null, lufsI: null,
    kickFundHz: null, kickNote: null, kickRatios: null,
  })

  const [stereoBands, setStereoBands] = useState<StereoBand[]>([])
  const [hasData, setHasData] = useState(false)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [refAId, setRefAId] = useState<string | null>(null)
  const [refBId, setRefBId] = useState<string | null>(null)
  const [activeRefSlot, setActiveRefSlot] = useState<'A' | 'B'>('A')
  const [activeBottomTab, setActiveBottomTab] = useState<'levels' | 'stereo' | 'kick'>('levels')
  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState<'spectrum' | 'osc' | 'bottom' | null>(null)

  const toggleExpand = useCallback((panel: 'spectrum' | 'osc' | 'bottom') => {
    setExpandedPanel(p => p === panel ? null : panel)
  }, [])

  // Refs
  const engineRef    = useRef<AnalyserEngine | null>(null)
  const rendererRef  = useRef<AnalyserRenderer | null>(null)
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseCanvasRef    = useRef<HTMLCanvasElement | null>(null)
  const peakCanvasRef     = useRef<HTMLCanvasElement | null>(null)
  const scopeCanvasRef    = useRef<HTMLCanvasElement | null>(null)
  const oscCanvasRef      = useRef<HTMLCanvasElement | null>(null)
  const animationRef      = useRef<number | null>(null)
  const latestPacketRef   = useRef<AudioPacket | null>(null)
  const configRef         = useRef(config)
  const hoverRef          = useRef<{ active: boolean; x: number; y: number; band: number } | null>(null)
  const activeRefTraceRef = useRef<Float32Array | null>(null)
  const activeRefNameRef  = useRef<string | null>(null)
  const lastStatsRef      = useRef(0)
  const importRef              = useRef<HTMLInputElement | null>(null)
  const analyserTabRef         = useRef<AnalyserTab>('mixing')
  const specPeakHoldEnabledRef = useRef(false)
  const specPeakCeilRef        = useRef<Float32Array>(new Float32Array(DISPLAY_BANDS).fill(-100))

  configRef.current             = config
  analyserTabRef.current        = analyserTab
  specPeakHoldEnabledRef.current = specPeakHoldEnabled

  // ── Escape key closes any expanded panel ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpandedPanel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Load from localStorage once on mount ──────────────────────────────────
  useEffect(() => {
    const savedPresets = loadPresets()
    setPresets(savedPresets)

    // Load default preset if one is set, otherwise restore last-used config
    try {
      const defaultId = localStorage.getItem(STORAGE_DEFAULT_PRESET)
      if (defaultId) {
        setDefaultPresetId(defaultId)
        const defaultPreset = savedPresets.find(p => p.id === defaultId)
        if (defaultPreset) {
          setConfig({ ...DEFAULT_CONFIG, ...defaultPreset.config, frozen: false })
          return
        }
      }
    } catch {}

    setConfig(loadConfig())
  }, [])

  // ── Persist config (debounced 400 ms) ─────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config))
    }, 400)
    return () => clearTimeout(t)
  }, [config])

  // ── Persist presets ───────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_PRESETS, JSON.stringify(presets))
  }, [presets])

  // ── Engine + renderer init ────────────────────────────────────────────────
  useEffect(() => {
    engineRef.current   = new AnalyserEngine()
    rendererRef.current = new AnalyserRenderer()
  }, [])

  // ── VST packet callback ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (packet: AudioPacket) => {
      latestPacketRef.current = packet
      if (!hasData) setHasData(true)
    }
    ;(window as any).__onAudioPacket = handler
    return () => { delete (window as any).__onAudioPacket }
  }, [hasData])

  // ── Sync active ref trace ─────────────────────────────────────────────────
  useEffect(() => {
    const activeId = activeRefSlot === 'A' ? refAId : refBId
    const snap = activeId ? snapshots.find(s => s.id === activeId) : null
    activeRefTraceRef.current = snap ? snap.trace : null
    activeRefNameRef.current  = snap ? snap.name  : null
  }, [snapshots, refAId, refBId, activeRefSlot])

  // ── Main render loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      // Always re-schedule first so a thrown error never kills the loop
      animationRef.current = requestAnimationFrame(loop)

      try {
        const engine   = engineRef.current
        const renderer = rendererRef.current
        if (!engine || !renderer) return

        const packet = latestPacketRef.current
        if (packet) {
          engine.processPacket(packet, configRef.current)
          latestPacketRef.current = null

          // Update running-maximum ceiling when enabled (and not frozen)
          if (specPeakHoldEnabledRef.current && !configRef.current.frozen) {
            const mix  = engine.traces.mix
            const ceil = specPeakCeilRef.current
            for (let i = 0; i < DISPLAY_BANDS; i++) {
              if (mix[i] > ceil[i]) ceil[i] = mix[i]
            }
          }
        }

        const isKick     = analyserTabRef.current === 'kick'
        const peakCeil   = specPeakHoldEnabledRef.current ? specPeakCeilRef.current : null
        const specOpts   = {
          ...(isKick ? { freqMin: 20, freqMax: 500, zones: KICK_ZONES } : {}),
          specPeakCeil: peakCeil,
        }

        if (spectrumCanvasRef.current)
          renderer.drawSpectrum(spectrumCanvasRef.current, engine, configRef.current,
            activeRefTraceRef.current, activeRefNameRef.current, hoverRef.current, specOpts)
        if (phaseCanvasRef.current)
          renderer.drawPhase(phaseCanvasRef.current, engine.meters.correlation)
        if (peakCanvasRef.current)
          renderer.drawPeakMeters(peakCanvasRef.current, engine, configRef.current.peakHold)
        if (scopeCanvasRef.current)
          renderer.drawOscilloscope(scopeCanvasRef.current, engine)
        if (oscCanvasRef.current)
          renderer.drawOscilloscope(oscCanvasRef.current, engine)

        const now = performance.now()
        if (now - lastStatsRef.current > 150) {
          lastStatsRef.current = now
          setMeterStats({ ...engine.meters })
          setStereoBands([...engine.stereoBands])
        }
      } catch (err) {
        console.error('[AnalyserCanvas] render loop error:', err)
      }
    }
    animationRef.current = requestAnimationFrame(loop)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSpectrumMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect  = e.currentTarget.getBoundingClientRect()
    const x     = clamp(e.clientX - rect.left, 0, rect.width)
    const y     = clamp(e.clientY - rect.top,  0, rect.height)
    const plotW = Math.max(1, rect.width - SPECTRUM_PAD.left - SPECTRUM_PAD.right)
    const xPlot = clamp(x - SPECTRUM_PAD.left, 0, plotW)
    const band  = clamp(Math.round((xPlot / plotW) * (DISPLAY_BANDS - 1)), 0, DISPLAY_BANDS - 1)
    hoverRef.current = { active: true, x, y, band }

    const engine = engineRef.current
    if (engine) {
      const freq   = engine.bandFreqs[band]
      const note   = freqToNote(freq)
      const mix    = engine.traces.mix
      const ref    = activeRefTraceRef.current
      const baseDb = mix[band]
      const delta  = ref ? (baseDb - ref[band]) : null
      const db     = configRef.current.view === 'delta' ? (delta ?? 0) : baseDb
      setHoverInfo({ freqHz: freq, db, note: note?.note ?? null, cents: note?.cents ?? null, deltaDb: configRef.current.view === 'delta' ? null : delta })
    }
  }, [])

  const handleSpectrumMouseLeave = useCallback(() => {
    hoverRef.current = null
    setHoverInfo(null)
  }, [])

  const captureSnapshot = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    const id = randomId('snap')
    const createdAt = Date.now()
    const trace = new Float32Array(DISPLAY_BANDS)
    trace.set(engine.traces.mix)
    const snap: Snapshot = { id, createdAt, name: `Snapshot ${new Date(createdAt).toLocaleTimeString()}`, trace }
    setSnapshots(prev => [snap, ...prev].slice(0, 30))
    if (activeRefSlot === 'A') setRefAId(id)
    else setRefBId(id)
  }, [activeRefSlot])

  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id))
    if (refAId === id) setRefAId(null)
    if (refBId === id) setRefBId(null)
  }, [refAId, refBId])

  const assignSnapshot = useCallback((id: string, slot: 'A' | 'B') => {
    if (slot === 'A') setRefAId(id)
    else setRefBId(id)
  }, [])

  const resetMeters = useCallback(() => { engineRef.current?.reset() }, [])
  const resetSpecPeakCeil = useCallback(() => { specPeakCeilRef.current.fill(-100) }, [])

  // ── Preset handlers ───────────────────────────────────────────────────────
  const setDefaultPreset = useCallback((id: string | null) => {
    setDefaultPresetId(id)
    if (id) {
      localStorage.setItem(STORAGE_DEFAULT_PRESET, id)
    } else {
      localStorage.removeItem(STORAGE_DEFAULT_PRESET)
    }
  }, [])

  const savePreset = useCallback(() => {
    const name = presetName.trim() || `Preset ${new Date().toLocaleTimeString()}`
    const preset: Preset = { id: randomId('preset'), name, config: { ...configRef.current } }
    setPresets(prev => [...prev, preset])
    setPresetName('')
  }, [presetName])

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id))
    if (defaultPresetId === id) {
      setDefaultPresetId(null)
      localStorage.removeItem(STORAGE_DEFAULT_PRESET)
    }
  }, [defaultPresetId])

  const loadPreset = useCallback((preset: Preset) => {
    setConfig({ ...DEFAULT_CONFIG, ...preset.config, frozen: false })
  }, [])

  const exportPresets = useCallback(() => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'hardwave-analyser-presets.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [presets])

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (Array.isArray(data)) {
          setPresets(prev => {
            const existing = new Set(prev.map(p => p.id))
            return [...prev, ...data.filter((p: Preset) => p.id && p.name && p.config && !existing.has(p.id))]
          })
        }
      } catch {}
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const formatLufs = (value: number | null): string =>
    (value == null || !Number.isFinite(value)) ? '--' : value.toFixed(1)

  const activeRefId       = activeRefSlot === 'A' ? refAId : refBId
  const activeRefSnapshot = activeRefId ? snapshots.find(s => s.id === activeRefId) : null
  const refASnapshot      = refAId ? snapshots.find(s => s.id === refAId) : null
  const refBSnapshot      = refBId ? snapshots.find(s => s.id === refBId) : null

  // ── Shared button class helpers ───────────────────────────────────────────
  const segBtn  = (active: boolean, color = 'cyan') =>
    `px-2 py-0.5 text-[10px] font-medium transition-colors ${active ? `bg-${color}-500/20 text-${color}-400` : 'text-zinc-500 hover:text-zinc-300'}`
  const toggleBtn = (active: boolean, color = 'cyan') =>
    `px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${active ? `border-${color}-500/50 bg-${color}-500/20 text-${color}-400` : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'}`

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0b] overflow-hidden h-full">

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="h-12 bg-[#111113] border-b border-[#27272a]/50 flex items-center px-4 gap-3 shrink-0">

        {/* Logo + name */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span className="text-xs font-bold text-white">Analyser</span>
        </div>

        {/* ── Mode tabs ── */}
        <div className="flex rounded-md overflow-hidden border border-[#27272a] shrink-0">
          <button
            onClick={() => setAnalyserTab('mixing')}
            className={`px-3 py-1 text-[10px] font-semibold transition-colors ${analyserTab === 'mixing' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >Mixing</button>
          <button
            onClick={() => setAnalyserTab('kick')}
            className={`px-3 py-1 text-[10px] font-semibold transition-colors border-l border-[#27272a] ${analyserTab === 'kick' ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >Kick Focus</button>
        </div>

        <div className="flex-1" />

        {/* Peak Ceiling checkbox */}
        <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={specPeakHoldEnabled}
            onChange={e => {
              setSpecPeakHoldEnabled(e.target.checked)
              if (!e.target.checked) resetSpecPeakCeil()
            }}
            className="w-3 h-3 accent-amber-400"
          />
          <span className="text-[10px] text-zinc-400">Peak Ceiling</span>
        </label>
        {specPeakHoldEnabled && (
          <button
            onClick={resetSpecPeakCeil}
            className="px-2 py-0.5 rounded-md text-[10px] border border-[#27272a] text-zinc-500 hover:text-white hover:bg-[#27272a] transition-colors shrink-0"
            title="Clear peak ceiling"
          >Clear</button>
        )}

        {/* Quick controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setConfig(s => ({ ...s, frozen: !s.frozen }))}
            className={toggleBtn(config.frozen)}
          >Freeze</button>

          <button onClick={resetMeters}
            className="px-2 py-1 rounded-md text-[10px] font-medium bg-[#18181b] text-zinc-400 hover:bg-[#27272a] hover:text-white transition-colors"
          >Reset</button>
        </div>

        {/* Signal status */}
        <div className={`px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 shrink-0 ${hasData ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasData ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
          {hasData ? 'Receiving' : 'Waiting...'}
        </div>

        {/* Settings toggle */}
        <button
          onClick={() => setShowSettings(s => !s)}
          className={`p-1.5 rounded-md text-[10px] font-medium border transition-colors shrink-0 ${showSettings ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-400' : 'border-[#27272a] text-zinc-400 hover:bg-[#27272a] hover:text-white'}`}
          title="Settings"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>
          </svg>
        </button>
      </div>

      {/* ── Settings panel ─────────────────────────────────────────────── */}
      {showSettings && (
        <div className="bg-[#0e0e10] border-b border-[#27272a] px-4 py-3 shrink-0">
          <div className="grid grid-cols-[auto_auto_auto_1fr] gap-x-6 gap-y-0 items-start">

            {/* ▸ Spectrum */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Spectrum</span>
              <div>
                <div className="text-[9px] text-zinc-600 mb-0.5">Mode</div>
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  {(['peak', 'rms'] as const).map(m => (
                    <button key={m} onClick={() => setConfig(s => ({ ...s, spectrumMode: m }))}
                      className={segBtn(config.spectrumMode === m)}
                    >{m.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 mb-0.5">Response</div>
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  {(['fast', 'medium', 'slow'] as ResponseTime[]).map(rt => (
                    <button key={rt} onClick={() => setConfig(s => ({ ...s, responseTime: rt }))}
                      className={segBtn(config.responseTime === rt, 'purple')}
                    >{rt === 'medium' ? 'Med' : rt.charAt(0).toUpperCase() + rt.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 mb-0.5">Smoothing</div>
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  {([
                    { v: 0,          label: 'Off' },
                    { v: 1/6,        label: '⅙' },
                    { v: 1/3,        label: '⅓' },
                    { v: 2/3,        label: '⅔' },
                    { v: 1,          label: '1' },
                    { v: 2,          label: '2' },
                    { v: 3,          label: '3' },
                  ] as const).map(opt => (
                    <button key={opt.label}
                      onClick={() => setConfig(s => ({ ...s, smoothing: opt.v }))}
                      className={segBtn(Math.abs((config.smoothing ?? 0) - opt.v) < 0.01, 'cyan')}
                      title={opt.v === 0 ? 'No smoothing' : `${opt.label} octave smoothing`}
                    >{opt.label}</button>
                  ))}
                </div>
                <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5">
                  <span>oct</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-zinc-600">Slope (dB/oct)</span>
                  <NumberInput value={config.slope} min={-9} max={9} step={0.5}
                    onChange={v => setConfig(s => ({ ...s, slope: v }))}
                    className="text-[9px] font-mono bg-transparent border-b border-zinc-700 text-zinc-300 w-10 text-right focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <input type="range" min="-9" max="9" step="0.5"
                  value={config.slope}
                  onChange={e => setConfig(s => ({ ...s, slope: parseFloat(e.target.value) }))}
                  className="w-full h-1 accent-orange-500 cursor-pointer" />
                <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5">
                  <span>-9</span><span>0</span><span>+9</span>
                </div>
              </div>
              <button onClick={() => setConfig(s => ({ ...s, peakHold: !s.peakHold }))}
                className={toggleBtn(config.peakHold, 'yellow')}
              >Peak Hold</button>
            </div>

            {/* ▸ Display */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Display</span>
              <div>
                <div className="text-[9px] text-zinc-600 mb-0.5">View</div>
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  <button onClick={() => setConfig(s => ({ ...s, view: 'spectrum' }))}
                    className={segBtn(config.view === 'spectrum')}
                  >Spectrum</button>
                  <button onClick={() => setConfig(s => ({ ...s, view: 'delta' }))}
                    className={segBtn(config.view === 'delta', 'amber')}
                  >Δ Delta</button>
                </div>
              </div>
              <div className={config.view === 'delta' ? 'opacity-40 pointer-events-none' : ''}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-zinc-600">Range Lo (dB)</span>
                  <NumberInput value={config.rangeLo} min={-180} max={-40} step={1}
                    onChange={v => setConfig(s => ({ ...s, rangeLo: Math.min(v, s.rangeHi - 10) }))}
                    className="text-[9px] font-mono bg-transparent border-b border-zinc-700 text-zinc-300 w-10 text-right focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <input type="range" min="-180" max="-40" step="1"
                  value={config.rangeLo}
                  onChange={e => setConfig(s => ({ ...s, rangeLo: Math.min(parseInt(e.target.value), s.rangeHi - 10) }))}
                  className="w-full h-1 accent-cyan-500 cursor-pointer" />
                <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5">
                  <span>-180</span><span>-110</span><span>-40</span>
                </div>
              </div>
              <div className={config.view === 'delta' ? 'opacity-40 pointer-events-none' : ''}>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-zinc-600">Range Hi (dB)</span>
                  <NumberInput value={config.rangeHi} min={-35} max={20} step={1}
                    onChange={v => setConfig(s => ({ ...s, rangeHi: Math.max(v, s.rangeLo + 10) }))}
                    className="text-[9px] font-mono bg-transparent border-b border-zinc-700 text-zinc-300 w-10 text-right focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <input type="range" min="-35" max="20" step="1"
                  value={config.rangeHi}
                  onChange={e => setConfig(s => ({ ...s, rangeHi: Math.max(parseInt(e.target.value), s.rangeLo + 10) }))}
                  className="w-full h-1 accent-cyan-500 cursor-pointer" />
                <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5">
                  <span>-35</span><span>-7</span><span>+20</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-zinc-600">Freq Lo (Hz)</span>
                  <NumberInput value={config.freqLo} min={1} max={500} step={1}
                    onChange={v => setConfig(s => ({ ...s, freqLo: Math.min(v, s.freqHi - 100) }))}
                    className="text-[9px] font-mono bg-transparent border-b border-zinc-700 text-zinc-300 w-10 text-right focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <input type="range" min="1" max="500" step="1"
                  value={config.freqLo}
                  onChange={e => setConfig(s => ({ ...s, freqLo: Math.min(parseInt(e.target.value), s.freqHi - 100) }))}
                  className="w-full h-1 accent-green-500 cursor-pointer" />
                <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5">
                  <span>1</span><span>250</span><span>500</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-zinc-600">Freq Hi (Hz)</span>
                  <NumberInput value={config.freqHi} min={600} max={96000} step={100}
                    onChange={v => setConfig(s => ({ ...s, freqHi: Math.max(v, s.freqLo + 100) }))}
                    className="text-[9px] font-mono bg-transparent border-b border-zinc-700 text-zinc-300 w-14 text-right focus:outline-none focus:border-zinc-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                </div>
                <input type="range" min="600" max="96000" step="100"
                  value={config.freqHi}
                  onChange={e => setConfig(s => ({ ...s, freqHi: Math.max(parseInt(e.target.value), s.freqLo + 100) }))}
                  className="w-full h-1 accent-green-500 cursor-pointer" />
                <div className="flex justify-between text-[8px] text-zinc-700 mt-0.5">
                  <span>600</span><span>20k</span><span>96k</span>
                </div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-600 mb-0.5">Weighting</div>
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  {(['flat', 'dBA', 'dBC'] as WeightingMode[]).map(w => (
                    <button key={w} onClick={() => setConfig(s => ({ ...s, weightingMode: w }))}
                      className={segBtn(config.weightingMode === w, 'green')}
                    >{w}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setConfig(s => ({ ...s, showAvg: !s.showAvg }))}
                  className={toggleBtn(config.showAvg, 'green')}
                >Avg overlay</button>
                <button onClick={() => setConfig(s => ({ ...s, showRef: !s.showRef }))}
                  className={toggleBtn(config.showRef)}
                >Ref overlay</button>
              </div>
            </div>

            {/* ▸ Traces */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Traces</span>
              <div className="flex flex-col gap-1.5">
                {(['mix', 'l', 'r', 'm', 's'] as const).map(id => {
                  const colors: Record<string, string> = { mix: 'cyan', l: 'cyan', r: 'purple', m: 'green', s: 'orange' }
                  const labels: Record<string, string> = { mix: 'Mix', l: 'Left', r: 'Right', m: 'Mid', s: 'Side' }
                  return (
                    <button key={id}
                      onClick={() => setConfig(s => ({ ...s, traces: { ...s.traces, [id]: !s.traces[id] } }))}
                      className={toggleBtn(config.traces[id], colors[id])}
                    >{labels[id]}</button>
                  )
                })}
              </div>
            </div>

            {/* ▸ Presets */}
            <div className="flex flex-col gap-2 min-w-0">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Presets</span>

              {/* Save row */}
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') savePreset() }}
                  placeholder="Preset name…"
                  className="flex-1 min-w-0 px-2 py-0.5 rounded-md bg-[#18181b] border border-[#27272a] text-[10px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500/50"
                />
                <button onClick={savePreset}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                >Save</button>
              </div>

              {/* Preset list */}
              <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
                {presets.length === 0 ? (
                  <div className="text-[10px] text-zinc-600">No presets saved yet.</div>
                ) : presets.map(p => {
                  const isDefault = defaultPresetId === p.id
                  return (
                    <div key={p.id} className="flex items-center gap-1 group">
                      <button onClick={() => loadPreset(p)}
                        className="flex-1 min-w-0 text-left px-2 py-0.5 rounded text-[10px] text-zinc-300 hover:text-white hover:bg-[#27272a] truncate transition-colors"
                        title={`Load preset: ${p.name}${isDefault ? ' (default on open)' : ''}`}
                      >
                        {p.name}
                      </button>

                      {/* Set Default star */}
                      <button
                        onClick={() => setDefaultPreset(isDefault ? null : p.id)}
                        title={isDefault ? 'Clear default preset' : 'Set as default on open'}
                        className={`p-0.5 rounded transition-all ${
                          isDefault
                            ? 'text-amber-400'
                            : 'text-zinc-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill={isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </button>

                      <button onClick={() => deletePreset(p.id)}
                        className="p-0.5 rounded text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete preset"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Default preset indicator */}
              {defaultPresetId && presets.find(p => p.id === defaultPresetId) && (
                <div className="flex items-center gap-1 px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  <svg className="w-2.5 h-2.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  <span className="text-[9px] text-amber-400/80 truncate">
                    Opens with: {presets.find(p => p.id === defaultPresetId)?.name}
                  </span>
                  <button onClick={() => setDefaultPreset(null)} className="ml-auto text-amber-500/60 hover:text-amber-400 transition-colors text-[9px]" title="Clear default">✕</button>
                </div>
              )}

              {/* Export / Import */}
              <div className="flex gap-1.5 mt-auto pt-1">
                <button onClick={exportPresets} disabled={presets.length === 0}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-[#27272a] text-zinc-400 hover:text-white hover:bg-[#27272a] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  title="Export presets as JSON"
                >↓ Export</button>
                <button onClick={() => importRef.current?.click()}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-[#27272a] text-zinc-400 hover:text-white hover:bg-[#27272a] transition-colors"
                  title="Import presets from JSON"
                >↑ Import</button>
                <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[minmax(0,1fr)_280px] grid-rows-[1fr] gap-3 overflow-hidden p-3">

        {/* Left column */}
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">

          {/* Spectrum card */}
          <div className={
            expandedPanel === 'spectrum'
              ? 'fixed inset-0 z-50 bg-[#09090b] p-3 flex flex-col'
              : 'flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-3 flex flex-col min-h-0'
          }>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {analyserTab === 'kick' ? 'Kick Focus' : 'Spectrum'}
                </span>
                {analyserTab === 'kick' ? (
                  meterStats.kickFundHz != null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-white font-mono tabular-nums leading-none">
                        {meterStats.kickNote ?? '--'}
                      </span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {meterStats.kickFundHz.toFixed(1)} Hz
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-600">Waiting for signal…</span>
                  )
                ) : (
                  activeRefSnapshot ? (
                    <span className="text-[10px] text-zinc-500 truncate">
                      Ref {activeRefSlot}: <span className="text-zinc-300">{activeRefSnapshot.name}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600">No reference</span>
                  )
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="text-[11px] font-mono text-zinc-300 tabular-nums">
                  {hoverInfo ? (
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-200">
                        {formatFreq(hoverInfo.freqHz)}
                        {hoverInfo.note ? ` ${hoverInfo.note}` : ''}
                        {hoverInfo.cents != null ? ` ${hoverInfo.cents >= 0 ? '+' : ''}${hoverInfo.cents}c` : ''}
                      </span>
                      <span className="text-zinc-400">
                        {config.view === 'delta'
                          ? `Δ ${hoverInfo.db >= 0 ? '+' : ''}${hoverInfo.db.toFixed(1)} dB`
                          : `${hoverInfo.db.toFixed(1)} dB`}
                      </span>
                      {config.view !== 'delta' && hoverInfo.deltaDb != null && (
                        <span className="text-zinc-500">
                          Δ {hoverInfo.deltaDb >= 0 ? '+' : ''}{hoverInfo.deltaDb.toFixed(1)} dB
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-600">Hover for readout</span>
                  )}
                </div>
                {/* Peak Ceiling — shown in the card header so it's accessible when expanded fullscreen */}
                <div className="flex items-center gap-1.5 shrink-0 border-l border-[#27272a] pl-3 ml-1">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={specPeakHoldEnabled}
                      onChange={e => {
                        setSpecPeakHoldEnabled(e.target.checked)
                        if (!e.target.checked) resetSpecPeakCeil()
                      }}
                      className="w-3 h-3 accent-amber-400"
                    />
                    <span className="text-[10px] text-zinc-400">Peak Ceil</span>
                  </label>
                  {specPeakHoldEnabled && (
                    <button
                      onClick={resetSpecPeakCeil}
                      className="px-1.5 py-0.5 rounded text-[9px] border border-[#27272a] text-zinc-500 hover:text-white hover:bg-[#27272a] transition-colors"
                      title="Clear peak ceiling"
                    >Clear</button>
                  )}
                </div>
                <button onClick={() => toggleExpand('spectrum')}
                  title={expandedPanel === 'spectrum' ? 'Collapse (Esc)' : 'Expand'}
                  className="ml-2 p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors shrink-0">
                  {expandedPanel === 'spectrum' ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Spectrum canvas */}
            <div
              className="flex-1 relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b] cursor-crosshair min-h-0"
              onMouseMove={handleSpectrumMouseMove}
              onMouseLeave={handleSpectrumMouseLeave}
              onDoubleClick={() => toggleExpand('spectrum')}
            >
              <canvas ref={spectrumCanvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
            </div>
          </div>

          {/* Bottom panel: Levels/Stereo tabs in Mixing mode, dedicated kick panel in Kick Focus mode */}
          <div className={
            expandedPanel === 'bottom'
              ? 'fixed inset-0 z-50 bg-[#09090b] flex flex-col'
              : bottomCollapsed
                ? 'bg-[#111113] rounded-xl border border-[#27272a] flex flex-col shrink-0'
                : 'h-52 bg-[#111113] rounded-xl border border-[#27272a] flex flex-col shrink-0'
          }>
          {analyserTab === 'kick' ? (
            /* ── Kick Focus bottom panel ─────────────────────────────── */
            <>
            <div className="flex items-center border-b border-[#27272a] px-3 py-1.5 shrink-0">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Kick Focus</span>
              <button onClick={() => setBottomCollapsed(s => !s)}
                title={bottomCollapsed ? 'Expand panel' : 'Collapse panel'}
                className="ml-auto p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors">
                {bottomCollapsed ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                )}
              </button>
            </div>
            {!bottomCollapsed && (
            <div className="flex-1 p-3 flex gap-3 min-h-0">
              {/* Oscilloscope */}
              <div className={
                expandedPanel === 'osc'
                  ? 'fixed inset-0 z-50 bg-[#09090b] flex flex-col p-3'
                  : 'w-48 shrink-0 flex flex-col gap-1'
              }>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider">Oscilloscope</span>
                  <button onClick={() => toggleExpand('osc')}
                    title={expandedPanel === 'osc' ? 'Collapse (Esc)' : 'Expand'}
                    className="p-0.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors">
                    {expandedPanel === 'osc' ? (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex-1 relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b]"
                  onDoubleClick={() => toggleExpand('osc')}>
                  <canvas ref={oscCanvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
                </div>
              </div>

              {/* Right: ratios + levels */}
              <div className="flex-1 flex flex-col justify-between min-w-0">
                {/* Zone ratio bars */}
                <div className="flex flex-col gap-2">
                  {meterStats.kickRatios ? (
                    [
                      { key: 'sub'   as const, label: 'Sub',   hz: '20–60 Hz',   color: '#06b6d4' },
                      { key: 'punch' as const, label: 'Punch', hz: '60–150 Hz',  color: '#22c55e' },
                      { key: 'tail'  as const, label: 'Tail',  hz: '150–400 Hz', color: '#f97316' },
                    ].map(it => {
                      const v = meterStats.kickRatios![it.key]
                      const pct = Math.round(clamp(v, 0, 1) * 100)
                      return (
                        <div key={it.key} className="flex items-center gap-2">
                          <div className="w-12 shrink-0">
                            <div className="text-[10px] font-bold" style={{ color: it.color }}>{it.label}</div>
                            <div className="text-[8px] text-zinc-600 font-mono">{it.hz}</div>
                          </div>
                          <div className="flex-1 h-3 rounded bg-[#18181b] overflow-hidden border border-[#27272a]">
                            <div className="h-full rounded transition-all duration-150"
                              style={{ width: `${pct}%`, backgroundColor: it.color + 'cc' }} />
                          </div>
                          <span className="w-8 text-[10px] font-mono font-bold text-right tabular-nums"
                            style={{ color: it.color }}>{pct}%</span>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-xs text-zinc-600">Waiting for signal...</div>
                  )}
                </div>

                {/* Levels row */}
                <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums text-zinc-400 border-t border-[#27272a] pt-2">
                  <span>Peak <span className="text-zinc-200">{formatDb(meterStats.leftPeakDb)} / {formatDb(meterStats.rightPeakDb)}</span></span>
                  <span>RMS <span className="text-zinc-200">{formatDb(meterStats.rmsDb)}</span></span>
                  <span>Crest <span className="text-zinc-200">{meterStats.crestDb.toFixed(1)} dB</span></span>
                </div>
              </div>
            </div>
            )}
            </>
          ) : (
            <>
            <div className="flex items-center border-b border-[#27272a] px-3 shrink-0">
              {(['levels', 'stereo', 'kick'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveBottomTab(tab)}
                  className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    activeBottomTab === tab
                      ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >{tab === 'levels' ? 'Levels' : tab === 'stereo' ? 'Stereo' : 'Kick Focus'}</button>
              ))}

              {activeBottomTab === 'levels' && (
                <div className="ml-auto flex rounded-md overflow-hidden border border-[#27272a]">
                  {(['flat', 'dBA', 'dBC'] as WeightingMode[]).map(w => (
                    <button key={w} onClick={() => setConfig(s => ({ ...s, weightingMode: w }))}
                      className={segBtn(config.weightingMode === w, 'green')}
                    >{w}</button>
                  ))}
                </div>
              )}
              {activeBottomTab === 'stereo' && (
                <div className="ml-auto text-[10px] font-mono text-zinc-500 tabular-nums py-1.5">
                  W {Math.round(clamp(meterStats.width, 0, 1) * 100)}% &middot; Corr {clamp(meterStats.correlation, -1, 1).toFixed(2)}
                </div>
              )}
              {activeBottomTab === 'kick' && (
                <div className="ml-auto text-[10px] font-mono text-zinc-500 tabular-nums py-1.5">
                  {meterStats.kickFundHz != null ? `${formatFreq(meterStats.kickFundHz)} ${meterStats.kickNote ?? ''}`.trim() : '--'}
                </div>
              )}
              <button onClick={() => toggleExpand('bottom')}
                title={expandedPanel === 'bottom' ? 'Collapse (Esc)' : 'Expand'}
                className={`${activeBottomTab === 'kick' ? '' : 'ml-auto'} p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors shrink-0`}>
                {expandedPanel === 'bottom' ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
                  </svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                )}
              </button>
              <button onClick={() => setBottomCollapsed(s => !s)}
                title={bottomCollapsed ? 'Expand panel' : 'Collapse panel'}
                className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-[#27272a] transition-colors shrink-0">
                {bottomCollapsed ? (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6"/></svg>
                ) : (
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                )}
              </button>
            </div>

            {!bottomCollapsed && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className={`h-full p-3 ${activeBottomTab === 'levels' ? 'grid grid-cols-[minmax(0,1fr)_150px] gap-2' : 'hidden'}`}>
                <div className="relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b]">
                  <canvas ref={peakCanvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
                </div>
                <div className="text-[10px] font-mono text-zinc-300 tabular-nums leading-relaxed">
                  <div className="flex items-center justify-between"><span className="text-zinc-500">Peak</span><span>{formatDb(meterStats.leftPeakDb)} / {formatDb(meterStats.rightPeakDb)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-zinc-500">TP</span><span>{meterStats.leftTruePeakDb.toFixed(1)} / {meterStats.rightTruePeakDb.toFixed(1)} dBTP</span></div>
                  <div className="flex items-center justify-between"><span className="text-zinc-500">RMS</span><span>{formatDb(meterStats.rmsDb)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-zinc-500">Crest</span><span>{meterStats.crestDb.toFixed(1)} dB</span></div>
                  <div className="h-px bg-[#27272a] my-1.5" />
                  <div className="flex items-center justify-between"><span className="text-zinc-500">LUFS M</span><span>{formatLufs(meterStats.lufsM)} LUFS</span></div>
                  <div className="flex items-center justify-between"><span className="text-zinc-500">LUFS S</span><span>{formatLufs(meterStats.lufsS)} LUFS</span></div>
                  <div className="flex items-center justify-between"><span className="text-zinc-500">LUFS I</span><span>{formatLufs(meterStats.lufsI)} LUFS</span></div>
                </div>
              </div>

              <div className={`h-full p-3 gap-3 ${activeBottomTab === 'stereo' ? 'flex' : 'hidden'}`}>
                <div className="flex flex-col gap-2 shrink-0 w-36">
                  <div className="h-16 relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b]">
                    <canvas ref={phaseCanvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
                  </div>
                  <div className="flex-1 relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b] min-h-0">
                    <canvas ref={scopeCanvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Band Width</div>
                  <div className="flex-1 overflow-hidden flex flex-col gap-0.5">
                    {stereoBands.length === 0 ? (
                      <div className="text-xs text-zinc-600">Waiting for signal...</div>
                    ) : stereoBands.map(b => {
                      const fill = b.correlation > 0.4 ? '#22c55e' : b.correlation > 0 ? '#f97316' : '#ef4444'
                      return (
                        <div key={b.label} className="flex items-center gap-1.5">
                          <span className="w-11 text-[10px] font-mono text-zinc-400">{b.label}</span>
                          <div className="flex-1 h-1.5 rounded bg-[#18181b] overflow-hidden border border-[#27272a]">
                            <div className="h-full" style={{ width: `${Math.round(clamp(b.width, 0, 1) * 100)}%`, backgroundColor: fill }} />
                          </div>
                          <span className="w-8 text-[9px] font-mono text-zinc-500 text-right tabular-nums">{Math.round(clamp(b.width, 0, 1) * 100)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className={`h-full p-3 ${activeBottomTab === 'kick' ? 'flex flex-col justify-center' : 'hidden'}`}>
                {meterStats.kickRatios ? (
                  <div className="flex flex-col gap-3">
                    {([
                      { key: 'sub' as const, label: 'Sub',   color: '#06b6d4' },
                      { key: 'punch' as const, label: 'Punch', color: '#22c55e' },
                      { key: 'tail' as const, label: 'Tail',  color: '#f97316' },
                    ]).map(it => {
                      const v = meterStats.kickRatios ? meterStats.kickRatios[it.key] : 0
                      return (
                        <div key={it.key} className="flex items-center gap-2">
                          <span className="w-11 text-[10px] font-mono text-zinc-400">{it.label}</span>
                          <div className="flex-1 h-2 rounded bg-[#18181b] overflow-hidden border border-[#27272a]">
                            <div className="h-full" style={{ width: `${Math.round(clamp(v, 0, 1) * 100)}%`, backgroundColor: it.color }} />
                          </div>
                          <span className="w-8 text-[10px] font-mono text-zinc-500 text-right tabular-nums">{Math.round(clamp(v, 0, 1) * 100)}%</span>
                        </div>
                      )
                    })}
                    <div className="text-[10px] text-zinc-600 mt-1">
                      20–60 Hz sub &middot; 60–150 Hz punch &middot; 150–400 Hz tail
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-zinc-600">
                    Waiting for signal...
                  </div>
                )}
              </div>
            </div>
            )}
          </>
          )}
          </div>
        </div>

        {/* Right column: References */}
        <div className="flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">References</span>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  <button onClick={() => setActiveRefSlot('A')}
                    className={segBtn(activeRefSlot === 'A')}
                  >A</button>
                  <button onClick={() => setActiveRefSlot('B')}
                    className={segBtn(activeRefSlot === 'B', 'purple')}
                  >B</button>
                </div>
                <button onClick={captureSnapshot}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-[#27272a] bg-[#18181b] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-colors"
                >Capture</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <div className={`rounded-md border p-1.5 ${activeRefSlot === 'A' ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-[#27272a] bg-[#18181b]'}`}>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Slot A</div>
                <div className="text-xs text-zinc-300 truncate">{refASnapshot?.name ?? 'Empty'}</div>
              </div>
              <div className={`rounded-md border p-1.5 ${activeRefSlot === 'B' ? 'border-purple-500/40 bg-purple-500/10' : 'border-[#27272a] bg-[#18181b]'}`}>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Slot B</div>
                <div className="text-xs text-zinc-300 truncate">{refBSnapshot?.name ?? 'Empty'}</div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-lg border border-[#27272a] bg-[#0a0a0b]">
              <div className="h-full overflow-y-auto">
                {snapshots.length === 0 ? (
                  <div className="p-3 text-xs text-zinc-500">Capture snapshots to create A/B references.</div>
                ) : snapshots.map(s => (
                  <div key={s.id} className="px-2 py-1.5 border-b border-[#27272a]/60 flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-200 truncate">{s.name}</div>
                    </div>
                    <button onClick={() => assignSnapshot(s.id, 'A')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${refAId === s.id ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'}`}
                    >A</button>
                    <button onClick={() => assignSnapshot(s.id, 'B')}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${refBId === s.id ? 'border-purple-500/40 bg-purple-500/15 text-purple-200' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'}`}
                    >B</button>
                    <button onClick={() => deleteSnapshot(s.id)}
                      className="p-0.5 rounded border border-[#27272a] text-zinc-500 hover:text-zinc-200 hover:bg-[#18181b] transition-colors"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* No-data overlay (browser mode only) */}
      {!vstMode && !hasData && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#111113] rounded-2xl border border-[#27272a] p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connect Your VST</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Add the <span className="text-purple-400 font-semibold">Hardwave Analyser</span> plugin to your DAW&apos;s master channel. The analyser will display live data once connected.
            </p>
            <div className="bg-[#18181b] rounded-xl border border-[#27272a] p-4">
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 rounded-full bg-zinc-600 animate-pulse" />
                <span className="text-sm text-zinc-400">Waiting for audio data...</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
