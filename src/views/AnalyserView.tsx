import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Snowflake,
  Volume2,
  Gauge,
  Activity,
  Check,
  Mic,
  ChevronDown,
  Plug,
  Camera,
  Eye,
  EyeOff,
  Trash2,
  X,
} from 'lucide-react'
import { useVstAudio } from '../hooks/useVstAudio'
import {
  clamp,
  dbToPower,
  powerToDb,
  formatFreq,
  formatDb,
  freqToNote,
  generateLogTicks,
  lerp,
  randomId,
} from '../lib/analyserMath'

// Types
type ResponseTime = 'fast' | 'medium' | 'slow'
type TiltMode = 'off' | '-3dB' | '-4.5dB'
type WeightingMode = 'flat' | 'dBA' | 'dBC'
type SpectrumMode = 'peak' | 'rms'
type AudioSource = 'mic' | 'vst'
type SpectrumView = 'spectrum' | 'delta'
type DbRange = 60 | 90 | 120

type TraceId = 'mix' | 'l' | 'r' | 'm' | 's'

type TraceToggles = Record<TraceId, boolean>

interface AnalyserState {
  spectrumMode: SpectrumMode
  responseTime: ResponseTime
  tiltMode: TiltMode
  weightingMode: WeightingMode
  frozen: boolean
  peakHold: boolean
  audioSource: AudioSource
  view: SpectrumView
  dbRange: DbRange
  showAvg: boolean
  showRef: boolean
  traces: TraceToggles
}

interface AnalyserViewProps {
  onBack: () => void
}

// Constants
const FFT_SIZE = 8192
const DISPLAY_BANDS = 256
const VST_BANDS = 64
const MIN_FREQ = 20
const MAX_FREQ = 20000
const SMOOTHING_FAST = 0.6
const SMOOTHING_MEDIUM = 0.8
const SMOOTHING_SLOW = 0.92
const SPECTRUM_PAD = { left: 44, right: 14, top: 10, bottom: 20 } as const

// A-weighting coefficients (simplified)
const getAWeighting = (freq: number): number => {
  const f2 = freq * freq
  const f4 = f2 * f2
  const num = 12194 * 12194 * f4
  const den = (f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194)
  return 2.0 + 20 * Math.log10(num / den + 1e-10)
}

// C-weighting coefficients (simplified)
const getCWeighting = (freq: number): number => {
  const f2 = freq * freq
  const num = 12194 * 12194 * f2
  const den = (f2 + 20.6 * 20.6) * (f2 + 12194 * 12194)
  return 0.06 + 20 * Math.log10(num / den + 1e-10)
}

type Snapshot = {
  id: string
  name: string
  createdAt: number
  trace: Float32Array // mix trace in dB
}

type HoverInfo = {
  freqHz: number
  db: number
  note: string | null
  cents: number | null
  deltaDb: number | null
}

type MeterStats = {
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

type StereoBand = {
  label: string
  lowHz: number
  highHz: number
  correlation: number
  width: number
}

export function AnalyserView({ onBack }: AnalyserViewProps) {
  // State
  const [state, setState] = useState<AnalyserState>({
    spectrumMode: 'peak',
    responseTime: 'medium',
    tiltMode: 'off',
    weightingMode: 'flat',
    frozen: false,
    peakHold: true,
    audioSource: 'mic',
    view: 'spectrum',
    dbRange: 90,
    showAvg: true,
    showRef: true,
    traces: { mix: true, l: false, r: false, m: false, s: false },
  })

  // VST audio hook
  const [vstState, vstActions] = useVstAudio(50, false)

  const [isRunning, setIsRunning] = useState(false)
  const [hasAudioPermission, setHasAudioPermission] = useState(false)
  const [copied, setCopied] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [showDeviceSelector, setShowDeviceSelector] = useState(false)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null)
  const [meterStats, setMeterStats] = useState<MeterStats>({
    leftPeakDb: -100,
    rightPeakDb: -100,
    leftTruePeakDb: -100,
    rightTruePeakDb: -100,
    rmsDb: -100,
    crestDb: 0,
    correlation: 0,
    width: 0,
    dcOffsetL: 0,
    dcOffsetR: 0,
    lufsM: null,
    lufsS: null,
    lufsI: null,
    kickFundHz: null,
    kickNote: null,
    kickRatios: null,
  })
  const [stereoBands, setStereoBands] = useState<StereoBand[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [refAId, setRefAId] = useState<string | null>(null)
  const [refBId, setRefBId] = useState<string | null>(null)
  const [activeRefSlot, setActiveRefSlot] = useState<'A' | 'B'>('A')

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserLeftRef = useRef<AnalyserNode | null>(null)
  const analyserRightRef = useRef<AnalyserNode | null>(null)
  const splitterRef = useRef<ChannelSplitterNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const silentGainRef = useRef<GainNode | null>(null)
  const loudnessAnalyserRef = useRef<AnalyserNode | null>(null)

  // Canvas refs
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const peakCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Data refs
  const spectrumTracesRef = useRef<Record<TraceId, Float32Array>>({
    mix: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    l: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    r: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    m: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    s: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
  })
  const spectrumPeakRef = useRef<Record<TraceId, Float32Array>>({
    mix: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    l: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    r: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    m: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
    s: (() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })(),
  })
  const peakDecayRef = useRef<Record<TraceId, Float32Array>>({
    mix: new Float32Array(DISPLAY_BANDS),
    l: new Float32Array(DISPLAY_BANDS),
    r: new Float32Array(DISPLAY_BANDS),
    m: new Float32Array(DISPLAY_BANDS),
    s: new Float32Array(DISPLAY_BANDS),
  })
  const spectrumAvgRef = useRef<Float32Array>((() => { const a = new Float32Array(DISPLAY_BANDS); a.fill(-100); return a })())
  const logTicksRef = useRef(generateLogTicks(MIN_FREQ, MAX_FREQ))
  const bandFreqsRef = useRef<Float32Array>((() => {
    const a = new Float32Array(DISPLAY_BANDS)
    const logMin = Math.log10(MIN_FREQ)
    const logMax = Math.log10(MAX_FREQ)
    for (let i = 0; i < DISPLAY_BANDS; i++) {
      const t = (i + 0.5) / DISPLAY_BANDS
      a[i] = Math.pow(10, logMin + t * (logMax - logMin))
    }
    return a
  })())
  const bandBinStartRef = useRef<Int32Array>(new Int32Array(DISPLAY_BANDS))
  const bandBinEndRef = useRef<Int32Array>(new Int32Array(DISPLAY_BANDS))
  const midPowerRef = useRef<Float32Array>(new Float32Array(DISPLAY_BANDS))
  const sidePowerRef = useRef<Float32Array>(new Float32Array(DISPLAY_BANDS))
  const hoverRef = useRef<{ active: boolean; x: number; y: number; band: number } | null>(null)
  const hoverRafRef = useRef<number | null>(null)
  const lastStatsUpdateRef = useRef(0)
  const leftPeakRef = useRef(0)
  const rightPeakRef = useRef(0)
  const leftRmsRef = useRef(0)
  const rightRmsRef = useRef(0)
  const leftPeakHoldRef = useRef(0)
  const rightPeakHoldRef = useRef(0)
  const phaseCorrelationRef = useRef(0)
  const stereoWidthRef = useRef(0.5)
  const clipLeftRef = useRef(false)
  const clipRightRef = useRef(false)
  const dcOffsetLeftRef = useRef(0)
  const dcOffsetRightRef = useRef(0)
  const truePeakLeftRef = useRef(-100)
  const truePeakRightRef = useRef(-100)
  const lufsMomentaryRef = useRef<number | null>(null)
  const lufsShortRef = useRef<number | null>(null)
  const lufsIntegratedRef = useRef<number | null>(null)
  const loudnessHistoryRef = useRef<Array<{ t: number; ms: number }>>([])
  const loudnessIntegratedRef = useRef<{ sum: number; count: number }>({ sum: 0, count: 0 })
  const kickFundHzRef = useRef<number | null>(null)
  const kickNoteRef = useRef<string | null>(null)
  const kickRatiosRef = useRef<{ sub: number; punch: number; tail: number } | null>(null)
  const activeRefTraceRef = useRef<Float32Array | null>(null)
  const activeRefNameRef = useRef<string | null>(null)
  const scopeLeftTimeRef = useRef<Float32Array | null>(null)
  const scopeRightTimeRef = useRef<Float32Array | null>(null)
  const drawSpectrumRef = useRef<() => void>(() => {})
  const drawPhaseRef = useRef<() => void>(() => {})
  const drawPeakMetersRef = useRef<() => void>(() => {})
  const drawScopeRef = useRef<() => void>(() => {})

  // Get smoothing factor based on response time
  const getSmoothingFactor = useCallback(() => {
    switch (state.responseTime) {
      case 'fast': return SMOOTHING_FAST
      case 'medium': return SMOOTHING_MEDIUM
      case 'slow': return SMOOTHING_SLOW
    }
  }, [state.responseTime])

  // Enumerate audio input devices
  const refreshDevices = useCallback(async () => {
    try {
      // Request permission first to get device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      setAudioDevices(audioInputs)

      // Select first device if none selected
      if (!selectedDeviceId && audioInputs.length > 0) {
        setSelectedDeviceId(audioInputs[0].deviceId)
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
    }
  }, [selectedDeviceId])

  // Initialize audio with selected device
  const initAudio = useCallback(async (deviceId?: string) => {
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioContextRef.current) {
        await audioContextRef.current.close()
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      streamRef.current = stream
      setHasAudioPermission(true)

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      sourceRef.current = source

      // Create channel splitter for stereo analysis
      const splitter = audioContext.createChannelSplitter(2)
      splitterRef.current = splitter

      // Create analysers for left and right channels
      const analyserLeft = audioContext.createAnalyser()
      analyserLeft.fftSize = FFT_SIZE
      analyserLeft.minDecibels = -120
      analyserLeft.maxDecibels = 0
      analyserLeft.smoothingTimeConstant = getSmoothingFactor()
      analyserLeftRef.current = analyserLeft

      const analyserRight = audioContext.createAnalyser()
      analyserRight.fftSize = FFT_SIZE
      analyserRight.minDecibels = -120
      analyserRight.maxDecibels = 0
      analyserRight.smoothingTimeConstant = getSmoothingFactor()
      analyserRightRef.current = analyserRight

      // Connect nodes
      source.connect(splitter)
      splitter.connect(analyserLeft, 0)
      splitter.connect(analyserRight, 1)

      // Keep the graph "alive" (some browsers won't process if nothing reaches the destination).
      // This is silent, so it won't feed back into speakers.
      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      silentGain.connect(audioContext.destination)
      silentGainRef.current = silentGain

      analyserLeft.connect(silentGain)
      analyserRight.connect(silentGain)

      // Loudness (approx LUFS): mid sum -> K-weighting-ish filters -> analyser -> silent sink.
      const midGain = audioContext.createGain()
      midGain.gain.value = 0.5
      splitter.connect(midGain, 0)
      splitter.connect(midGain, 1)

      const kHighpass = audioContext.createBiquadFilter()
      kHighpass.type = 'highpass'
      kHighpass.frequency.value = 60
      kHighpass.Q.value = 0.707

      const kShelf = audioContext.createBiquadFilter()
      kShelf.type = 'highshelf'
      kShelf.frequency.value = 4000
      kShelf.gain.value = 4

      const loudnessAnalyser = audioContext.createAnalyser()
      loudnessAnalyser.fftSize = 2048
      loudnessAnalyser.smoothingTimeConstant = 0
      loudnessAnalyserRef.current = loudnessAnalyser

      midGain.connect(kHighpass)
      kHighpass.connect(kShelf)
      kShelf.connect(loudnessAnalyser)
      loudnessAnalyser.connect(silentGain)

      // Precompute bin ranges for log-spaced display bands (depends on sample rate).
      const binCount = analyserLeft.frequencyBinCount
      const logMin = Math.log10(MIN_FREQ)
      const logMax = Math.log10(MAX_FREQ)
      for (let i = 0; i < DISPLAY_BANDS; i++) {
        const t0 = i / DISPLAY_BANDS
        const t1 = (i + 1) / DISPLAY_BANDS
        const f0 = Math.pow(10, logMin + t0 * (logMax - logMin))
        const f1 = Math.pow(10, logMin + t1 * (logMax - logMin))

        const b0 = clamp(Math.floor(freqToBin(f0, audioContext.sampleRate, analyserLeft.fftSize)), 0, binCount - 1)
        const b1 = clamp(Math.ceil(freqToBin(f1, audioContext.sampleRate, analyserLeft.fftSize)), b0, binCount - 1)
        bandBinStartRef.current[i] = b0
        bandBinEndRef.current[i] = b1
      }

      setIsRunning(true)

    } catch (err) {
      console.error('Failed to get audio permission:', err)
      setHasAudioPermission(false)
    }
  }, [getSmoothingFactor])

  // Stop audio
  const stopAudio = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    silentGainRef.current = null
    loudnessAnalyserRef.current = null

    setIsRunning(false)
  }, [])

  // Switch to a different audio device
  const switchDevice = useCallback(async (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    if (isRunning && state.audioSource === 'mic') {
      await initAudio(deviceId)
    }
  }, [isRunning, initAudio, state.audioSource])

  // Switch audio source (mic or vst)
  const switchAudioSource = useCallback(async (source: AudioSource) => {
    setState(s => ({ ...s, audioSource: source }))

    if (source === 'vst') {
      // Stop mic if running
      stopAudio()
      // Start VST server if not running
      if (!vstState.serverRunning) {
        await vstActions.startServer()
      }
      setIsRunning(true)
    } else {
      // Switch back to mic
      if (selectedDeviceId) {
        await initAudio(selectedDeviceId)
      }
    }
  }, [stopAudio, vstState.serverRunning, vstActions, selectedDeviceId, initAudio])

  // Load devices on mount
  useEffect(() => {
    refreshDevices()

    // Listen for device changes
    const handleDeviceChange = () => refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [refreshDevices])

  // Keep active reference trace in a ref for fast access during canvas draws.
  useEffect(() => {
    const activeId = activeRefSlot === 'A' ? refAId : refBId
    const snap = activeId ? snapshots.find(s => s.id === activeId) : null
    activeRefTraceRef.current = snap ? snap.trace : null
    activeRefNameRef.current = snap ? snap.name : null
  }, [snapshots, refAId, refBId, activeRefSlot])

  // Reset all meters
  const resetMeters = useCallback(() => {
    (['mix', 'l', 'r', 'm', 's'] as const).forEach((id) => {
      spectrumTracesRef.current[id].fill(-100)
      spectrumPeakRef.current[id].fill(-100)
      peakDecayRef.current[id].fill(0)
    })
    spectrumAvgRef.current.fill(-100)
    leftPeakRef.current = -100
    rightPeakRef.current = -100
    leftRmsRef.current = 0
    rightRmsRef.current = 0
    leftPeakHoldRef.current = -100
    rightPeakHoldRef.current = -100
    phaseCorrelationRef.current = 0
    stereoWidthRef.current = 0
    clipLeftRef.current = false
    clipRightRef.current = false
    dcOffsetLeftRef.current = 0
    dcOffsetRightRef.current = 0
    truePeakLeftRef.current = -100
    truePeakRightRef.current = -100
    loudnessHistoryRef.current = []
    loudnessIntegratedRef.current = { sum: 0, count: 0 }
    lufsMomentaryRef.current = null
    lufsShortRef.current = null
    lufsIntegratedRef.current = null
    kickFundHzRef.current = null
    kickNoteRef.current = null
    kickRatiosRef.current = null
  }, [])

  // Copy values to clipboard
  const copyValues = useCallback(() => {
    const values = {
      leftPeak: leftPeakHoldRef.current.toFixed(1) + ' dB',
      rightPeak: rightPeakHoldRef.current.toFixed(1) + ' dB',
      leftTruePeak: truePeakLeftRef.current.toFixed(1) + ' dBTP',
      rightTruePeak: truePeakRightRef.current.toFixed(1) + ' dBTP',
      leftRms: (20 * Math.log10(leftRmsRef.current + 1e-10)).toFixed(1) + ' dB',
      rightRms: (20 * Math.log10(rightRmsRef.current + 1e-10)).toFixed(1) + ' dB',
      lufsMomentary: lufsMomentaryRef.current,
      lufsShortTerm: lufsShortRef.current,
      lufsIntegrated: lufsIntegratedRef.current,
      dcOffsetLeft: dcOffsetLeftRef.current,
      dcOffsetRight: dcOffsetRightRef.current,
      phaseCorrelation: phaseCorrelationRef.current.toFixed(2),
      stereoWidth: (stereoWidthRef.current * 100).toFixed(0) + '%',
      kickFundamentalHz: kickFundHzRef.current,
      kickNote: kickNoteRef.current,
      kickRatios: kickRatiosRef.current,
    }

    navigator.clipboard.writeText(JSON.stringify(values, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const scheduleHoverUpdate = useCallback(() => {
    if (hoverRafRef.current != null) return
    hoverRafRef.current = window.requestAnimationFrame(() => {
      hoverRafRef.current = null
      const h = hoverRef.current
      if (!h || !h.active) {
        setHoverInfo(null)
        return
      }

      const band = clamp(h.band, 0, DISPLAY_BANDS - 1)
      const freq = bandFreqsRef.current[band]
      const note = freqToNote(freq)

      const mix = spectrumTracesRef.current.mix
      const ref = activeRefTraceRef.current
      const baseDb = mix[band]
      const delta = ref ? (baseDb - ref[band]) : null

      const db = state.view === 'delta' ? (delta ?? 0) : baseDb

      setHoverInfo({
        freqHz: freq,
        db,
        note: note?.note ?? null,
        cents: note?.cents ?? null,
        deltaDb: state.view === 'delta' ? null : delta,
      })
    })
  }, [state.view])

  const handleSpectrumMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = clamp(e.clientX - rect.left, 0, rect.width)
    const y = clamp(e.clientY - rect.top, 0, rect.height)

    const plotW = Math.max(1, rect.width - SPECTRUM_PAD.left - SPECTRUM_PAD.right)
    const xPlot = clamp(x - SPECTRUM_PAD.left, 0, plotW)
    const band = clamp(Math.round((xPlot / plotW) * (DISPLAY_BANDS - 1)), 0, DISPLAY_BANDS - 1)

    hoverRef.current = { active: true, x, y, band }
    scheduleHoverUpdate()
  }, [scheduleHoverUpdate])

  const handleSpectrumMouseLeave = useCallback(() => {
    hoverRef.current = null
    setHoverInfo(null)
  }, [])

  useEffect(() => {
    return () => {
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current)
      }
    }
  }, [])

  const captureSnapshot = useCallback(() => {
    const id = randomId('snap')
    const createdAt = Date.now()
    const trace = new Float32Array(DISPLAY_BANDS)
    trace.set(spectrumTracesRef.current.mix)

    const snap: Snapshot = {
      id,
      createdAt,
      name: `Snapshot ${new Date(createdAt).toLocaleTimeString()}`,
      trace,
    }

    setSnapshots((prev) => [snap, ...prev].slice(0, 30))
    if (activeRefSlot === 'A') setRefAId(id)
    else setRefBId(id)
  }, [activeRefSlot])

  const deleteSnapshot = useCallback((id: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id))
    if (refAId === id) setRefAId(null)
    if (refBId === id) setRefBId(null)
  }, [refAId, refBId])

  const assignSnapshot = useCallback((id: string, slot: 'A' | 'B') => {
    if (slot === 'A') setRefAId(id)
    else setRefBId(id)
  }, [])

  // Frequency to bin index
  const freqToBin = useCallback((freq: number, sampleRate: number, fftSize: number): number => {
    return Math.round(freq * fftSize / sampleRate)
  }, [])

  // Get frequency for band (logarithmic scale)
  const getBandFrequency = useCallback((band: number): number => {
    const idx = clamp(Math.floor(band), 0, DISPLAY_BANDS - 1)
    return bandFreqsRef.current[idx] || MIN_FREQ
  }, [])

  // Apply tilt compensation
  const applyTilt = useCallback((value: number, freq: number): number => {
    if (state.tiltMode === 'off') return value

    const tiltPerOctave = state.tiltMode === '-3dB' ? -3 : -4.5
    const octaves = Math.log2(freq / 1000) // Reference at 1kHz
    return value + octaves * tiltPerOctave
  }, [state.tiltMode])

  // Apply weighting
  const applyWeighting = useCallback((value: number, freq: number): number => {
    switch (state.weightingMode) {
      case 'dBA': return value + getAWeighting(freq)
      case 'dBC': return value + getCWeighting(freq)
      default: return value
    }
  }, [state.weightingMode])

  // VST data animation loop
  useEffect(() => {
    if (!isRunning || state.frozen || state.audioSource !== 'vst') return
    if (!vstState.vstConnected || !vstState.audioData) return

    const draw = () => {
      if (!isRunning || state.frozen || state.audioSource !== 'vst') return
      if (!vstState.audioData) return

      const smoothing = getSmoothingFactor()
      const data = vstState.audioData

      // Update log-spaced display bands by resampling VST bands.
      // VST Bridge provides 64 log bands (-100..0 dB). We interpolate in log-frequency space.
      const inLeft = data.left_bands
      const inRight = data.right_bands
      const inLen = Math.min(inLeft.length, inRight.length, VST_BANDS)
      const traces = spectrumTracesRef.current
      const peaks = spectrumPeakRef.current
      const decays = peakDecayRef.current

      let midSum = 0
      let sideSum = 0

      for (let i = 0; i < DISPLAY_BANDS; i++) {
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
        midPowerRef.current[i] = midPower
        sidePowerRef.current[i] = sidePower
        midSum += midPower
        sideSum += sidePower

        // Combine channels: peak is max(L, R); RMS uses power average.
        const mixDbRaw = state.spectrumMode === 'peak'
          ? Math.max(lDbRaw, rDbRaw)
          : powerToDb((pL + pR) * 0.5)

        const centerFreq = bandFreqsRef.current[i] || getBandFrequency(i)

        // Apply tilt + weighting to displayed traces.
        const lDb = applyWeighting(applyTilt(lDbRaw, centerFreq), centerFreq)
        const rDb = applyWeighting(applyTilt(rDbRaw, centerFreq), centerFreq)
        const mDb = applyWeighting(applyTilt(powerToDb(midPower), centerFreq), centerFreq)
        const sDb = applyWeighting(applyTilt(powerToDb(sidePower), centerFreq), centerFreq)
        const mixDb = applyWeighting(applyTilt(mixDbRaw, centerFreq), centerFreq)

        traces.l[i] = traces.l[i] * smoothing + lDb * (1 - smoothing)
        traces.r[i] = traces.r[i] * smoothing + rDb * (1 - smoothing)
        traces.m[i] = traces.m[i] * smoothing + mDb * (1 - smoothing)
        traces.s[i] = traces.s[i] * smoothing + sDb * (1 - smoothing)
        traces.mix[i] = traces.mix[i] * smoothing + mixDb * (1 - smoothing)

        // Slow average of the mix trace (for "AVG" overlay).
        const avgSmoothing = 0.985
        spectrumAvgRef.current[i] = spectrumAvgRef.current[i] * avgSmoothing + traces.mix[i] * (1 - avgSmoothing)

        // Peak hold per trace (cheap, but makes L/R/M/S useful).
        if (state.peakHold) {
          ;(['mix', 'l', 'r', 'm', 's'] as const).forEach((id) => {
            const v = traces[id][i]
            if (v > peaks[id][i]) {
              peaks[id][i] = v
              decays[id][i] = 0
            } else {
              decays[id][i] += 1
              if (decays[id][i] > 60) peaks[id][i] -= 0.5
            }
          })
        }
      }

      // Update levels from VST
      leftPeakRef.current = Math.max(leftPeakRef.current * 0.95, data.left_peak)
      rightPeakRef.current = Math.max(rightPeakRef.current * 0.95, data.right_peak)
      leftRmsRef.current = leftRmsRef.current * smoothing + data.left_rms * (1 - smoothing)
      rightRmsRef.current = rightRmsRef.current * smoothing + data.right_rms * (1 - smoothing)
      truePeakLeftRef.current = leftPeakRef.current
      truePeakRightRef.current = rightPeakRef.current

      // Peak hold
      if (state.peakHold) {
        leftPeakHoldRef.current = Math.max(leftPeakHoldRef.current, data.left_peak)
        rightPeakHoldRef.current = Math.max(rightPeakHoldRef.current, data.right_peak)
      }

      // Clip detection
      if (data.left_peak > -0.1) clipLeftRef.current = true
      if (data.right_peak > -0.1) clipRightRef.current = true

      // Estimate stereo width from mid/side energy ratio (0 = mono, 1 = very wide).
      const denomMs = midSum + sideSum
      stereoWidthRef.current = denomMs > 0 ? sideSum / denomMs : 0
      // Correlation proxy derived from M/S balance (not true phase correlation).
      phaseCorrelationRef.current = denomMs > 0 ? (midSum - sideSum) / denomMs : 0
      dcOffsetLeftRef.current = 0
      dcOffsetRightRef.current = 0

      // Draw all canvases
      drawSpectrumRef.current()
      drawPhaseRef.current()
      drawPeakMetersRef.current()
      drawScopeRef.current()

      // Update UI readouts at a lower rate to avoid re-rendering at 60fps.
      const now = performance.now()
      if (now - lastStatsUpdateRef.current > 120) {
        lastStatsUpdateRef.current = now

        const avgRms = (leftRmsRef.current + rightRmsRef.current) * 0.5
        const rmsDb = 20 * Math.log10(avgRms + 1e-10)
        const crestDb = Math.max(leftPeakRef.current, rightPeakRef.current) - rmsDb

        // Kick metrics (from spectrum)
        const mixTrace = spectrumTracesRef.current.mix
        let fundHz: number | null = null
        let fundDb = -200
        let subPow = 0
        let punchPow = 0
        let tailPow = 0
        for (let i = 0; i < DISPLAY_BANDS; i++) {
          const f = bandFreqsRef.current[i]
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
        kickFundHzRef.current = fundHz
        kickNoteRef.current = note?.note ?? null
        kickRatiosRef.current = ratios

        // Band width strip (derived from M/S energy)
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
            const f = bandFreqsRef.current[i]
            if (f < b.lowHz || f >= b.highHz) continue
            mP += midPowerRef.current[i]
            sP += sidePowerRef.current[i]
          }
          const d = mP + sP
          b.width = d > 0 ? sP / d : 0
          b.correlation = d > 0 ? (mP - sP) / d : 0
        }
        setStereoBands(bands)

        setMeterStats({
          leftPeakDb: leftPeakRef.current,
          rightPeakDb: rightPeakRef.current,
          leftTruePeakDb: truePeakLeftRef.current,
          rightTruePeakDb: truePeakRightRef.current,
          rmsDb,
          crestDb,
          correlation: phaseCorrelationRef.current,
          width: stereoWidthRef.current,
          dcOffsetL: dcOffsetLeftRef.current,
          dcOffsetR: dcOffsetRightRef.current,
          lufsM: lufsMomentaryRef.current,
          lufsS: lufsShortRef.current,
          lufsI: lufsIntegratedRef.current,
          kickFundHz: kickFundHzRef.current,
          kickNote: kickNoteRef.current,
          kickRatios: kickRatiosRef.current,
        })
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [
    isRunning,
    state.frozen,
    state.audioSource,
    state.spectrumMode,
    state.peakHold,
    vstState.vstConnected,
    vstState.audioData,
    getSmoothingFactor,
    getBandFrequency,
    applyTilt,
    applyWeighting,
  ])

  // Mic animation loop
  useEffect(() => {
    if (!isRunning || state.frozen || state.audioSource !== 'mic') return

    const analyserLeft = analyserLeftRef.current
    const analyserRight = analyserRightRef.current
    const audioContext = audioContextRef.current

    if (!analyserLeft || !analyserRight || !audioContext) return

    const leftFreqData = new Float32Array(analyserLeft.frequencyBinCount)
    const rightFreqData = new Float32Array(analyserRight.frequencyBinCount)
    const leftTimeData = new Float32Array(analyserLeft.fftSize)
    const rightTimeData = new Float32Array(analyserRight.fftSize)
    scopeLeftTimeRef.current = leftTimeData
    scopeRightTimeRef.current = rightTimeData
    const loudAnalyser = loudnessAnalyserRef.current
    const loudData = loudAnalyser ? new Float32Array(loudAnalyser.fftSize) : null

    const smoothing = getSmoothingFactor()
    analyserLeft.smoothingTimeConstant = smoothing
    analyserRight.smoothingTimeConstant = smoothing

    const draw = () => {
      if (!isRunning || state.frozen || state.audioSource !== 'mic') return

      // Get frequency data
      analyserLeft.getFloatFrequencyData(leftFreqData)
      analyserRight.getFloatFrequencyData(rightFreqData)

      // Get time domain data for phase and level
      analyserLeft.getFloatTimeDomainData(leftTimeData)
      analyserRight.getFloatTimeDomainData(rightTimeData)

      // Calculate log-spaced spectrum bands (power domain) and update trace buffers.
      const traces = spectrumTracesRef.current
      const peaks = spectrumPeakRef.current
      const decays = peakDecayRef.current

      let midSum = 0
      let sideSum = 0

      for (let i = 0; i < DISPLAY_BANDS; i++) {
        const startBin = bandBinStartRef.current[i]
        const endBin = bandBinEndRef.current[i]

        let sumPL = 0
        let sumPR = 0
        let count = 0

        for (let bin = startBin; bin <= endBin && bin < leftFreqData.length; bin++) {
          const lDb = leftFreqData[bin]
          const rDb = rightFreqData[bin]
          sumPL += dbToPower(lDb)
          sumPR += dbToPower(rDb)
          count++
        }

        const pL = count > 0 ? sumPL / count : 1e-20
        const pR = count > 0 ? sumPR / count : 1e-20
        const lDbRaw = powerToDb(pL)
        const rDbRaw = powerToDb(pR)

        const ampL = Math.sqrt(pL)
        const ampR = Math.sqrt(pR)
        const midAmp = (ampL + ampR) * 0.5
        const sideAmp = Math.abs(ampL - ampR) * 0.5
        const midPower = midAmp * midAmp
        const sidePower = sideAmp * sideAmp
        midPowerRef.current[i] = midPower
        sidePowerRef.current[i] = sidePower
        midSum += midPower
        sideSum += sidePower

        const mixDbRaw = state.spectrumMode === 'peak'
          ? Math.max(lDbRaw, rDbRaw)
          : powerToDb((pL + pR) * 0.5)

        const centerFreq = bandFreqsRef.current[i] || getBandFrequency(i)

        const lDb = applyWeighting(applyTilt(lDbRaw, centerFreq), centerFreq)
        const rDb = applyWeighting(applyTilt(rDbRaw, centerFreq), centerFreq)
        const mDb = applyWeighting(applyTilt(powerToDb(midPower), centerFreq), centerFreq)
        const sDb = applyWeighting(applyTilt(powerToDb(sidePower), centerFreq), centerFreq)
        const mixDb = applyWeighting(applyTilt(mixDbRaw, centerFreq), centerFreq)

        traces.l[i] = traces.l[i] * smoothing + lDb * (1 - smoothing)
        traces.r[i] = traces.r[i] * smoothing + rDb * (1 - smoothing)
        traces.m[i] = traces.m[i] * smoothing + mDb * (1 - smoothing)
        traces.s[i] = traces.s[i] * smoothing + sDb * (1 - smoothing)
        traces.mix[i] = traces.mix[i] * smoothing + mixDb * (1 - smoothing)

        // Slow average (for "AVG" overlay)
        const avgSmoothing = 0.985
        spectrumAvgRef.current[i] = spectrumAvgRef.current[i] * avgSmoothing + traces.mix[i] * (1 - avgSmoothing)

        // Peak hold
        if (state.peakHold) {
          ;(['mix', 'l', 'r', 'm', 's'] as const).forEach((id) => {
            const v = traces[id][i]
            if (v > peaks[id][i]) {
              peaks[id][i] = v
              decays[id][i] = 0
            } else {
              decays[id][i] += 1
              if (decays[id][i] > 60) peaks[id][i] -= 0.5
            }
          })
        }
      }

      // Calculate levels (time domain)
      let leftPeakAmp = 0
      let rightPeakAmp = 0
      let leftTpAmp = 0
      let rightTpAmp = 0
      let sumL2 = 0
      let sumR2 = 0
      let sumLR = 0
      let sumMid2 = 0
      let sumSide2 = 0
      let meanL = 0
      let meanR = 0

      let prevL = leftTimeData[0] || 0
      let prevR = rightTimeData[0] || 0

      for (let i = 0; i < leftTimeData.length; i++) {
        const l = leftTimeData[i]
        const r = rightTimeData[i]

        meanL += l
        meanR += r

        const absL = Math.abs(l)
        const absR = Math.abs(r)
        if (absL > leftPeakAmp) leftPeakAmp = absL
        if (absR > rightPeakAmp) rightPeakAmp = absR

        leftTpAmp = Math.max(leftTpAmp, absL)
        rightTpAmp = Math.max(rightTpAmp, absR)

        if (i > 0) {
          const dL = l - prevL
          const dR = r - prevR
          leftTpAmp = Math.max(leftTpAmp, Math.abs(prevL + dL * 0.25), Math.abs(prevL + dL * 0.5), Math.abs(prevL + dL * 0.75))
          rightTpAmp = Math.max(rightTpAmp, Math.abs(prevR + dR * 0.25), Math.abs(prevR + dR * 0.5), Math.abs(prevR + dR * 0.75))
          prevL = l
          prevR = r
        }

        sumL2 += l * l
        sumR2 += r * r
        sumLR += l * r

        const mid = (l + r) * 0.5
        const side = (l - r) * 0.5
        sumMid2 += mid * mid
        sumSide2 += side * side
      }

      const n = leftTimeData.length || 1
      const leftRmsAmp = Math.sqrt(sumL2 / n)
      const rightRmsAmp = Math.sqrt(sumR2 / n)

      // DC offset
      dcOffsetLeftRef.current = meanL / n
      dcOffsetRightRef.current = meanR / n

      // Phase correlation (broadband)
      const denominator = Math.sqrt(sumL2 * sumR2)
      phaseCorrelationRef.current = denominator > 0 ? sumLR / denominator : 0

      // Stereo width (0 = mono, 1 = wide) using Mid/Side energy
      const msDen = sumMid2 + sumSide2
      stereoWidthRef.current = msDen > 0 ? sumSide2 / msDen : 0

      // Convert to dB
      const leftPeakDb = 20 * Math.log10(leftPeakAmp + 1e-10)
      const rightPeakDb = 20 * Math.log10(rightPeakAmp + 1e-10)
      const leftTpDb = 20 * Math.log10(leftTpAmp + 1e-10)
      const rightTpDb = 20 * Math.log10(rightTpAmp + 1e-10)

      // Update levels with smoothing
      leftPeakRef.current = Math.max(leftPeakRef.current * 0.95, leftPeakDb)
      rightPeakRef.current = Math.max(rightPeakRef.current * 0.95, rightPeakDb)
      leftRmsRef.current = leftRmsRef.current * smoothing + leftRmsAmp * (1 - smoothing)
      rightRmsRef.current = rightRmsRef.current * smoothing + rightRmsAmp * (1 - smoothing)
      truePeakLeftRef.current = truePeakLeftRef.current * 0.9 + leftTpDb * 0.1
      truePeakRightRef.current = truePeakRightRef.current * 0.9 + rightTpDb * 0.1

      // Peak hold
      if (state.peakHold) {
        leftPeakHoldRef.current = Math.max(leftPeakHoldRef.current, leftPeakDb)
        rightPeakHoldRef.current = Math.max(rightPeakHoldRef.current, rightPeakDb)
      }

      // Clip detection
      if (leftPeakAmp > 0.999) clipLeftRef.current = true
      if (rightPeakAmp > 0.999) clipRightRef.current = true

      // Loudness (approx): use filtered mid from WebAudio graph.
      if (loudAnalyser && loudData) {
        loudAnalyser.getFloatTimeDomainData(loudData)
        let ms = 0
        for (let i = 0; i < loudData.length; i++) ms += loudData[i] * loudData[i]
        ms = ms / (loudData.length || 1)

        const t = performance.now()
        loudnessHistoryRef.current.push({ t, ms })
        // Keep enough for short-term + a bit of slack.
        const maxAge = 3500
        while (loudnessHistoryRef.current.length > 0 && (t - loudnessHistoryRef.current[0].t) > maxAge) {
          loudnessHistoryRef.current.shift()
        }

        const avgMsInWindow = (windowMs: number): number => {
          let sum = 0
          let count = 0
          for (let i = loudnessHistoryRef.current.length - 1; i >= 0; i--) {
            const it = loudnessHistoryRef.current[i]
            if (t - it.t > windowMs) break
            sum += it.ms
            count++
          }
          return count > 0 ? sum / count : 0
        }

        const msM = avgMsInWindow(400)
        const msS = avgMsInWindow(3000)

        const toLufs = (meanSquare: number): number | null => {
          if (meanSquare <= 0) return null
          return -0.691 + 10 * Math.log10(meanSquare + 1e-20)
        }

        lufsMomentaryRef.current = toLufs(msM)
        lufsShortRef.current = toLufs(msS)

        // Integrated (simple absolute gate at -70 LUFS)
        const lufsInst = toLufs(ms)
        if (lufsInst !== null && lufsInst > -70) {
          loudnessIntegratedRef.current.sum += ms
          loudnessIntegratedRef.current.count += 1
          const msI = loudnessIntegratedRef.current.sum / Math.max(1, loudnessIntegratedRef.current.count)
          lufsIntegratedRef.current = toLufs(msI)
        }
      }

      // Draw all canvases
      drawSpectrumRef.current()
      drawPhaseRef.current()
      drawPeakMetersRef.current()
      drawScopeRef.current()

      // Update UI readouts at a lower rate to avoid re-rendering at 60fps.
      const now = performance.now()
      if (now - lastStatsUpdateRef.current > 120) {
        lastStatsUpdateRef.current = now

        const avgRms = (leftRmsRef.current + rightRmsRef.current) * 0.5
        const rmsDb = 20 * Math.log10(avgRms + 1e-10)
        const crestDb = Math.max(leftPeakRef.current, rightPeakRef.current) - rmsDb

        // Kick metrics (from spectrum)
        const mixTrace = spectrumTracesRef.current.mix
        let fundHz: number | null = null
        let fundDb = -200
        let subPow = 0
        let punchPow = 0
        let tailPow = 0
        for (let i = 0; i < DISPLAY_BANDS; i++) {
          const f = bandFreqsRef.current[i]
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
        kickFundHzRef.current = fundHz
        kickNoteRef.current = note?.note ?? null
        kickRatiosRef.current = ratios

        // Band width strip (derived from M/S energy)
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
            const f = bandFreqsRef.current[i]
            if (f < b.lowHz || f >= b.highHz) continue
            mP += midPowerRef.current[i]
            sP += sidePowerRef.current[i]
          }
          const d = mP + sP
          b.width = d > 0 ? sP / d : 0
          b.correlation = d > 0 ? (mP - sP) / d : 0
        }
        setStereoBands(bands)

        setMeterStats({
          leftPeakDb: leftPeakRef.current,
          rightPeakDb: rightPeakRef.current,
          leftTruePeakDb: truePeakLeftRef.current,
          rightTruePeakDb: truePeakRightRef.current,
          rmsDb,
          crestDb,
          correlation: phaseCorrelationRef.current,
          width: stereoWidthRef.current,
          dcOffsetL: dcOffsetLeftRef.current,
          dcOffsetR: dcOffsetRightRef.current,
          lufsM: lufsMomentaryRef.current,
          lufsS: lufsShortRef.current,
          lufsI: lufsIntegratedRef.current,
          kickFundHz: kickFundHzRef.current,
          kickNote: kickNoteRef.current,
          kickRatios: kickRatiosRef.current,
        })
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      scopeLeftTimeRef.current = null
      scopeRightTimeRef.current = null
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isRunning, state.frozen, state.audioSource, state.spectrumMode, state.peakHold, getSmoothingFactor, getBandFrequency, applyTilt, applyWeighting])

  // Draw spectrum analyzer
  const drawSpectrum = useCallback(() => {
    const canvas = spectrumCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssW = rect.width
    const cssH = rect.height
    if (cssW <= 2 || cssH <= 2) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const nextW = Math.max(1, Math.round(cssW * dpr))
    const nextH = Math.max(1, Math.round(cssH * dpr))
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW
      canvas.height = nextH
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pad = SPECTRUM_PAD
    const plotX = pad.left
    const plotY = pad.top
    const plotW = Math.max(1, cssW - pad.left - pad.right)
    const plotH = Math.max(1, cssH - pad.top - pad.bottom)

    const logMin = Math.log10(MIN_FREQ)
    const logMax = Math.log10(MAX_FREQ)
    const xForFreq = (freq: number): number => {
      const t = (Math.log10(clamp(freq, MIN_FREQ, MAX_FREQ)) - logMin) / (logMax - logMin)
      return plotX + t * plotW
    }
    const xForBand = (i: number): number => plotX + (i / (DISPLAY_BANDS - 1)) * plotW

    const mix = spectrumTracesRef.current.mix
    const ref = activeRefTraceRef.current

    const isDelta = state.view === 'delta'
    const dbTop = isDelta ? 12 : 0
    const dbBottom = isDelta ? -12 : -state.dbRange

    const yForValue = (db: number): number => {
      const t = (dbTop - db) / (dbTop - dbBottom)
      return plotY + clamp(t, 0, 1) * plotH
    }

    // Background
    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, cssW, cssH)

    // Grid: vertical frequency lines
    const ticks = logTicksRef.current
    for (const t of ticks) {
      const x = xForFreq(t.freq)
      ctx.strokeStyle = t.major ? 'rgba(39, 39, 42, 0.9)' : 'rgba(39, 39, 42, 0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, plotY)
      ctx.lineTo(x, plotY + plotH)
      ctx.stroke()

      if (t.major) {
        ctx.fillStyle = '#71717a'
        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(t.label, x, cssH - 6)
      }
    }

    // Grid: horizontal dB lines
    const step = isDelta ? 6 : 12
    for (let db = dbTop; db >= dbBottom; db -= step) {
      const y = yForValue(db)
      ctx.strokeStyle = 'rgba(39, 39, 42, 0.9)'
      ctx.beginPath()
      ctx.moveTo(plotX, y)
      ctx.lineTo(plotX + plotW, y)
      ctx.stroke()

      ctx.fillStyle = '#52525b'
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${db}`, plotX - 6, y)
    }

    // Helpers
    const drawLine = (data: Float32Array, stroke: string | CanvasGradient, widthPx: number, dashed: boolean = false, alpha: number = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = stroke
      ctx.lineWidth = widthPx
      if (dashed) ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let i = 0; i < DISPLAY_BANDS; i++) {
        const x = xForBand(i)
        const y = yForValue(data[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()
    }

    const drawArea = (data: Float32Array, fill: CanvasGradient, alpha: number) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = fill
      ctx.beginPath()
      for (let i = 0; i < DISPLAY_BANDS; i++) {
        const x = xForBand(i)
        const y = yForValue(data[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(plotX + plotW, plotY + plotH)
      ctx.lineTo(plotX, plotY + plotH)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const mixGradient = ctx.createLinearGradient(0, plotY + plotH, 0, plotY)
    mixGradient.addColorStop(0, '#06b6d4')
    mixGradient.addColorStop(0.55, '#8b5cf6')
    mixGradient.addColorStop(0.85, '#f97316')
    mixGradient.addColorStop(1, '#ef4444')

    if (isDelta) {
      // Delta view: current mix - reference mix
      if (!ref) {
        ctx.fillStyle = '#a1a1aa'
        ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Capture a reference snapshot to view delta.', plotX + plotW / 2, plotY + plotH / 2)
      } else {
        // Baseline (0 dB)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(plotX, yForValue(0))
        ctx.lineTo(plotX + plotW, yForValue(0))
        ctx.stroke()
        ctx.setLineDash([])

        ctx.beginPath()
        for (let i = 0; i < DISPLAY_BANDS; i++) {
          const x = xForBand(i)
          const d = mix[i] - ref[i]
          const y = yForValue(d)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = '#fbbf24' // amber
        ctx.lineWidth = 2
        ctx.stroke()
      }
    } else {
      // Reference + average overlays
      if (state.showRef && ref) drawLine(ref, 'rgba(148, 163, 184, 0.65)', 1.25, true)
      if (state.showAvg) drawLine(spectrumAvgRef.current, 'rgba(34, 197, 94, 0.65)', 1.25, true)

      // Mix trace
      if (state.traces.mix) {
        drawArea(mix, mixGradient, 0.14)
        drawLine(mix, mixGradient, 2)
      }

      // Optional additional traces
      const traceStyles: Record<Exclude<TraceId, 'mix'>, { color: string; width: number; alpha?: number }> = {
        l: { color: 'rgba(6, 182, 212, 0.9)', width: 1.4 },
        r: { color: 'rgba(168, 85, 247, 0.85)', width: 1.4 },
        m: { color: 'rgba(34, 197, 94, 0.85)', width: 1.4 },
        s: { color: 'rgba(249, 115, 22, 0.85)', width: 1.4 },
      }

      ;(['l', 'r', 'm', 's'] as const).forEach((id) => {
        if (!state.traces[id]) return
        const st = traceStyles[id]
        drawLine(spectrumTracesRef.current[id], st.color, st.width, false, st.alpha ?? 1)
      })

      // Peak hold markers (only for visible traces to reduce clutter)
      if (state.peakHold) {
        const visible: TraceId[] = []
        if (state.traces.mix) visible.push('mix')
        if (state.traces.l) visible.push('l')
        if (state.traces.r) visible.push('r')
        if (state.traces.m) visible.push('m')
        if (state.traces.s) visible.push('s')
        for (const id of visible) {
          const peak = spectrumPeakRef.current[id]
          ctx.save()
          ctx.globalAlpha = id === 'mix' ? 0.9 : 0.55
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          for (let i = 0; i < DISPLAY_BANDS; i += 2) {
            const x = xForBand(i)
            const y = yForValue(peak[i])
            ctx.beginPath()
            ctx.moveTo(x - 2, y)
            ctx.lineTo(x + 2, y)
            ctx.stroke()
          }
          ctx.restore()
        }
      }
    }

    // Hover crosshair + tooltip
    const hover = hoverRef.current
    if (hover && hover.active) {
      const band = clamp(hover.band, 0, DISPLAY_BANDS - 1)
      const x = xForBand(band)
      const freq = bandFreqsRef.current[band]
      const baseDb = mix[band]
      const d = ref ? baseDb - ref[band] : null
      const v = isDelta ? (d ?? 0) : baseDb
      const y = yForValue(v)

      // Crosshair lines
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, plotY)
      ctx.lineTo(x, plotY + plotH)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(plotX, y)
      ctx.lineTo(plotX + plotW, y)
      ctx.stroke()
      ctx.restore()

      // Point marker
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
      ctx.fill()

      // Tooltip
      const roundRectPath = (x: number, y: number, w: number, h: number, r: number) => {
        const anyCtx = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, radii: number) => void }
        if (typeof anyCtx.roundRect === 'function') {
          anyCtx.roundRect(x, y, w, h, r)
          return
        }

        const rr = Math.max(0, Math.min(r, w / 2, h / 2))
        ctx.moveTo(x + rr, y)
        ctx.lineTo(x + w - rr, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
        ctx.lineTo(x + w, y + h - rr)
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
        ctx.lineTo(x + rr, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
        ctx.lineTo(x, y + rr)
        ctx.quadraticCurveTo(x, y, x + rr, y)
      }

      const note = freqToNote(freq)
      const lines = [
        `${formatFreq(freq)}  ${note?.note ?? ''}${note?.cents ? ` ${note.cents >= 0 ? '+' : ''}${note.cents}c` : ''}`.trim(),
        isDelta ? `Δ ${formatDb(v).replace(' dB', '')} dB` : `${formatDb(baseDb)}`,
        !isDelta && d !== null ? `Δ ${d >= 0 ? '+' : ''}${d.toFixed(1)} dB vs ${activeRefNameRef.current ?? 'Ref'}` : '',
      ].filter(Boolean)

      const tooltipX = clamp(x + 10, plotX + 6, plotX + plotW - 160)
      const tooltipY = clamp(y - 30, plotY + 6, plotY + plotH - 56)
      ctx.save()
      ctx.fillStyle = 'rgba(17, 17, 19, 0.92)'
      ctx.strokeStyle = 'rgba(39, 39, 42, 0.9)'
      ctx.lineWidth = 1
      ctx.beginPath()
      roundRectPath(tooltipX, tooltipY, 160, 54, 8)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e4e4e7'
      ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], tooltipX + 10, tooltipY + 8 + i * 16)
      }
      ctx.restore()
    }
  }, [state.view, state.dbRange, state.showAvg, state.showRef, state.traces, state.peakHold])
  drawSpectrumRef.current = drawSpectrum

  // Draw phase correlation meter
  const drawPhase = useCallback(() => {
    const canvas = phaseCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssW = rect.width
    const cssH = rect.height
    if (cssW <= 2 || cssH <= 2) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const nextW = Math.max(1, Math.round(cssW * dpr))
    const nextH = Math.max(1, Math.round(cssH * dpr))
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW
      canvas.height = nextH
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, cssW, cssH)

    const corr = clamp(phaseCorrelationRef.current, -1, 1)
    const pad = 14
    const barW = Math.max(1, cssW - pad * 2)
    const barH = 10
    const barY = cssH / 2

    // Correlation gradient: red -> orange -> green
    const grad = ctx.createLinearGradient(pad, 0, pad + barW, 0)
    grad.addColorStop(0, '#ef4444')
    grad.addColorStop(0.5, '#f97316')
    grad.addColorStop(1, '#22c55e')

    ctx.fillStyle = 'rgba(24, 24, 27, 1)'
    ctx.fillRect(pad, barY - barH / 2, barW, barH)
    ctx.fillStyle = grad
    ctx.globalAlpha = 0.28
    ctx.fillRect(pad, barY - barH / 2, barW, barH)
    ctx.globalAlpha = 1

    // Border + center mark
    ctx.strokeStyle = 'rgba(39, 39, 42, 1)'
    ctx.lineWidth = 1
    ctx.strokeRect(pad, barY - barH / 2, barW, barH)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.beginPath()
    ctx.moveTo(pad + barW / 2, barY - barH / 2 - 6)
    ctx.lineTo(pad + barW / 2, barY + barH / 2 + 6)
    ctx.stroke()

    // Indicator
    const x = pad + ((corr + 1) / 2) * barW
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, barY - barH / 2 - 8)
    ctx.lineTo(x, barY + barH / 2 + 8)
    ctx.stroke()

    // Labels
    ctx.fillStyle = '#a1a1aa'
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('-1', pad, barY + barH / 2 + 10)
    ctx.textAlign = 'center'
    ctx.fillText('0', pad + barW / 2, barY + barH / 2 + 10)
    ctx.textAlign = 'right'
    ctx.fillText('+1', pad + barW, barY + barH / 2 + 10)

    const monoCompat = corr > 0.5 ? 'GOOD' : corr > 0 ? 'OK' : 'WARN'
    const monoColor = corr > 0.5 ? '#22c55e' : corr > 0 ? '#f97316' : '#ef4444'

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#e4e4e7'
    ctx.font = 'bold 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace'
    ctx.fillText(corr.toFixed(2), cssW / 2, 22)

    ctx.fillStyle = monoColor
    ctx.font = 'bold 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace'
    ctx.fillText(`MONO ${monoCompat}`, cssW / 2, 38)
  }, [])
  drawPhaseRef.current = drawPhase

  // Draw vectorscope / goniometer (mic mode). VST mode doesn't provide time-domain samples.
  const drawScope = useCallback(() => {
    const canvas = scopeCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssW = rect.width
    const cssH = rect.height
    if (cssW <= 2 || cssH <= 2) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const nextW = Math.max(1, Math.round(cssW * dpr))
    const nextH = Math.max(1, Math.round(cssH * dpr))
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW
      canvas.height = nextH
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, cssW, cssH)

    const left = scopeLeftTimeRef.current
    const right = scopeRightTimeRef.current
    if (!left || !right) {
      ctx.fillStyle = '#71717a'
      ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Vectorscope available in Mic mode', cssW / 2, cssH / 2)
      return
    }

    const cx = cssW / 2
    const cy = cssH / 2
    const r = Math.min(cssW, cssH) * 0.45

    // Grid
    ctx.strokeStyle = 'rgba(39, 39, 42, 1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx + r, cy)
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx, cy + r)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(39, 39, 42, 0.7)'
    ctx.beginPath()
    ctx.moveTo(cx - r, cy - r)
    ctx.lineTo(cx + r, cy + r)
    ctx.moveTo(cx - r, cy + r)
    ctx.lineTo(cx + r, cy - r)
    ctx.stroke()

    // Plot: rotate into Mid/Side axes so mono is a vertical line.
    const n = Math.min(left.length, right.length)
    const step = Math.max(1, Math.floor(n / 900))

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)'
    ctx.lineWidth = 1
    ctx.beginPath()

    let first = true
    for (let i = 0; i < n; i += step) {
      const l = left[i]
      const rr = right[i]
      const x = (l - rr) * (1 / Math.SQRT2)
      const y = (l + rr) * (1 / Math.SQRT2)
      const px = cx + x * r
      const py = cy - y * r
      if (first) {
        ctx.moveTo(px, py)
        first = false
      } else {
        ctx.lineTo(px, py)
      }
    }
    ctx.stroke()
    ctx.restore()

    // Labels
    ctx.fillStyle = '#52525b'
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace'

    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText('-S', 6, cy)
    ctx.textAlign = 'right'
    ctx.fillText('+S', cssW - 6, cy)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('+M', cx, 6)
    ctx.textBaseline = 'bottom'
    ctx.fillText('-M', cx, cssH - 6)
  }, [])
  drawScopeRef.current = drawScope

  // Draw peak meters
  const drawPeakMeters = useCallback(() => {
    const canvas = peakCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const cssW = rect.width
    const cssH = rect.height
    if (cssW <= 2 || cssH <= 2) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const nextW = Math.max(1, Math.round(cssW * dpr))
    const nextH = Math.max(1, Math.round(cssH * dpr))
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW
      canvas.height = nextH
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const width = cssW
    const height = cssH

    // Clear
    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, width, height)

    const meterWidth = 30
    const meterHeight = height - 40
    const leftX = 20
    const rightX = width - 50
    const rmsX = width / 2 - 15
    const topY = 20

    // Draw dB scale
    ctx.fillStyle = '#52525b'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'

    const dbMarks = [0, -6, -12, -18, -24, -36, -48, -60]
    dbMarks.forEach(db => {
      const y = topY + meterHeight * (1 - (db + 60) / 60)
      ctx.fillText(`${db}`, leftX - 4, y + 3)

      ctx.strokeStyle = '#27272a'
      ctx.beginPath()
      ctx.moveTo(leftX, y)
      ctx.lineTo(rightX + meterWidth, y)
      ctx.stroke()
    })

    // Helper to draw a meter
    const drawMeter = (x: number, peakDb: number, rmsDb: number, peakHoldDb: number, clip: boolean, label: string) => {
      // Background
      ctx.fillStyle = '#18181b'
      ctx.fillRect(x, topY, meterWidth, meterHeight)

      // Gradient for meter
      const gradient = ctx.createLinearGradient(0, topY + meterHeight, 0, topY)
      gradient.addColorStop(0, '#22c55e')
      gradient.addColorStop(0.6, '#22c55e')
      gradient.addColorStop(0.8, '#eab308')
      gradient.addColorStop(0.95, '#f97316')
      gradient.addColorStop(1, '#ef4444')

      // Peak bar
      const peakHeight = Math.max(0, (peakDb + 60) / 60) * meterHeight
      ctx.fillStyle = gradient
      ctx.fillRect(x, topY + meterHeight - peakHeight, meterWidth, peakHeight)

      // RMS overlay (darker)
      const rmsHeight = Math.max(0, (rmsDb + 60) / 60) * meterHeight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.fillRect(x + 5, topY + meterHeight - rmsHeight, meterWidth - 10, rmsHeight)

      // Peak hold line
      if (state.peakHold && peakHoldDb > -60) {
        const holdY = topY + meterHeight * (1 - (peakHoldDb + 60) / 60)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, holdY - 1, meterWidth, 2)
      }

      // Clip indicator
      ctx.fillStyle = clip ? '#ef4444' : '#27272a'
      ctx.fillRect(x, topY - 15, meterWidth, 10)

      // Label
      ctx.fillStyle = '#71717a'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(label, x + meterWidth / 2, topY + meterHeight + 15)

      // dB value
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.fillText(peakDb > -60 ? peakDb.toFixed(1) : '-∞', x + meterWidth / 2, topY + meterHeight + 28)
    }

    // Draw left peak meter
    drawMeter(leftX, leftPeakRef.current, 20 * Math.log10(leftRmsRef.current + 1e-10), leftPeakHoldRef.current, clipLeftRef.current, 'L')

    // Draw RMS meter (center)
    const avgRms = (leftRmsRef.current + rightRmsRef.current) / 2
    const avgRmsDb = 20 * Math.log10(avgRms + 1e-10)
    drawMeter(rmsX, avgRmsDb, avgRmsDb, Math.max(leftPeakHoldRef.current, rightPeakHoldRef.current) - 3, false, 'RMS')

    // Draw right peak meter
    drawMeter(rightX, rightPeakRef.current, 20 * Math.log10(rightRmsRef.current + 1e-10), rightPeakHoldRef.current, clipRightRef.current, 'R')
  }, [state.peakHold])
  drawPeakMetersRef.current = drawPeakMeters

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio()
    }
  }, [stopAudio])

  const activeRefId = activeRefSlot === 'A' ? refAId : refBId
  const activeRefSnapshot = activeRefId ? snapshots.find(s => s.id === activeRefId) : null
  const refASnapshot = refAId ? snapshots.find(s => s.id === refAId) : null
  const refBSnapshot = refBId ? snapshots.find(s => s.id === refBId) : null

  const formatLufs = (value: number | null): string => {
    if (value == null || !Number.isFinite(value)) return '--'
    return value.toFixed(1)
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0b] overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-[#111113] border-b border-[#27272a]/50 flex items-center px-4 gap-4 drag">
        <button
          onClick={onBack}
          className="no-drag w-8 h-8 rounded-lg bg-[#18181b] hover:bg-[#27272a] flex items-center justify-center text-zinc-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 no-drag">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">Hardwave Analyser</span>
        </div>

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-2 no-drag">
          {/* Audio Source Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
            <button
              onClick={() => switchAudioSource('mic')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all ${
                state.audioSource === 'mic'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Mic className="w-3 h-3" />
              Mic
            </button>
            <button
              onClick={() => switchAudioSource('vst')}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all ${
                state.audioSource === 'vst'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Plug className="w-3 h-3" />
              VST
            </button>
          </div>

          {/* VST Connection Status */}
          {state.audioSource === 'vst' && (
            <div className={`px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5 ${
              vstState.vstConnected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-zinc-800 text-zinc-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${vstState.vstConnected ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
              {vstState.vstConnected ? 'VST Connected' : 'Waiting for VST...'}
            </div>
          )}

          {/* Audio Input Selector (only show for mic mode) */}
          {state.audioSource === 'mic' && (
            <div className="relative">
              <button
                onClick={() => setShowDeviceSelector(!showDeviceSelector)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-[#18181b] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-all max-w-[200px]"
              >
                <Mic className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {audioDevices.find(d => d.deviceId === selectedDeviceId)?.label || 'Select Input'}
                </span>
                <ChevronDown className="w-3 h-3 flex-shrink-0" />
              </button>

              {showDeviceSelector && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
                  <div className="px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-[#27272a]">
                    Audio Input Device
                  </div>
                  {audioDevices.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-zinc-500">No devices found</div>
                  ) : (
                    audioDevices.map(device => (
                      <button
                        key={device.deviceId}
                        onClick={() => {
                          switchDevice(device.deviceId)
                          setShowDeviceSelector(false)
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-[#27272a] transition-colors ${
                          selectedDeviceId === device.deviceId ? 'text-cyan-400' : 'text-zinc-300'
                        }`}
                      >
                        <Mic className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 8)}`}</span>
                        {selectedDeviceId === device.deviceId && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                      </button>
                    ))
                  )}
                  <div className="px-3 py-2 text-[10px] text-zinc-600 border-t border-[#27272a] mt-1">
                    Tip: Use a virtual audio cable to capture DAW output
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Play/Stop (only for mic mode) */}
          {state.audioSource === 'mic' && (
            <button
              onClick={() => isRunning ? stopAudio() : initAudio(selectedDeviceId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                isRunning
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              {isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isRunning ? 'Stop' : 'Start'}
            </button>
          )}

          {/* Freeze */}
          <button
            onClick={() => setState(s => ({ ...s, frozen: !s.frozen }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              state.frozen
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-[#18181b] text-zinc-400 hover:bg-[#27272a]'
            }`}
          >
            <Snowflake className="w-3 h-3" />
            Freeze
          </button>

          {/* Reset */}
          <button
            onClick={resetMeters}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-[#18181b] text-zinc-400 hover:bg-[#27272a] hover:text-white transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>

          {/* Copy */}
          <button
            onClick={copyValues}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-[#18181b] text-zinc-400 hover:bg-[#27272a] hover:text-white transition-all"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 overflow-hidden p-4">
        {/* Left: Spectrum + Bottom Row */}
        <div className="flex flex-col gap-4 min-w-0 overflow-hidden">
          {/* Spectrum */}
          <div className="flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="w-4 h-4 text-cyan-400" />
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
                      {state.view === 'delta'
                        ? `Δ ${hoverInfo.db >= 0 ? '+' : ''}${hoverInfo.db.toFixed(1)} dB`
                        : `${hoverInfo.db.toFixed(1)} dB`}
                    </span>
                    {state.view !== 'delta' && hoverInfo.deltaDb != null && (
                      <span className="text-zinc-500">
                        Δ {hoverInfo.deltaDb >= 0 ? '+' : ''}{hoverInfo.deltaDb.toFixed(1)} dB
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-zinc-600">Hover for readout</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mode */}
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  <button
                    onClick={() => setState(s => ({ ...s, spectrumMode: 'peak' }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.spectrumMode === 'peak' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Peak
                  </button>
                  <button
                    onClick={() => setState(s => ({ ...s, spectrumMode: 'rms' }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.spectrumMode === 'rms' ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    RMS
                  </button>
                </div>

                {/* Response Time */}
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  {(['fast', 'medium', 'slow'] as ResponseTime[]).map(rt => (
                    <button
                      key={rt}
                      onClick={() => setState(s => ({ ...s, responseTime: rt }))}
                      className={`px-2 py-1 text-[10px] font-medium capitalize ${state.responseTime === rt ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {rt}
                    </button>
                  ))}
                </div>

                {/* Tilt */}
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  {(['off', '-3dB', '-4.5dB'] as TiltMode[]).map(tilt => (
                    <button
                      key={tilt}
                      onClick={() => setState(s => ({ ...s, tiltMode: tilt }))}
                      className={`px-2 py-1 text-[10px] font-medium ${state.tiltMode === tilt ? 'bg-orange-500/20 text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {tilt === 'off' ? 'Flat' : tilt}
                    </button>
                  ))}
                </div>

                {/* Peak Hold */}
                <button
                  onClick={() => setState(s => ({ ...s, peakHold: !s.peakHold }))}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border ${state.peakHold ? 'border-yellow-500/50 bg-yellow-500/20 text-yellow-400' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'}`}
                >
                  Hold
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* View */}
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  <button
                    onClick={() => setState(s => ({ ...s, view: 'spectrum' }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.view === 'spectrum' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Spec
                  </button>
                  <button
                    onClick={() => setState(s => ({ ...s, view: 'delta' }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.view === 'delta' ? 'bg-amber-500/20 text-amber-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Δ
                  </button>
                </div>

                {/* dB Range */}
                <div className={`flex rounded-lg overflow-hidden border border-[#27272a] ${state.view === 'delta' ? 'opacity-40' : ''}`}>
                  {([60, 90, 120] as DbRange[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setState(s => ({ ...s, dbRange: r }))}
                      disabled={state.view === 'delta'}
                      className={`px-2 py-1 text-[10px] font-medium ${state.dbRange === r ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'} disabled:hover:text-zinc-500`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {/* Overlays */}
                <button
                  onClick={() => setState(s => ({ ...s, showAvg: !s.showAvg }))}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1 ${
                    state.showAvg ? 'border-green-500/40 bg-green-500/15 text-green-300' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {state.showAvg ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  Avg
                </button>
                <button
                  onClick={() => setState(s => ({ ...s, showRef: !s.showRef }))}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1 ${
                    state.showRef ? 'border-slate-500/40 bg-slate-500/15 text-slate-200' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {state.showRef ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  Ref
                </button>

                {/* Traces */}
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  <button
                    onClick={() => setState(s => ({ ...s, traces: { ...s.traces, mix: !s.traces.mix } }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.traces.mix ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Mix
                  </button>
                  <button
                    onClick={() => setState(s => ({ ...s, traces: { ...s.traces, l: !s.traces.l } }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.traces.l ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    L
                  </button>
                  <button
                    onClick={() => setState(s => ({ ...s, traces: { ...s.traces, r: !s.traces.r } }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.traces.r ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    R
                  </button>
                  <button
                    onClick={() => setState(s => ({ ...s, traces: { ...s.traces, m: !s.traces.m } }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.traces.m ? 'bg-green-500/20 text-green-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    M
                  </button>
                  <button
                    onClick={() => setState(s => ({ ...s, traces: { ...s.traces, s: !s.traces.s } }))}
                    className={`px-2 py-1 text-[10px] font-medium ${state.traces.s ? 'bg-orange-500/20 text-orange-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    S
                  </button>
                </div>

                {/* Capture Snapshot */}
                <button
                  onClick={captureSnapshot}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium border border-[#27272a] bg-[#18181b] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-1.5"
                  title={`Capture snapshot to slot ${activeRefSlot}`}
                >
                  <Camera className="w-3 h-3" />
                  Cap {activeRefSlot}
                </button>
              </div>
            </div>

            <div
              className="flex-1 relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b] cursor-crosshair min-h-0"
              onMouseMove={handleSpectrumMouseMove}
              onMouseLeave={handleSpectrumMouseLeave}
            >
              <canvas
                ref={spectrumCanvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:h-72 min-h-0">
            {/* Levels */}
            <div className="bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Levels</span>
                </div>

                {/* Weighting */}
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  {(['flat', 'dBA', 'dBC'] as WeightingMode[]).map(w => (
                    <button
                      key={w}
                      onClick={() => setState(s => ({ ...s, weightingMode: w }))}
                      className={`px-2 py-1 text-[10px] font-medium ${state.weightingMode === w ? 'bg-green-500/20 text-green-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 grid grid-cols-[minmax(0,1fr)_170px] gap-3 min-h-0">
                <div className="relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b] min-h-0">
                  <canvas
                    ref={peakCanvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                <div className="text-[10px] font-mono text-zinc-300 tabular-nums leading-relaxed">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Peak</span>
                    <span>{formatDb(meterStats.leftPeakDb)} / {formatDb(meterStats.rightPeakDb)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">TP</span>
                    <span>{meterStats.leftTruePeakDb.toFixed(1)} / {meterStats.rightTruePeakDb.toFixed(1)} dBTP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">RMS</span>
                    <span>{formatDb(meterStats.rmsDb)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Crest</span>
                    <span>{meterStats.crestDb.toFixed(1)} dB</span>
                  </div>
                  <div className="h-px bg-[#27272a] my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">LUFS M</span>
                    <span>{formatLufs(meterStats.lufsM)} LUFS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">LUFS S</span>
                    <span>{formatLufs(meterStats.lufsS)} LUFS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">LUFS I</span>
                    <span>{formatLufs(meterStats.lufsI)} LUFS</span>
                  </div>
                  <div className="h-px bg-[#27272a] my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">DC L/R</span>
                    <span>{meterStats.dcOffsetL.toFixed(4)} / {meterStats.dcOffsetR.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stereo */}
            <div className="bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Stereo</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                  W {Math.round(clamp(meterStats.width, 0, 1) * 100)}% · Corr {clamp(meterStats.correlation, -1, 1).toFixed(2)}
                </div>
              </div>

              <div className="h-16 relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b] mb-3">
                <canvas
                  ref={phaseCanvasRef}
                  className="absolute inset-0 w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
                <div className="relative rounded-lg overflow-hidden border border-[#27272a] bg-[#0a0a0b] min-h-0">
                  <canvas
                    ref={scopeCanvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                <div className="flex flex-col min-h-0">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Band Width
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col gap-1">
                    {stereoBands.length === 0 ? (
                      <div className="text-xs text-zinc-600">Waiting for signal...</div>
                    ) : (
                      stereoBands.map((b) => {
                        const fill = b.correlation > 0.4 ? '#22c55e' : b.correlation > 0 ? '#f97316' : '#ef4444'
                        return (
                          <div key={b.label} className="flex items-center gap-2">
                            <span className="w-12 text-[10px] font-mono text-zinc-400">{b.label}</span>
                            <div className="flex-1 h-2 rounded bg-[#18181b] overflow-hidden border border-[#27272a]">
                              <div className="h-full" style={{ width: `${Math.round(clamp(b.width, 0, 1) * 100)}%`, backgroundColor: fill }} />
                            </div>
                            <span className="w-10 text-[10px] font-mono text-zinc-500 text-right tabular-nums">
                              {Math.round(clamp(b.width, 0, 1) * 100)}%
                            </span>
                          </div>
                        )
                      })
                    )}
                  </div>
                  <div className="mt-2 text-[10px] text-zinc-600">
                    Green = mono-safe, red = phase risk.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: References + Kick */}
        <div className="w-full lg:w-[360px] flex flex-col gap-4 min-w-0 overflow-hidden">
          {/* References */}
          <div className="flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">References</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
                  <button
                    onClick={() => setActiveRefSlot('A')}
                    className={`px-2 py-1 text-[10px] font-medium ${activeRefSlot === 'A' ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    A
                  </button>
                  <button
                    onClick={() => setActiveRefSlot('B')}
                    className={`px-2 py-1 text-[10px] font-medium ${activeRefSlot === 'B' ? 'bg-purple-500/20 text-purple-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    B
                  </button>
                </div>

                <button
                  onClick={captureSnapshot}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium border border-[#27272a] bg-[#18181b] text-zinc-300 hover:bg-[#27272a] hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Camera className="w-3 h-3" />
                  Capture
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className={`rounded-lg border p-2 ${activeRefSlot === 'A' ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-[#27272a] bg-[#18181b]'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Slot A</span>
                  <button
                    onClick={() => setRefAId(null)}
                    className="text-zinc-500 hover:text-zinc-300"
                    title="Clear slot A"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-xs text-zinc-300 truncate mt-1">{refASnapshot?.name ?? 'Empty'}</div>
              </div>
              <div className={`rounded-lg border p-2 ${activeRefSlot === 'B' ? 'border-purple-500/40 bg-purple-500/10' : 'border-[#27272a] bg-[#18181b]'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Slot B</span>
                  <button
                    onClick={() => setRefBId(null)}
                    className="text-zinc-500 hover:text-zinc-300"
                    title="Clear slot B"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-xs text-zinc-300 truncate mt-1">{refBSnapshot?.name ?? 'Empty'}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-zinc-600">
                Active ref: <span className="text-zinc-400">{activeRefSnapshot?.name ?? 'None'}</span>
              </div>
              <div className="text-[10px] text-zinc-600">{snapshots.length}/30</div>
            </div>

            <div className="flex-1 overflow-hidden rounded-lg border border-[#27272a] bg-[#0a0a0b]">
              <div className="h-full overflow-y-auto">
                {snapshots.length === 0 ? (
                  <div className="p-3 text-xs text-zinc-500">
                    Capture snapshots to create A/B references, then switch to Δ view.
                  </div>
                ) : (
                  snapshots.map((s) => (
                    <div key={s.id} className="px-3 py-2 border-b border-[#27272a]/60 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-200 truncate">{s.name}</div>
                        <div className="text-[10px] text-zinc-600">{new Date(s.createdAt).toLocaleString()}</div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => assignSnapshot(s.id, 'A')}
                          className={`px-2 py-1 rounded text-[10px] font-medium border ${
                            refAId === s.id ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'
                          }`}
                          title="Assign to slot A"
                        >
                          A
                        </button>
                        <button
                          onClick={() => assignSnapshot(s.id, 'B')}
                          className={`px-2 py-1 rounded text-[10px] font-medium border ${
                            refBId === s.id ? 'border-purple-500/40 bg-purple-500/15 text-purple-200' : 'border-[#27272a] text-zinc-500 hover:text-zinc-300'
                          }`}
                          title="Assign to slot B"
                        >
                          B
                        </button>
                        <button
                          onClick={() => deleteSnapshot(s.id)}
                          className="p-1 rounded border border-[#27272a] text-zinc-500 hover:text-zinc-200 hover:bg-[#18181b]"
                          title="Delete snapshot"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Kick Focus */}
          <div className="h-52 bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Kick Focus</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                {meterStats.kickFundHz != null ? `${formatFreq(meterStats.kickFundHz)} ${meterStats.kickNote ?? ''}`.trim() : '--'}
              </div>
            </div>

            {meterStats.kickRatios ? (
              <div className="flex-1 flex flex-col justify-between">
                {([
                  { key: 'sub', label: 'Sub', color: '#06b6d4' },
                  { key: 'punch', label: 'Punch', color: '#22c55e' },
                  { key: 'tail', label: 'Tail', color: '#f97316' },
                ] as const).map((it) => {
                  const v = meterStats.kickRatios ? meterStats.kickRatios[it.key] : 0
                  return (
                    <div key={it.key} className="flex items-center gap-2">
                      <span className="w-12 text-[10px] font-mono text-zinc-400">{it.label}</span>
                      <div className="flex-1 h-2 rounded bg-[#18181b] overflow-hidden border border-[#27272a]">
                        <div className="h-full" style={{ width: `${Math.round(clamp(v, 0, 1) * 100)}%`, backgroundColor: it.color }} />
                      </div>
                      <span className="w-10 text-[10px] font-mono text-zinc-500 text-right tabular-nums">
                        {Math.round(clamp(v, 0, 1) * 100)}%
                      </span>
                    </div>
                  )
                })}
                <div className="text-[10px] text-zinc-600 mt-3">
                  Based on spectrum energy: 20-60Hz (sub), 60-150Hz (punch), 150-400Hz (tail).
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-zinc-600">
                Waiting for signal...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audio permission prompt */}
      {!hasAudioPermission && !isRunning && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-[#111113] rounded-2xl border border-[#27272a] p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Start Analysing</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Select your audio input and click Start to analyze your mix in real-time.
            </p>

            {/* Audio Source Toggle */}
            <div className="mb-4">
              <div className="flex rounded-xl overflow-hidden border border-[#27272a]">
                <button
                  onClick={() => setState(s => ({ ...s, audioSource: 'mic' }))}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    state.audioSource === 'mic'
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  Microphone
                </button>
                <button
                  onClick={() => switchAudioSource('vst')}
                  className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    state.audioSource === 'vst'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Plug className="w-4 h-4" />
                  VST Plugin
                </button>
              </div>
            </div>

            {/* Device Selector in Prompt */}
            <div className="mb-6">
              <label className="block text-xs font-medium text-zinc-500 mb-2 text-left">Audio Input Device</label>
              <div className="relative">
                <button
                  onClick={() => setShowDeviceSelector(!showDeviceSelector)}
                  className="w-full px-4 py-3 rounded-xl bg-[#18181b] border border-[#27272a] text-left text-sm flex items-center gap-2 hover:border-[#3f3f46] transition-colors"
                >
                  <Mic className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-zinc-300">
                    {audioDevices.find(d => d.deviceId === selectedDeviceId)?.label || 'Select audio input...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showDeviceSelector ? 'rotate-180' : ''}`} />
                </button>

                {showDeviceSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#18181b] border border-[#27272a] rounded-xl shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
                    {audioDevices.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-zinc-500">No devices found. Click Start to grant permission.</div>
                    ) : (
                      audioDevices.map(device => (
                        <button
                          key={device.deviceId}
                          onClick={() => {
                            setSelectedDeviceId(device.deviceId)
                            setShowDeviceSelector(false)
                          }}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-[#27272a] transition-colors ${
                            selectedDeviceId === device.deviceId ? 'text-cyan-400' : 'text-zinc-300'
                          }`}
                        >
                          <Mic className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 8)}`}</span>
                          {selectedDeviceId === device.deviceId && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="mt-2 text-[10px] text-zinc-600 text-left">
                Tip: Use VB-Cable (Windows) or BlackHole (macOS) to capture DAW output
              </p>
            </div>

            <button
              onClick={() => initAudio(selectedDeviceId)}
              className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-green-500 text-white font-semibold hover:shadow-lg hover:shadow-orange-500/25 transition-all"
            >
              Start Analyser
            </button>
          </div>
        </div>
      )}

      {/* VST waiting prompt */}
      {state.audioSource === 'vst' && !vstState.vstConnected && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-[#111113] rounded-2xl border border-[#27272a] p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
              <Plug className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Waiting for VST</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Add the <span className="text-purple-400 font-semibold">Hardwave Bridge</span> plugin to your DAW's master channel to stream audio.
            </p>

            {/* Connection Status */}
            <div className="bg-[#18181b] rounded-xl border border-[#27272a] p-4 mb-6">
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 rounded-full bg-zinc-600 animate-pulse" />
                <span className="text-sm text-zinc-400">Listening on port 9847...</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="text-left mb-6 space-y-2">
              <p className="text-xs text-zinc-500">Setup instructions:</p>
              <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
                <li>Build the VST: <code className="text-cyan-400 bg-zinc-900 px-1 rounded">cargo xtask bundle hardwave-bridge</code></li>
                <li>Copy to your VST3 folder</li>
                <li>Add Hardwave Bridge to master channel</li>
                <li>Connection will be automatic</li>
              </ol>
            </div>

            {/* Switch to Mic */}
            <button
              onClick={() => switchAudioSource('mic')}
              className="w-full px-6 py-3 rounded-xl border border-[#27272a] text-zinc-400 font-medium hover:bg-[#18181b] transition-all flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              Use Microphone Instead
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
