'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AnalyserEngine } from '@/lib/analyser/engine'
import { AnalyserRenderer } from '@/lib/analyser/renderer'
import type {
  AnalyserConfig,
  AudioPacket,
  MeterStats,
  StereoBand,
  Snapshot,
  HoverInfo,
  ResponseTime,
  TiltMode,
  WeightingMode,
  DbRange,
} from '@/lib/analyser/types'
import { DISPLAY_BANDS, SPECTRUM_PAD } from '@/lib/analyser/types'
import { clamp, formatFreq, formatDb, freqToNote, randomId } from '@/lib/analyser/math'

interface AnalyserCanvasProps {
  vstMode?: boolean
}

export function AnalyserCanvas({ vstMode = false }: AnalyserCanvasProps) {
  const [config, setConfig] = useState<AnalyserConfig>({
    spectrumMode: 'peak',
    responseTime: 'medium',
    tiltMode: 'off',
    weightingMode: 'flat',
    frozen: false,
    peakHold: true,
    view: 'spectrum',
    dbRange: 90,
    showAvg: true,
    showRef: true,
    traces: { mix: true, l: false, r: false, m: false, s: false },
  })

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

  // Refs
  const engineRef = useRef<AnalyserEngine | null>(null)
  const rendererRef = useRef<AnalyserRenderer | null>(null)
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const peakCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const latestPacketRef = useRef<AudioPacket | null>(null)
  const configRef = useRef(config)
  const hoverRef = useRef<{ active: boolean; x: number; y: number; band: number } | null>(null)
  const activeRefTraceRef = useRef<Float32Array | null>(null)
  const activeRefNameRef = useRef<string | null>(null)
  const lastStatsRef = useRef(0)

  configRef.current = config

  // Initialize engine + renderer
  useEffect(() => {
    engineRef.current = new AnalyserEngine()
    rendererRef.current = new AnalyserRenderer()
  }, [])

  // Register global callback for VST data injection
  useEffect(() => {
    const handler = (packet: AudioPacket) => {
      latestPacketRef.current = packet
      if (!hasData) setHasData(true)
    }

    // The VST (wry) calls window.__onAudioPacket({...})
    ;(window as any).__onAudioPacket = handler
    return () => {
      delete (window as any).__onAudioPacket
    }
  }, [hasData])

  // Keep active ref trace in sync
  useEffect(() => {
    const activeId = activeRefSlot === 'A' ? refAId : refBId
    const snap = activeId ? snapshots.find(s => s.id === activeId) : null
    activeRefTraceRef.current = snap ? snap.trace : null
    activeRefNameRef.current = snap ? snap.name : null
  }, [snapshots, refAId, refBId, activeRefSlot])

  // Main render loop
  useEffect(() => {
    const loop = () => {
      const engine = engineRef.current
      const renderer = rendererRef.current
      if (!engine || !renderer) {
        animationRef.current = requestAnimationFrame(loop)
        return
      }

      // Process latest packet
      const packet = latestPacketRef.current
      if (packet) {
        engine.processPacket(packet, configRef.current)
        latestPacketRef.current = null
      }

      // Draw canvases
      if (spectrumCanvasRef.current) {
        renderer.drawSpectrum(
          spectrumCanvasRef.current,
          engine,
          configRef.current,
          activeRefTraceRef.current,
          activeRefNameRef.current,
          hoverRef.current,
        )
      }
      if (phaseCanvasRef.current) {
        renderer.drawPhase(phaseCanvasRef.current, engine.meters.correlation)
      }
      if (peakCanvasRef.current) {
        renderer.drawPeakMeters(peakCanvasRef.current, engine, configRef.current.peakHold)
      }
      if (scopeCanvasRef.current) {
        renderer.drawScope(scopeCanvasRef.current)
      }

      // Update React state at lower rate
      const now = performance.now()
      if (now - lastStatsRef.current > 150) {
        lastStatsRef.current = now
        setMeterStats({ ...engine.meters })
        setStereoBands([...engine.stereoBands])
      }

      animationRef.current = requestAnimationFrame(loop)
    }

    animationRef.current = requestAnimationFrame(loop)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Handlers
  const handleSpectrumMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = clamp(e.clientX - rect.left, 0, rect.width)
    const y = clamp(e.clientY - rect.top, 0, rect.height)
    const plotW = Math.max(1, rect.width - SPECTRUM_PAD.left - SPECTRUM_PAD.right)
    const xPlot = clamp(x - SPECTRUM_PAD.left, 0, plotW)
    const band = clamp(Math.round((xPlot / plotW) * (DISPLAY_BANDS - 1)), 0, DISPLAY_BANDS - 1)
    hoverRef.current = { active: true, x, y, band }

    const engine = engineRef.current
    if (engine) {
      const freq = engine.bandFreqs[band]
      const note = freqToNote(freq)
      const mix = engine.traces.mix
      const ref = activeRefTraceRef.current
      const baseDb = mix[band]
      const delta = ref ? (baseDb - ref[band]) : null
      const db = configRef.current.view === 'delta' ? (delta ?? 0) : baseDb

      setHoverInfo({
        freqHz: freq,
        db,
        note: note?.note ?? null,
        cents: note?.cents ?? null,
        deltaDb: configRef.current.view === 'delta' ? null : delta,
      })
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

  const resetMeters = useCallback(() => {
    engineRef.current?.reset()
  }, [])

  const formatLufs = (value: number | null): string => {
    if (value == null || !Number.isFinite(value)) return '--'
    return value.toFixed(1)
  }

  const activeRefId = activeRefSlot === 'A' ? refAId : refBId
  const activeRefSnapshot = activeRefId ? snapshots.find(s => s.id === activeRefId) : null
  const refASnapshot = refAId ? snapshots.find(s => s.id === refAId) : null
  const refBSnapshot = refBId ? snapshots.find(s => s.id === refBId) : null

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0b] overflow-hidden h-full">
      {/* Toolbar */}
      <div className="h-12 bg-[#111113] border-b border-[#27272a]/50 flex items-center px-4 gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <span className="text-xs font-bold text-white">Analyser</span>
        </div>

        <div className="flex-1" />

        {/* Data status */}
        <div className={`px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1.5 ${hasData ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasData ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
          {hasData ? 'Receiving' : 'Waiting for data...'}
        </div>

        {/* Freeze */}
        <button
          onClick={() => setConfig(s => ({ ...s, frozen: !s.frozen }))}
          className={`px-2 py-1 rounded-md text-[10px] font-medium ${config.frozen ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[#18181b] text-zinc-400 hover:bg-[#27272a]'}`}
        >
          Freeze
        </button>

        {/* Reset */}
        <button
          onClick={resetMeters}
          className="px-2 py-1 rounded-md text-[10px] font-medium bg-[#18181b] text-zinc-400 hover:bg-[#27272a] hover:text-white"
        >
          Reset
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-[minmax(0,1fr)_280px] grid-rows-[1fr] gap-3 overflow-hidden p-3">
        {/* Left column */}
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
          {/* Spectrum */}
          <div className="flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Spectrum</span>
                {activeRefSnapshot ? (
                  <span className="text-[10px] text-zinc-500 truncate">
                    Ref {activeRefSlot}: <span className="text-zinc-300">{activeRefSnapshot.name}</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-600">No reference</span>
                )}
              </div>

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
                        ? `\u0394 ${hoverInfo.db >= 0 ? '+' : ''}${hoverInfo.db.toFixed(1)} dB`
                        : `${hoverInfo.db.toFixed(1)} dB`}
                    </span>
                    {config.view !== 'delta' && hoverInfo.deltaDb != null && (
                      <span className="text-zinc-500">
                        \u0394 {hoverInfo.deltaDb >= 0 ? '+' : ''}{hoverInfo.deltaDb.toFixed(1)} dB
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-600">Hover for readout</span>
                )}
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Mode */}
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  <button
                    onClick={() => setConfig(s => ({ ...s, spectrumMode: 'peak' }))}
                    className={`px-2 py-0.5 text-[10px] font-medium ${config.spectrumMode === 'peak' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >Peak</button>
                  <button
                    onClick={() => setConfig(s => ({ ...s, spectrumMode: 'rms' }))}
                    className={`px-2 py-0.5 text-[10px] font-medium ${config.spectrumMode === 'rms' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >RMS</button>
                </div>

                {/* Response */}
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  {(['fast', 'medium', 'slow'] as ResponseTime[]).map(rt => (
                    <button key={rt} onClick={() => setConfig(s => ({ ...s, responseTime: rt }))}
                      className={`px-2 py-0.5 text-[10px] font-medium capitalize ${config.responseTime === rt ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >{rt}</button>
                  ))}
                </div>

                {/* Tilt */}
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  {(['off', '-3dB', '-4.5dB'] as TiltMode[]).map(tilt => (
                    <button key={tilt} onClick={() => setConfig(s => ({ ...s, tiltMode: tilt }))}
                      className={`px-2 py-0.5 text-[10px] font-medium ${config.tiltMode === tilt ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >{tilt === 'off' ? 'Flat' : tilt}</button>
                  ))}
                </div>

                {/* Peak Hold */}
                <button
                  onClick={() => setConfig(s => ({ ...s, peakHold: !s.peakHold }))}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${config.peakHold ? 'border-yellow-500/50 bg-yellow-500/20 text-yellow-400' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'}`}
                >Hold</button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* View */}
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  <button onClick={() => setConfig(s => ({ ...s, view: 'spectrum' }))}
                    className={`px-2 py-0.5 text-[10px] font-medium ${config.view === 'spectrum' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >Spec</button>
                  <button onClick={() => setConfig(s => ({ ...s, view: 'delta' }))}
                    className={`px-2 py-0.5 text-[10px] font-medium ${config.view === 'delta' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >\u0394</button>
                </div>

                {/* dB Range */}
                <div className={`flex rounded-md overflow-hidden border border-[#27272a] ${config.view === 'delta' ? 'opacity-40' : ''}`}>
                  {([60, 90, 120] as DbRange[]).map(r => (
                    <button key={r} onClick={() => setConfig(s => ({ ...s, dbRange: r }))} disabled={config.view === 'delta'}
                      className={`px-2 py-0.5 text-[10px] font-medium ${config.dbRange === r ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'} disabled:hover:text-zinc-500`}
                    >{r}</button>
                  ))}
                </div>

                {/* Overlays */}
                <button onClick={() => setConfig(s => ({ ...s, showAvg: !s.showAvg }))}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${config.showAvg ? 'border-green-500/40 bg-green-500/15 text-green-300' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'}`}
                >Avg</button>
                <button onClick={() => setConfig(s => ({ ...s, showRef: !s.showRef }))}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${config.showRef ? 'border-slate-500/40 bg-slate-500/15 text-slate-200' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'}`}
                >Ref</button>

                {/* Traces */}
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  {(['mix', 'l', 'r', 'm', 's'] as const).map(id => {
                    const colors: Record<string, string> = { mix: 'cyan', l: 'cyan', r: 'purple', m: 'green', s: 'orange' }
                    const c = colors[id]
                    return (
                      <button key={id}
                        onClick={() => setConfig(s => ({ ...s, traces: { ...s.traces, [id]: !s.traces[id] } }))}
                        className={`px-2 py-0.5 text-[10px] font-medium ${config.traces[id] ? `bg-${c}-500/20 text-${c}-300` : 'text-zinc-500 hover:text-zinc-300'}`}
                      >{id.toUpperCase()}</button>
                    )
                  })}
                </div>

                {/* Capture */}
                <button onClick={captureSnapshot}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-[#27272a] bg-[#18181b] text-zinc-300 hover:bg-[#27272a] hover:text-white"
                  title={`Capture snapshot to slot ${activeRefSlot}`}
                >Cap {activeRefSlot}</button>
              </div>
            </div>

            {/* Spectrum canvas */}
            <div
              className="flex-1 relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b] cursor-crosshair min-h-0"
              onMouseMove={handleSpectrumMouseMove}
              onMouseLeave={handleSpectrumMouseLeave}
            >
              <canvas ref={spectrumCanvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
            </div>
          </div>

          {/* Bottom tabs: Levels / Stereo / Kick Focus */}
          <div className="h-52 bg-[#111113] rounded-xl border border-[#27272a] flex flex-col shrink-0">
            {/* Tab bar */}
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
                      className={`px-2 py-0.5 text-[10px] font-medium ${config.weightingMode === w ? 'bg-green-500/20 text-green-400' : 'text-zinc-500 hover:text-zinc-300'}`}
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
            </div>

            {/* Tab content — all panels stay mounted so canvas refs remain valid */}
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
                    ) : (
                      stereoBands.map(b => {
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
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className={`h-full p-3 ${activeBottomTab === 'kick' ? 'flex flex-col justify-center' : 'hidden'}`}>
                {meterStats.kickRatios ? (
                  <div className="flex flex-col gap-3">
                    {([
                      { key: 'sub' as const, label: 'Sub', color: '#06b6d4' },
                      { key: 'punch' as const, label: 'Punch', color: '#22c55e' },
                      { key: 'tail' as const, label: 'Tail', color: '#f97316' },
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
                      20–60Hz sub &middot; 60–150Hz punch &middot; 150–400Hz tail
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-zinc-600">
                    Waiting for signal...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: References */}
        <div className="flex flex-col min-w-0 overflow-hidden">
          {/* References */}
          <div className="flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-3 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">References</span>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-md overflow-hidden border border-[#27272a]">
                  <button onClick={() => setActiveRefSlot('A')}
                    className={`px-2 py-0.5 text-[10px] font-medium ${activeRefSlot === 'A' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >A</button>
                  <button onClick={() => setActiveRefSlot('B')}
                    className={`px-2 py-0.5 text-[10px] font-medium ${activeRefSlot === 'B' ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >B</button>
                </div>
                <button onClick={captureSnapshot}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-[#27272a] bg-[#18181b] text-zinc-300 hover:bg-[#27272a] hover:text-white"
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
                ) : (
                  snapshots.map(s => (
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
                        className="p-0.5 rounded border border-[#27272a] text-zinc-500 hover:text-zinc-200 hover:bg-[#18181b]"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  ))
                )}
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
              Add the <span className="text-purple-400 font-semibold">Hardwave Bridge</span> plugin to your DAW&apos;s master channel. The analyser will display live data once connected.
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
