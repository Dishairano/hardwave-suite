/**
 * Hook for receiving audio data from the VST Bridge plugin
 *
 * Polls the Tauri backend for FFT data streamed from the DAW
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'

/** Number of frequency bands in FFT analysis */
export const NUM_BANDS = 64

/** Audio data received from VST plugin */
export interface VstAudioData {
  connected: boolean
  sample_rate: number
  timestamp_ms: number
  left_bands: number[]
  right_bands: number[]
  left_peak: number
  right_peak: number
  left_rms: number
  right_rms: number
}

/** Hook state */
export interface UseVstAudioState {
  /** Whether the WebSocket server is running */
  serverRunning: boolean
  /** Whether a VST client is connected */
  vstConnected: boolean
  /** Latest audio data from VST */
  audioData: VstAudioData | null
  /** Error message if any */
  error: string | null
}

/** Hook actions */
export interface UseVstAudioActions {
  /** Start the WebSocket server */
  startServer: (port?: number) => Promise<void>
  /** Stop the WebSocket server */
  stopServer: () => Promise<void>
}

/** Default audio data (silence) */
export const defaultAudioData: VstAudioData = {
  connected: false,
  sample_rate: 0,
  timestamp_ms: 0,
  left_bands: Array(NUM_BANDS).fill(-100),
  right_bands: Array(NUM_BANDS).fill(-100),
  left_peak: -100,
  right_peak: -100,
  left_rms: 0,
  right_rms: 0,
}

/**
 * Hook for receiving audio data from VST Bridge plugin
 *
 * @param pollInterval - How often to poll for audio data (ms), default 50ms (20Hz)
 * @param autoStart - Whether to auto-start the server on mount
 */
export function useVstAudio(
  pollInterval: number = 50,
  autoStart: boolean = false
): [UseVstAudioState, UseVstAudioActions] {
  const [serverRunning, setServerRunning] = useState(false)
  const [vstConnected, setVstConnected] = useState(false)
  const [audioData, setAudioData] = useState<VstAudioData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pollingRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  // Start WebSocket server
  const startServer = useCallback(async (port: number = 9847) => {
    try {
      setError(null)
      await invoke('start_websocket_server', { port })
      setServerRunning(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Failed to start server: ${msg}`)
      setServerRunning(false)
    }
  }, [])

  // Stop WebSocket server
  const stopServer = useCallback(async () => {
    try {
      await invoke('stop_websocket_server')
      setServerRunning(false)
      setVstConnected(false)
      setAudioData(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Failed to stop server: ${msg}`)
    }
  }, [])

  // Poll for audio data
  const pollAudioData = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      // Check connection status
      const connected = await invoke<boolean>('is_vst_connected')
      setVstConnected(connected)

      if (connected) {
        // Get latest audio data
        const data = await invoke<VstAudioData>('get_vst_audio_data')
        if (mountedRef.current) {
          setAudioData(data)
        }
      } else {
        setAudioData(null)
      }
    } catch (e) {
      // Silently ignore polling errors to avoid spamming console
    }
  }, [])

  // Check initial server state
  useEffect(() => {
    const checkServerState = async () => {
      try {
        const running = await invoke<boolean>('is_websocket_server_running')
        setServerRunning(running)
      } catch {
        // Ignore
      }
    }
    checkServerState()
  }, [])

  // Auto-start server if requested
  useEffect(() => {
    if (autoStart && !serverRunning) {
      startServer()
    }
  }, [autoStart, serverRunning, startServer])

  // Start/stop polling based on server state
  useEffect(() => {
    if (serverRunning) {
      // Start polling
      const poll = () => {
        pollAudioData()
        if (mountedRef.current && serverRunning) {
          pollingRef.current = window.setTimeout(poll, pollInterval)
        }
      }
      poll()
    } else {
      // Stop polling
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
        pollingRef.current = null
      }
    }

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [serverRunning, pollInterval, pollAudioData])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pollingRef.current) {
        clearTimeout(pollingRef.current)
      }
    }
  }, [])

  const state: UseVstAudioState = {
    serverRunning,
    vstConnected,
    audioData,
    error,
  }

  const actions: UseVstAudioActions = {
    startServer,
    stopServer,
  }

  return [state, actions]
}

export default useVstAudio
