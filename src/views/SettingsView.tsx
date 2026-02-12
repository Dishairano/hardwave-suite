import { useState, useEffect, useCallback, useRef } from 'react'
import {
  User,
  Monitor,
  Download,
  Info,
  LogOut,
  Check,
  RefreshCw,
  Volume2,
  Plug,
  Wifi,
  WifiOff,
  ArrowLeft,
  ExternalLink,
  Bug,
  X,
  Sparkles,
  AlertCircle,
} from 'lucide-react'

interface SettingsViewProps {
  user: {
    email: string
    displayName: string | null
  } | null
  onLogout: () => void
  onCheckUpdates: () => void
  onBack?: () => void
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export function SettingsView({ user, onLogout, onCheckUpdates, onBack }: SettingsViewProps) {
  const [audioOutput, setAudioOutput] = useState('default')
  const [sampleRate, setSampleRate] = useState('44100')
  const [theme, setTheme] = useState('dark')
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [vstPort, setVstPort] = useState('9847')
  const [vstAutoStart, setVstAutoStart] = useState(true)
  const [vstConnected, setVstConnected] = useState(false)

  // Update state
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [updateProgress, setUpdateProgress] = useState(0)
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateError, setUpdateError] = useState('')

  // Debug mode (hold Shift+Alt and click version 5 times)
  const [showDebug, setShowDebug] = useState(false)
  const debugClicksRef = useRef(0)

  // Simulate checking VST connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const connected = await invoke('is_vst_connected')
        setVstConnected(connected as boolean)
      } catch {
        setVstConnected(false)
      }
    }
    checkConnection()
    const interval = setInterval(checkConnection, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleCheckUpdates = async () => {
    setUpdateState('checking')
    setUpdateError('')

    try {
      await onCheckUpdates()
      // If no update found after real check, go back to idle
      setTimeout(() => {
        if (updateState === 'checking') {
          setUpdateState('idle')
        }
      }, 3000)
    } catch (err) {
      setUpdateState('error')
      setUpdateError(String(err))
    }
  }

  // Debug: Simulate finding an update
  const simulateUpdateAvailable = useCallback(() => {
    setUpdateState('available')
    setUpdateVersion('0.5.0')
    setUpdateProgress(0)
  }, [])

  // Debug: Simulate download with progress
  const simulateDownload = useCallback(() => {
    setUpdateState('downloading')
    setUpdateProgress(0)

    const interval = setInterval(() => {
      setUpdateProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setUpdateState('ready')
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 300)
  }, [])

  // Debug: Simulate error
  const simulateError = useCallback(() => {
    setUpdateState('error')
    setUpdateError('Network error: Unable to connect to update server')
  }, [])

  // Debug: Reset state
  const resetUpdateState = useCallback(() => {
    setUpdateState('idle')
    setUpdateProgress(0)
    setUpdateVersion('')
    setUpdateError('')
  }, [])

  // Handle version click for debug mode
  const handleVersionClick = (e: React.MouseEvent) => {
    if (e.shiftKey && e.altKey) {
      debugClicksRef.current++
      if (debugClicksRef.current >= 5) {
        setShowDebug(true)
        debugClicksRef.current = 0
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0b]">
      {/* Header */}
      <div className="h-16 bg-[#111113] border-b border-[#27272a]/50 flex items-center px-6 drag">
        <div className="flex items-center gap-3 no-drag">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-lg bg-[#18181b] hover:bg-[#27272a] flex items-center justify-center text-zinc-400 hover:text-white transition-all mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white">Settings</span>
            <div className="text-[10px] text-zinc-500">Configure your Hardwave Suite</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 no-drag">
          <span className="text-xs text-zinc-500">{user?.email}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8 space-y-6">
          {/* Update Available Banner */}
          {updateState === 'available' && (
            <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl p-4 border border-cyan-500/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">Update Available!</div>
                <div className="text-xs text-zinc-400">Version {updateVersion} is ready to download</div>
              </div>
              <button
                onClick={simulateDownload}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
              >
                Download Now
              </button>
              <button
                onClick={resetUpdateState}
                className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Downloading Banner */}
          {updateState === 'downloading' && (
            <div className="bg-[#111113] rounded-xl p-4 border border-[#27272a]">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Download className="w-5 h-5 text-cyan-400 animate-bounce" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Downloading v{updateVersion}...</div>
                  <div className="text-xs text-zinc-500">{Math.round(updateProgress)}% complete</div>
                </div>
              </div>
              <div className="h-2 bg-[#27272a] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(updateProgress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Ready to Install Banner */}
          {updateState === 'ready' && (
            <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl p-4 border border-emerald-500/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-white">Ready to Install!</div>
                <div className="text-xs text-zinc-400">Version {updateVersion} downloaded. Restart to apply.</div>
              </div>
              <button
                onClick={() => alert('In production, this would restart the app!')}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                Restart Now
              </button>
            </div>
          )}

          {/* Error Banner */}
          {updateState === 'error' && (
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Update Failed</div>
                <div className="text-xs text-red-400">{updateError}</div>
              </div>
              <button
                onClick={resetUpdateState}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Debug Section */}
          {showDebug && (
            <Section icon={<Bug className="w-4 h-4" />} title="Debug: Update Simulator">
              <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30 mb-4">
                <div className="text-xs text-yellow-400 flex items-center gap-2">
                  <Bug className="w-3 h-3" />
                  Debug mode enabled - Use these buttons to test the update UI
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setUpdateState('checking')}
                  className="px-3 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 text-xs font-medium transition-all"
                >
                  Simulate Checking
                </button>
                <button
                  onClick={simulateUpdateAvailable}
                  className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs font-medium transition-all"
                >
                  Simulate Update Available
                </button>
                <button
                  onClick={simulateDownload}
                  className="px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs font-medium transition-all"
                >
                  Simulate Download
                </button>
                <button
                  onClick={simulateError}
                  className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-all"
                >
                  Simulate Error
                </button>
                <button
                  onClick={resetUpdateState}
                  className="px-3 py-2 rounded-lg bg-zinc-500/20 hover:bg-zinc-500/30 text-zinc-400 text-xs font-medium transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowDebug(false)}
                  className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium transition-all ml-auto"
                >
                  Hide Debug
                </button>
              </div>
              <div className="mt-3 text-[10px] text-zinc-600 font-mono">
                Current state: {updateState} | Progress: {Math.round(updateProgress)}%
              </div>
            </Section>
          )}

          {/* Account Section */}
          <Section icon={<User className="w-4 h-4" />} title="Account">
            <div className="bg-[#18181b] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-cyan-500/20">
                  {user?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {user?.displayName || user?.email || 'Unknown'}
                  </div>
                  <div className="text-xs text-zinc-500">{user?.email}</div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white text-sm font-medium transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </Section>

          {/* VST Bridge Section */}
          <Section icon={<Plug className="w-4 h-4" />} title="VST Bridge">
            <div className="space-y-4">
              <div className="bg-[#18181b] rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {vstConnected ? (
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Wifi className="w-5 h-5 text-emerald-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                      <WifiOff className="w-5 h-5 text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-white">Connection Status</div>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${vstConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                      <span className="text-xs text-zinc-500">
                        {vstConnected ? 'VST Plugin connected' : 'Waiting for connection...'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-zinc-600 font-mono">Port {vstPort}</div>
              </div>

              <SettingRow
                label="WebSocket Port"
                description="Port for VST plugin communication"
              >
                <input
                  type="text"
                  value={vstPort}
                  onChange={(e) => setVstPort(e.target.value)}
                  className="w-24 bg-[#18181b] text-white text-sm px-3 py-2 rounded-lg border border-[#27272a] focus:outline-none focus:border-cyan-500 font-mono text-center"
                />
              </SettingRow>

              <SettingRow
                label="Auto-start Server"
                description="Start WebSocket server when app launches"
              >
                <Toggle checked={vstAutoStart} onChange={setVstAutoStart} />
              </SettingRow>

              <div className="bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-xl p-4 border border-[#27272a]">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <Info className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white mb-1">Get the VST Plugin</div>
                    <p className="text-xs text-zinc-500 mb-3">
                      Download Hardwave Bridge to stream audio from your DAW directly to the Analyser.
                    </p>
                    <a
                      href="https://github.com/Dishairano/hardwave-bridge/releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Download from GitHub
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Audio Section */}
          <Section icon={<Volume2 className="w-4 h-4" />} title="Audio">
            <SettingRow
              label="Output Device"
              description="Select your audio output device"
            >
              <select
                value={audioOutput}
                onChange={(e) => setAudioOutput(e.target.value)}
                className="bg-[#18181b] text-white text-sm px-3 py-2 rounded-lg border border-[#27272a] focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="default">System Default</option>
                <option value="speakers">Speakers</option>
                <option value="headphones">Headphones</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Sample Rate"
              description="Audio playback quality"
            >
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(e.target.value)}
                className="bg-[#18181b] text-white text-sm px-3 py-2 rounded-lg border border-[#27272a] focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="44100">44.1 kHz</option>
                <option value="48000">48 kHz</option>
                <option value="96000">96 kHz</option>
              </select>
            </SettingRow>
          </Section>

          {/* Appearance Section */}
          <Section icon={<Monitor className="w-4 h-4" />} title="Appearance">
            <SettingRow
              label="Theme"
              description="Choose your preferred theme"
            >
              <div className="flex gap-2">
                {['dark', 'light', 'system'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                      theme === t
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                        : 'bg-[#18181b] text-zinc-400 hover:text-white border border-[#27272a]'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </SettingRow>
          </Section>

          {/* Updates Section */}
          <Section icon={<Download className="w-4 h-4" />} title="Updates">
            <SettingRow
              label="Automatic Updates"
              description="Download and install updates automatically"
            >
              <Toggle checked={autoUpdate} onChange={setAutoUpdate} />
            </SettingRow>

            <div className="bg-[#18181b] rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Current Version</div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-xs font-mono text-zinc-500 cursor-pointer select-none"
                    onClick={handleVersionClick}
                    title="Shift+Alt+Click 5 times for debug mode"
                  >
                    v0.4.0
                  </span>
                  {updateState === 'idle' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">
                      Latest
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleCheckUpdates}
                disabled={updateState === 'checking' || updateState === 'downloading'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-zinc-300 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${updateState === 'checking' ? 'animate-spin' : ''}`} />
                {updateState === 'checking' ? 'Checking...' : 'Check for Updates'}
              </button>
            </div>
          </Section>

          {/* About Section */}
          <Section icon={<Info className="w-4 h-4" />} title="About">
            <div className="bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 rounded-xl p-6 border border-[#27272a] text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Hardwave Suite</h3>
              <p className="text-sm text-zinc-400 mb-4">
                The ultimate suite for hardstyle, rawstyle & hardcore producers
              </p>
              <div className="flex justify-center gap-6 text-xs">
                <a href="https://hardwave.studio" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400 transition-colors">Website</a>
                <a href="https://discord.gg/hardwave" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400 transition-colors">Discord</a>
                <a href="mailto:support@hardwave.studio" className="text-zinc-500 hover:text-cyan-400 transition-colors">Support</a>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111113] rounded-xl p-5 border border-[#27272a]">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-zinc-500">{icon}</span>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-zinc-500">{description}</div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-all ${
        checked ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-[#27272a]'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
      {checked && (
        <Check className="absolute left-1.5 top-1.5 w-3 h-3 text-white" />
      )}
    </button>
  )
}
