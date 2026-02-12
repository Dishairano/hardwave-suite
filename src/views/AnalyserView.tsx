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
  Radio,
  Check,
  Mic,
  ChevronDown,
  Plug,
} from 'lucide-react'
import { useVstAudio } from '../hooks/useVstAudio'

// Types
type ResponseTime = 'fast' | 'medium' | 'slow'
type TiltMode = 'off' | '-3dB' | '-4.5dB'
type WeightingMode = 'flat' | 'dBA' | 'dBC'
type SpectrumMode = 'peak' | 'rms'
type AudioSource = 'mic' | 'vst'

interface AnalyserState {
  spectrumMode: SpectrumMode
  responseTime: ResponseTime
  tiltMode: TiltMode
  weightingMode: WeightingMode
  frozen: boolean
  peakHold: boolean
  audioSource: AudioSource
}

interface AnalyserViewProps {
  onBack: () => void
}

// Constants
const FFT_SIZE = 8192
const NUM_BANDS = 64
const MIN_FREQ = 20
const MAX_FREQ = 20000
const SMOOTHING_FAST = 0.6
const SMOOTHING_MEDIUM = 0.8
const SMOOTHING_SLOW = 0.92

// Frequency labels for spectrum
const FREQ_LABELS = [20, 50, 100, 200, 500, '1k', '2k', '5k', '10k', '20k']

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

export function AnalyserView({ onBack }: AnalyserViewProps) {
  // State
  const [state, setState] = useState<AnalyserState>({
    spectrumMode: 'peak',
    responseTime: 'medium',
    tiltMode: 'off',
    weightingMode: 'flat',
    frozen: false,
    peakHold: true,
    audioSource: 'mic'
  })

  // VST audio hook
  const [vstState, vstActions] = useVstAudio(50, false)

  const [isRunning, setIsRunning] = useState(false)
  const [hasAudioPermission, setHasAudioPermission] = useState(false)
  const [copied, setCopied] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [showDeviceSelector, setShowDeviceSelector] = useState(false)

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserLeftRef = useRef<AnalyserNode | null>(null)
  const analyserRightRef = useRef<AnalyserNode | null>(null)
  const splitterRef = useRef<ChannelSplitterNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  // Canvas refs
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const stereoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const peakCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Data refs
  const spectrumDataRef = useRef<Float32Array>(new Float32Array(NUM_BANDS))
  const spectrumPeakRef = useRef<Float32Array>(new Float32Array(NUM_BANDS))
  const peakDecayRef = useRef<Float32Array>(new Float32Array(NUM_BANDS))
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
      await navigator.mediaDevices.getUserMedia({ audio: true })
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
      analyserLeft.smoothingTimeConstant = getSmoothingFactor()
      analyserLeftRef.current = analyserLeft

      const analyserRight = audioContext.createAnalyser()
      analyserRight.fftSize = FFT_SIZE
      analyserRight.smoothingTimeConstant = getSmoothingFactor()
      analyserRightRef.current = analyserRight

      // Connect nodes
      source.connect(splitter)
      splitter.connect(analyserLeft, 0)
      splitter.connect(analyserRight, 1)

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

  // Reset all meters
  const resetMeters = useCallback(() => {
    spectrumDataRef.current.fill(-100)
    spectrumPeakRef.current.fill(-100)
    peakDecayRef.current.fill(0)
    leftPeakRef.current = 0
    rightPeakRef.current = 0
    leftRmsRef.current = 0
    rightRmsRef.current = 0
    leftPeakHoldRef.current = 0
    rightPeakHoldRef.current = 0
    phaseCorrelationRef.current = 0
    stereoWidthRef.current = 0.5
    clipLeftRef.current = false
    clipRightRef.current = false
  }, [])

  // Copy values to clipboard
  const copyValues = useCallback(() => {
    const values = {
      leftPeak: leftPeakHoldRef.current.toFixed(1) + ' dB',
      rightPeak: rightPeakHoldRef.current.toFixed(1) + ' dB',
      leftRms: (20 * Math.log10(leftRmsRef.current + 1e-10)).toFixed(1) + ' dB',
      rightRms: (20 * Math.log10(rightRmsRef.current + 1e-10)).toFixed(1) + ' dB',
      phaseCorrelation: phaseCorrelationRef.current.toFixed(2),
      stereoWidth: (stereoWidthRef.current * 100).toFixed(0) + '%'
    }

    navigator.clipboard.writeText(JSON.stringify(values, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  // Frequency to bin index
  const freqToBin = useCallback((freq: number, sampleRate: number, fftSize: number): number => {
    return Math.round(freq * fftSize / sampleRate)
  }, [])

  // Get frequency for band (logarithmic scale)
  const getBandFrequency = useCallback((band: number): number => {
    const logMin = Math.log10(MIN_FREQ)
    const logMax = Math.log10(MAX_FREQ)
    const logFreq = logMin + (band / NUM_BANDS) * (logMax - logMin)
    return Math.pow(10, logFreq)
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

      // Update spectrum data from VST
      for (let i = 0; i < NUM_BANDS && i < data.left_bands.length; i++) {
        // Average left and right or use peak depending on mode
        let bandValue: number
        if (state.spectrumMode === 'peak') {
          bandValue = Math.max(data.left_bands[i], data.right_bands[i])
        } else {
          bandValue = (data.left_bands[i] + data.right_bands[i]) / 2
        }

        // Apply tilt and weighting
        const centerFreq = getBandFrequency(i)
        bandValue = applyTilt(bandValue, centerFreq)
        bandValue = applyWeighting(bandValue, centerFreq)

        // Smooth spectrum data
        spectrumDataRef.current[i] = spectrumDataRef.current[i] * smoothing + bandValue * (1 - smoothing)

        // Update peak hold
        if (state.peakHold) {
          if (spectrumDataRef.current[i] > spectrumPeakRef.current[i]) {
            spectrumPeakRef.current[i] = spectrumDataRef.current[i]
            peakDecayRef.current[i] = 0
          } else {
            peakDecayRef.current[i]++
            if (peakDecayRef.current[i] > 60) {
              spectrumPeakRef.current[i] -= 0.5
            }
          }
        }
      }

      // Update levels from VST
      leftPeakRef.current = Math.max(leftPeakRef.current * 0.95, data.left_peak)
      rightPeakRef.current = Math.max(rightPeakRef.current * 0.95, data.right_peak)
      leftRmsRef.current = leftRmsRef.current * smoothing + data.left_rms * (1 - smoothing)
      rightRmsRef.current = rightRmsRef.current * smoothing + data.right_rms * (1 - smoothing)

      // Peak hold
      if (state.peakHold) {
        leftPeakHoldRef.current = Math.max(leftPeakHoldRef.current, data.left_peak)
        rightPeakHoldRef.current = Math.max(rightPeakHoldRef.current, data.right_peak)
      }

      // Clip detection
      if (data.left_peak > -0.1) clipLeftRef.current = true
      if (data.right_peak > -0.1) clipRightRef.current = true

      // Calculate phase correlation from stereo data (simplified)
      // Use the difference between left and right RMS as a proxy
      const totalRms = data.left_rms + data.right_rms
      if (totalRms > 0.001) {
        const diff = Math.abs(data.left_rms - data.right_rms) / totalRms
        phaseCorrelationRef.current = 1 - diff  // Higher = more correlated
      }

      // Stereo width
      if (totalRms > 0.001) {
        stereoWidthRef.current = Math.abs(data.left_rms - data.right_rms) / totalRms
      }

      // Draw all canvases
      drawSpectrum()
      drawPhase()
      drawStereo()
      drawPeakMeters()

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, state.frozen, state.audioSource, state.spectrumMode, state.peakHold, vstState.vstConnected, vstState.audioData, getSmoothingFactor, getBandFrequency, applyTilt, applyWeighting])

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

      // Calculate spectrum bands (1/3 octave smoothing)
      for (let i = 0; i < NUM_BANDS; i++) {
        const centerFreq = getBandFrequency(i)
        const lowFreq = centerFreq / Math.pow(2, 1/6)
        const highFreq = centerFreq * Math.pow(2, 1/6)

        const lowBin = freqToBin(lowFreq, audioContext.sampleRate, analyserLeft.fftSize)
        const highBin = freqToBin(highFreq, audioContext.sampleRate, analyserLeft.fftSize)

        let sum = 0
        let count = 0

        for (let bin = lowBin; bin <= highBin && bin < leftFreqData.length; bin++) {
          const leftVal = leftFreqData[bin]
          const rightVal = rightFreqData[bin]

          if (state.spectrumMode === 'peak') {
            sum += Math.max(leftVal, rightVal)
          } else {
            // RMS averaging
            sum += (leftVal + rightVal) / 2
          }
          count++
        }

        let bandValue = count > 0 ? sum / count : -100

        // Apply tilt and weighting
        bandValue = applyTilt(bandValue, centerFreq)
        bandValue = applyWeighting(bandValue, centerFreq)

        // Smooth spectrum data
        spectrumDataRef.current[i] = spectrumDataRef.current[i] * smoothing + bandValue * (1 - smoothing)

        // Update peak hold
        if (state.peakHold) {
          if (spectrumDataRef.current[i] > spectrumPeakRef.current[i]) {
            spectrumPeakRef.current[i] = spectrumDataRef.current[i]
            peakDecayRef.current[i] = 0
          } else {
            peakDecayRef.current[i]++
            if (peakDecayRef.current[i] > 60) {
              spectrumPeakRef.current[i] -= 0.5
            }
          }
        }
      }

      // Calculate levels
      let leftPeak = 0
      let rightPeak = 0
      let leftRms = 0
      let rightRms = 0
      let correlation = 0
      let leftEnergy = 0
      let rightEnergy = 0

      for (let i = 0; i < leftTimeData.length; i++) {
        const l = leftTimeData[i]
        const r = rightTimeData[i]

        leftPeak = Math.max(leftPeak, Math.abs(l))
        rightPeak = Math.max(rightPeak, Math.abs(r))

        leftRms += l * l
        rightRms += r * r

        correlation += l * r
        leftEnergy += l * l
        rightEnergy += r * r
      }

      leftRms = Math.sqrt(leftRms / leftTimeData.length)
      rightRms = Math.sqrt(rightRms / rightTimeData.length)

      // Phase correlation
      const denominator = Math.sqrt(leftEnergy * rightEnergy)
      phaseCorrelationRef.current = denominator > 0 ? correlation / denominator : 0

      // Stereo width (0 = mono, 1 = wide)
      const totalEnergy = leftEnergy + rightEnergy
      stereoWidthRef.current = totalEnergy > 0 ? Math.abs(leftEnergy - rightEnergy) / totalEnergy : 0.5

      // Convert to dB
      const leftPeakDb = 20 * Math.log10(leftPeak + 1e-10)
      const rightPeakDb = 20 * Math.log10(rightPeak + 1e-10)

      // Update levels with smoothing
      leftPeakRef.current = Math.max(leftPeakRef.current * 0.95, leftPeakDb)
      rightPeakRef.current = Math.max(rightPeakRef.current * 0.95, rightPeakDb)
      leftRmsRef.current = leftRmsRef.current * smoothing + leftRms * (1 - smoothing)
      rightRmsRef.current = rightRmsRef.current * smoothing + rightRms * (1 - smoothing)

      // Peak hold
      if (state.peakHold) {
        leftPeakHoldRef.current = Math.max(leftPeakHoldRef.current, leftPeakDb)
        rightPeakHoldRef.current = Math.max(rightPeakHoldRef.current, rightPeakDb)
      }

      // Clip detection
      if (leftPeak > 0.99) clipLeftRef.current = true
      if (rightPeak > 0.99) clipRightRef.current = true

      // Draw all canvases
      drawSpectrum()
      drawPhase()
      drawStereo()
      drawPeakMeters()

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isRunning, state.frozen, state.audioSource, state.spectrumMode, state.peakHold, getSmoothingFactor, getBandFrequency, freqToBin, applyTilt, applyWeighting])

  // Draw spectrum analyzer
  const drawSpectrum = useCallback(() => {
    const canvas = spectrumCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const barWidth = width / NUM_BANDS - 2

    // Clear
    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = '#27272a'
    ctx.lineWidth = 1

    // Horizontal grid lines (dB)
    for (let db = 0; db >= -60; db -= 12) {
      const y = height * (1 - (db + 60) / 60)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()

      ctx.fillStyle = '#52525b'
      ctx.font = '10px monospace'
      ctx.fillText(`${db}`, 4, y - 2)
    }

    // Draw bars
    const gradient = ctx.createLinearGradient(0, height, 0, 0)
    gradient.addColorStop(0, '#06b6d4') // cyan
    gradient.addColorStop(0.5, '#8b5cf6') // purple
    gradient.addColorStop(0.85, '#f97316') // orange
    gradient.addColorStop(1, '#ef4444') // red

    for (let i = 0; i < NUM_BANDS; i++) {
      const value = spectrumDataRef.current[i]
      const normalizedValue = Math.max(0, Math.min(1, (value + 60) / 60))
      const barHeight = normalizedValue * height
      const x = i * (barWidth + 2) + 1

      // Main bar
      ctx.fillStyle = gradient
      ctx.fillRect(x, height - barHeight, barWidth, barHeight)

      // Peak hold line
      if (state.peakHold) {
        const peakValue = spectrumPeakRef.current[i]
        const normalizedPeak = Math.max(0, Math.min(1, (peakValue + 60) / 60))
        const peakY = height - normalizedPeak * height

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(x, peakY - 2, barWidth, 2)
      }
    }

    // Draw frequency labels
    ctx.fillStyle = '#71717a'
    ctx.font = '10px monospace'
    FREQ_LABELS.forEach((label) => {
      const freq = typeof label === 'number' ? label : parseInt(label) * 1000
      const logMin = Math.log10(MIN_FREQ)
      const logMax = Math.log10(MAX_FREQ)
      const logFreq = Math.log10(freq)
      const x = ((logFreq - logMin) / (logMax - logMin)) * width
      ctx.fillText(String(label), x - 10, height - 4)
    })
  }, [state.peakHold])

  // Draw phase correlation meter
  const drawPhase = useCallback(() => {
    const canvas = phaseCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear
    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, width, height)

    // Draw scale
    const centerY = height / 2

    // Warning zone (out of phase: -1 to -0.5)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)'
    ctx.fillRect(0, centerY, width, height / 2)

    // Safe zone (in phase: 0 to +1)
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'
    ctx.fillRect(0, 0, width, centerY)

    // Draw labels
    ctx.fillStyle = '#71717a'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('+1', width / 2, 12)
    ctx.fillText('0', width / 2, centerY + 4)
    ctx.fillText('-1', width / 2, height - 4)

    // Draw correlation bar
    const correlation = phaseCorrelationRef.current
    const barHeight = Math.abs(correlation) * (height / 2)
    const barY = correlation >= 0 ? centerY - barHeight : centerY

    const barColor = correlation < -0.5 ? '#ef4444' : correlation < 0 ? '#f97316' : '#22c55e'
    ctx.fillStyle = barColor
    ctx.fillRect(width / 2 - 20, barY, 40, barHeight)

    // Correlation value
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px monospace'
    ctx.fillText(correlation.toFixed(2), width / 2, height / 2 + 30)

    // Mono compatibility indicator
    const monoCompat = correlation > 0.5 ? 'GOOD' : correlation > 0 ? 'OK' : 'WARN'
    const monoColor = correlation > 0.5 ? '#22c55e' : correlation > 0 ? '#f97316' : '#ef4444'
    ctx.fillStyle = monoColor
    ctx.font = 'bold 10px monospace'
    ctx.fillText(monoCompat, width / 2, height / 2 + 50)
  }, [])

  // Draw stereo width meter
  const drawStereo = useCallback(() => {
    const canvas = stereoCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    // Clear
    ctx.fillStyle = '#0a0a0b'
    ctx.fillRect(0, 0, width, height)

    // Draw L/R labels
    ctx.fillStyle = '#71717a'
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('L', 4, height / 2 + 4)
    ctx.textAlign = 'right'
    ctx.fillText('R', width - 4, height / 2 + 4)

    // Draw center line
    ctx.strokeStyle = '#52525b'
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()

    // Draw stereo width bar
    const centerX = width / 2
    const leftEnergy = 1 - stereoWidthRef.current
    const rightEnergy = stereoWidthRef.current

    const leftWidth = leftEnergy * (width / 2 - 20)
    const rightWidth = rightEnergy * (width / 2 - 20)

    // Left channel
    const leftGradient = ctx.createLinearGradient(centerX - leftWidth, 0, centerX, 0)
    leftGradient.addColorStop(0, '#06b6d4')
    leftGradient.addColorStop(1, '#8b5cf6')
    ctx.fillStyle = leftGradient
    ctx.fillRect(centerX - leftWidth, height / 2 - 10, leftWidth, 20)

    // Right channel
    const rightGradient = ctx.createLinearGradient(centerX, 0, centerX + rightWidth, 0)
    rightGradient.addColorStop(0, '#8b5cf6')
    rightGradient.addColorStop(1, '#06b6d4')
    ctx.fillStyle = rightGradient
    ctx.fillRect(centerX, height / 2 - 10, rightWidth, 20)
  }, [])

  // Draw peak meters
  const drawPeakMeters = useCallback(() => {
    const canvas = peakCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio()
    }
  }, [stopAudio])

  // Update canvas sizes on resize
  useEffect(() => {
    const updateCanvasSizes = () => {
      const spectrumCanvas = spectrumCanvasRef.current
      const phaseCanvas = phaseCanvasRef.current
      const stereoCanvas = stereoCanvasRef.current
      const peakCanvas = peakCanvasRef.current

      if (spectrumCanvas) {
        const rect = spectrumCanvas.getBoundingClientRect()
        spectrumCanvas.width = rect.width * window.devicePixelRatio
        spectrumCanvas.height = rect.height * window.devicePixelRatio
        const ctx = spectrumCanvas.getContext('2d')
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }

      if (phaseCanvas) {
        const rect = phaseCanvas.getBoundingClientRect()
        phaseCanvas.width = rect.width * window.devicePixelRatio
        phaseCanvas.height = rect.height * window.devicePixelRatio
        const ctx = phaseCanvas.getContext('2d')
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }

      if (stereoCanvas) {
        const rect = stereoCanvas.getBoundingClientRect()
        stereoCanvas.width = rect.width * window.devicePixelRatio
        stereoCanvas.height = rect.height * window.devicePixelRatio
        const ctx = stereoCanvas.getContext('2d')
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }

      if (peakCanvas) {
        const rect = peakCanvas.getBoundingClientRect()
        peakCanvas.width = rect.width * window.devicePixelRatio
        peakCanvas.height = rect.height * window.devicePixelRatio
        const ctx = peakCanvas.getContext('2d')
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
    }

    updateCanvasSizes()
    window.addEventListener('resize', updateCanvasSizes)

    return () => {
      window.removeEventListener('resize', updateCanvasSizes)
    }
  }, [])

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
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left: Spectrum + Meters */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Spectrum Analyzer */}
          <div className="flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Spectrum</span>
              </div>

              <div className="flex items-center gap-2">
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
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border ${state.peakHold ? 'border-yellow-500/50 bg-yellow-500/20 text-yellow-400' : 'border-[#27272a] text-zinc-500'}`}
                >
                  Hold
                </button>
              </div>
            </div>

            <div className="flex-1 relative">
              <canvas
                ref={spectrumCanvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Peak/RMS Meters */}
          <div className="h-48 bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col">
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

            <div className="flex-1 relative">
              <canvas
                ref={peakCanvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Right: Stereo/Phase */}
        <div className="w-48 flex flex-col gap-4">
          {/* Phase Correlation */}
          <div className="flex-1 bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Phase</span>
            </div>

            <div className="flex-1 relative">
              <canvas
                ref={phaseCanvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>

          {/* Stereo Width */}
          <div className="h-32 bg-[#111113] rounded-xl border border-[#27272a] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Stereo</span>
            </div>

            <div className="flex-1 relative">
              <canvas
                ref={stereoCanvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
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
