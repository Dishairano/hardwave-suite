import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from '../lib/api'
import * as automix from '../lib/automix'
import type { StemAnalysis, StemMixSettings, AutoMixSession, StemType, MixGenre } from '../lib/automix'
import { Upload, Download, RotateCcw, ChevronDown } from 'lucide-react'

interface AutoMixViewProps {
  user: User
}

// ─── Knob (inline, simplified from LoudLab) ───────────────────────────────

function MiniKnob({ value, min, max, label, unit, onChange, color, size = 32 }: {
  value: number; min: number; max: number; label: string; unit?: string
  onChange: (v: number) => void; color?: string; size?: number
}) {
  const knobRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startVal = useRef(0)

  const norm = (value - min) / (max - min)
  const angle = -135 + norm * 270
  const c = color ?? '#ef4444'

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    startY.current = e.clientY
    startVal.current = value
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const dy = startY.current - e.clientY
    const sensitivity = e.shiftKey ? 2000 : 200
    const newVal = Math.min(max, Math.max(min, startVal.current + (dy / sensitivity) * (max - min)))
    onChange(newVal)
  }
  const onPointerUp = () => { dragging.current = false }
  const onDoubleClick = () => onChange((min + max) / 2)

  return (
    <div className="flex flex-col items-center gap-0.5 select-none" style={{ width: size + 16 }}>
      <div
        ref={knobRef}
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <svg viewBox="0 0 40 40" width={size} height={size}>
          <circle cx="20" cy="20" r="16" fill="#1a1a22" stroke="#2a2a35" strokeWidth="1.5" />
          <path
            d={describeArc(20, 20, 13, -135, angle)}
            fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"
          />
          <line
            x1="20" y1="20"
            x2={20 + 9 * Math.cos((angle - 90) * Math.PI / 180)}
            y2={20 + 9 * Math.sin((angle - 90) * Math.PI / 180)}
            stroke="#ddd" strokeWidth="1.5" strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="text-[8px] text-zinc-500 leading-none truncate w-full text-center">{label}</span>
      <span className="text-[9px] text-zinc-300 font-mono leading-none tabular-nums">
        {value.toFixed(1)}{unit ?? ''}
      </span>
    </div>
  )
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = (startAngle - 90) * Math.PI / 180
  const e = (endAngle - 90) * Math.PI / 180
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s)
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

// ─── Spectral Profile Bar ──────────────────────────────────────────────────

function SpectralBars({ profile, color }: { profile: number[]; color: string }) {
  const min = -80, max = 0
  return (
    <div className="flex items-end gap-px h-8">
      {profile.map((db, i) => {
        const h = Math.max(1, ((db - min) / (max - min)) * 100)
        return <div key={i} className="rounded-t-sm" style={{
          width: 3, height: `${h}%`, background: color, opacity: 0.6 + (h / 100) * 0.4,
        }} />
      })}
    </div>
  )
}

// ─── Stem Row ──────────────────────────────────────────────────────────────

function StemRow({ stem, settings, onUpdate, onUpdateType }: {
  stem: StemAnalysis
  settings: StemMixSettings
  onUpdate: (field: string, value: number) => void
  onUpdateType: (type: StemType) => void
}) {
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const c = automix.stemColor(stem.stem_type)

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
      settings.mute ? 'opacity-40 border-white/[0.03] bg-white/[0.01]' : 'border-white/[0.06] bg-white/[0.02]'
    }`}>
      {/* Stem type badge */}
      <div className="relative">
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border transition-colors"
          style={{ borderColor: c + '40', color: c, background: c + '15' }}
        >
          {stem.stem_type}
          <ChevronDown size={10} />
        </button>
        {showTypeMenu && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-[#18181b] border border-white/10 rounded-lg shadow-xl p-1 min-w-[100px]">
            {automix.STEM_TYPES.map(t => (
              <button
                key={t}
                onClick={() => { onUpdateType(t); setShowTypeMenu(false) }}
                className="block w-full text-left px-2 py-1 text-[10px] rounded hover:bg-white/10 transition-colors"
                style={{ color: automix.stemColor(t) }}
              >{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* File name */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-zinc-200 truncate font-medium">{stem.file_name}</div>
        <div className="flex gap-3 text-[9px] text-zinc-500 mt-0.5 font-mono">
          <span>{stem.duration_secs.toFixed(1)}s</span>
          <span>{stem.lufs.toFixed(1)} LUFS</span>
          <span>{stem.peak_db.toFixed(1)} dBFS</span>
          <span>{(stem.sample_rate / 1000).toFixed(1)}k</span>
          <span>{stem.channels === 2 ? 'Stereo' : 'Mono'}</span>
        </div>
      </div>

      {/* Spectral profile */}
      <div className="w-[100px] flex-shrink-0">
        <SpectralBars profile={stem.spectral_profile} color={c} />
      </div>

      {/* Mix controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <MiniKnob value={settings.gain_db} min={-18} max={18} label="Gain" unit="dB"
          color={c} onChange={v => onUpdate('gain_db', v)} />
        <MiniKnob value={settings.pan} min={-1} max={1} label="Pan" unit=""
          color={c} onChange={v => onUpdate('pan', v)} />
        <MiniKnob value={settings.eq_low_db} min={-12} max={12} label="Low" unit="dB"
          color="#22c55e" onChange={v => onUpdate('eq_low_db', v)} />
        <MiniKnob value={settings.eq_mid_db} min={-12} max={12} label="Mid" unit="dB"
          color="#eab308" onChange={v => onUpdate('eq_mid_db', v)} />
        <MiniKnob value={settings.eq_high_db} min={-12} max={12} label="High" unit="dB"
          color="#06b6d4" onChange={v => onUpdate('eq_high_db', v)} />
        <MiniKnob value={settings.width} min={0} max={2} label="Width" unit=""
          color="#8b5cf6" onChange={v => onUpdate('width', v)} />
      </div>

      {/* Mute / Solo */}
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => onUpdate('mute', settings.mute ? 0 : 1)}
          className="w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center border transition-all"
          style={settings.mute
            ? { borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239,68,68,.15)' }
            : { borderColor: '#333', color: '#555' }}
        >M</button>
        <button
          onClick={() => onUpdate('solo', settings.solo ? 0 : 1)}
          className="w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center border transition-all"
          style={settings.solo
            ? { borderColor: '#eab308', color: '#eab308', background: 'rgba(234,179,8,.15)' }
            : { borderColor: '#333', color: '#555' }}
        >S</button>
      </div>
    </div>
  )
}

// ─── Main View ─────────────────────────────────────────────────────────────

export function AutoMixView({ user: _user }: AutoMixViewProps) {
  const [session, setSession] = useState<AutoMixSession | null>(null)
  const [genre, setGenre] = useState<MixGenre>('Hardstyle')
  const [targetLufs, setTargetLufs] = useState(-8)
  const [progress, setProgress] = useState<automix.AutoMixProgress | null>(null)
  const [rendering, setRendering] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const unlistenRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    automix.onProgress((p) => {
      setProgress(p)
      if (p.stage === 'done') {
        setTimeout(() => setProgress(null), 2000)
      }
    }).then(u => { unlistenRef.current = u })
    return () => { unlistenRef.current?.() }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const wavFiles = files.filter(f => /\.(wav|wave)$/i.test(f.name))
    if (wavFiles.length === 0) return

    const paths = wavFiles.map(f => (f as any).path as string).filter(Boolean)
    if (paths.length === 0) return

    try {
      const result = await automix.analyze(paths, genre, targetLufs)
      setSession(result)
    } catch (err) {
      console.error('AutoMix analysis failed:', err)
    }
  }, [genre, targetLufs])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFilePick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const paths = Array.from(files).filter(f => /\.(wav|wave)$/i.test(f.name)).map(f => (f as any).path as string).filter(Boolean)
    if (paths.length === 0) return
    try {
      const result = await automix.analyze(paths, genre, targetLufs)
      setSession(result)
    } catch (err) {
      console.error('File pick failed:', err)
    }
    // Reset input so same files can be re-selected
    e.target.value = ''
  }, [genre, targetLufs])

  const handleUpdateSetting = useCallback(async (stemId: string, field: string, value: number) => {
    try {
      await automix.updateSetting(stemId, field, value)
      setSession(prev => {
        if (!prev) return prev
        return {
          ...prev,
          mix_settings: prev.mix_settings.map(s =>
            s.id === stemId ? { ...s, [field]: field === 'mute' || field === 'solo' ? value > 0.5 : value } : s
          ),
        }
      })
    } catch (err) {
      console.error('Update failed:', err)
    }
  }, [])

  const handleUpdateType = useCallback(async (stemId: string, type: StemType) => {
    try {
      await automix.updateStemType(stemId, type)
      // Refresh session to get recomputed settings
      const updated = await automix.getSession()
      if (updated) setSession(updated)
    } catch (err) {
      console.error('Type update failed:', err)
    }
  }, [])

  const handleRender = useCallback(async () => {
    // Render to user's Downloads folder
    const downloadsPath = await automix.getDefaultRenderPath()
    if (!downloadsPath) return
    setRendering(true)
    try {
      await automix.render(downloadsPath)
    } catch (err) {
      console.error('Render failed:', err)
    }
    setRendering(false)
  }, [])

  const handleReset = useCallback(() => {
    setSession(null)
    setProgress(null)
  }, [])

  // ─── Empty state (drop zone) ──────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        {/* Genre + target LUFS selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Genre</span>
            <div className="flex gap-1">
              {automix.MIX_GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className="px-2.5 py-1 rounded-md text-[10px] font-medium border transition-all"
                  style={genre === g
                    ? { borderColor: 'rgba(239,68,68,.5)', color: '#ef4444', background: 'rgba(239,68,68,.1)' }
                    : { borderColor: 'rgba(255,255,255,.06)', color: '#71717a' }}
                >{g}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Target</span>
            <input
              type="range" min={-14} max={-4} step={0.5} value={targetLufs}
              onChange={e => setTargetLufs(Number(e.target.value))}
              className="w-20 accent-red-500"
            />
            <span className="text-[10px] text-zinc-300 font-mono w-16">{targetLufs} LUFS</span>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={handleFilePick}
          className={`w-full max-w-xl aspect-[2/1] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            dragOver
              ? 'border-red-500 bg-red-500/5 scale-[1.02]'
              : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]'
          }`}
        >
          <Upload size={32} className={dragOver ? 'text-red-500' : 'text-zinc-500'} />
          <div className="text-center">
            <div className="text-sm text-zinc-300">Drop WAV stems here</div>
            <div className="text-xs text-zinc-500 mt-1">or click to browse</div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".wav,.wave"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {progress && (
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            {progress.message}
          </div>
        )}
      </div>
    )
  }

  // ─── Session view (mixer) ─────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.06] bg-[#08080c] flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[11px] font-medium text-zinc-300">{session.stems.length} stems</span>
          <span className="text-[10px] text-zinc-600">|</span>
          <span className="text-[10px] text-zinc-500">{genre}</span>
          <span className="text-[10px] text-zinc-600">|</span>
          <span className="text-[10px] text-zinc-500">{targetLufs} LUFS target</span>
        </div>

        {progress && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            {progress.message}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRender}
            disabled={rendering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            <Download size={12} />
            {rendering ? 'Rendering...' : 'Export Mix'}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[9px] text-zinc-600 uppercase tracking-wider border-b border-white/[0.03] flex-shrink-0">
        <div className="w-[72px]">Type</div>
        <div className="flex-1">Stem</div>
        <div className="w-[100px]">Spectrum</div>
        <div className="w-[310px] text-center">Mix Controls</div>
        <div className="w-[56px] text-center">M / S</div>
      </div>

      {/* Stem list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {session.stems.map((stem, i) => {
          const settings = session.mix_settings[i]
          if (!settings) return null
          return (
            <StemRow
              key={stem.id}
              stem={stem}
              settings={settings}
              onUpdate={(field, value) => handleUpdateSetting(stem.id, field, value)}
              onUpdateType={(type) => handleUpdateType(stem.id, type)}
            />
          )
        })}
      </div>
    </div>
  )
}
