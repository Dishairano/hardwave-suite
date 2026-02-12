import { useState, useEffect } from 'react'
import {
  Music,
  Folder,
  Zap,
  Settings,
  HardDrive,
  Activity,
  Clock,
  Star,
  Tag,
  FolderPlus,
  Search,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  Keyboard,
  Volume2
} from 'lucide-react'
import type { File } from '../types'

const proTips = [
  { title: 'Phase Correlation', text: 'Keep your phase meter above 0 for mono compatibility. Below -0.5 means phase issues!' },
  { title: 'Peak vs RMS', text: 'Use peak meters for clipping, RMS for perceived loudness. Both matter for mastering.' },
  { title: 'Spectrum Analysis', text: 'Check your low end (20-100Hz) for mud and your highs (10k+) for harshness.' },
  { title: 'Stereo Width', text: 'Keep your kick and bass centered. Wide stereo on leads creates space in the mix.' },
  { title: 'Response Time', text: 'Use fast response for transients, slow for overall tonal balance.' },
  { title: 'Reference Tracks', text: 'Compare your spectrum to professional tracks to check your balance.' },
]

const shortcuts = [
  { key: 'Space', action: 'Play/Pause' },
  { key: '⌘ + F', action: 'Search' },
  { key: '⌘ + I', action: 'Import' },
  { key: 'Del', action: 'Delete' },
]

interface HubViewProps {
  user: { email: string; displayName: string | null } | null
  stats: { totalFiles: number; totalTags: number; totalCollections: number; totalFavorites: number }
  recentFiles: File[]
  onNavigateOrganizer: () => void
  onNavigateKickforge: () => void
  onNavigateSettings: () => void
  onImportFolder: () => void
  onCreateTag: () => void
  onCreateCollection: () => void
}

export function HubView({
  user,
  stats,
  recentFiles,
  onNavigateOrganizer,
  onNavigateKickforge,
  onNavigateSettings,
  onImportFolder,
  onCreateTag,
  onCreateCollection,
}: HubViewProps) {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * proTips.length))
  const [sessionTime, setSessionTime] = useState(0)

  const greeting = getGreeting()
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Producer'
  const tip = proTips[tipIndex]
  const hasFiles = stats.totalFiles > 0

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1)
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const formatSessionTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0a0a0b]">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 bg-[#111113] border-b border-[#27272a]/50 flex items-center px-6 drag">
          <div className="flex items-center gap-3 no-drag">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-white">Hardwave Suite</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-zinc-500">Engine Ready v2.4.1</span>
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4 no-drag">
            <span className="text-xs text-zinc-500">{user?.email}</span>
            <button
              onClick={onNavigateSettings}
              className="w-9 h-9 rounded-lg bg-[#18181b] hover:bg-[#27272a] flex items-center justify-center text-zinc-400 hover:text-white transition-all"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 border border-[#27272a] p-8">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500" />
              <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-[10px] font-medium text-cyan-400">
                  {hasFiles ? `${stats.totalFiles.toLocaleString()} samples detected` : 'No samples yet'}
                </span>
              </div>

              <h1 className="text-3xl font-bold text-white mb-2">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">{displayName}</span>
              </h1>
              <p className="text-zinc-400 mb-6">Ready to create something legendary?</p>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard icon={<Activity className="w-4 h-4" />} label="Tools Available" value="1" color="cyan" />
                <StatCard icon={<Zap className="w-4 h-4" />} label="Coming Soon" value="3" color="purple" />
                <StatCard icon={<Star className="w-4 h-4" />} label="Subscription" value="Active" color="pink" />
                <StatCard icon={<Clock className="w-4 h-4" />} label="Session Time" value={formatSessionTime(sessionTime)} color="yellow" />
              </div>
            </div>

            {/* Tool Cards */}
            <div className="grid grid-cols-1 gap-6">
              <ToolCard
                name="Hardwave Analyser"
                description="All-in-one spectrum analyzer, stereo/phase monitoring, and level metering. Real-time analysis with peak hold, RMS modes, and phase correlation."
                icon={<Activity className="w-7 h-7" />}
                stat="Audio analysis tool"
                gradient="from-orange-500 to-green-500"
                onClick={() => window.open('https://github.com/Dishairano/hardwave-suite/releases', '_blank')}
              />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              <ActionButton icon={<Activity className="w-4 h-4" />} label="Launch Analyser" primary onClick={() => window.open('https://github.com/Dishairano/hardwave-suite/releases', '_blank')} />
              <ActionButton icon={<Settings className="w-4 h-4" />} label="Settings" onClick={onNavigateSettings} />
            </div>

            {/* Getting Started */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  Getting Started
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <GettingStartedStep
                  step={1}
                  title="Download Analyser"
                  description="Get the latest version of Hardwave Analyser from GitHub releases."
                  icon={<Activity className="w-5 h-5" />}
                />
                <GettingStartedStep
                  step={2}
                  title="Route your audio"
                  description="Use virtual audio cable or your DAW's monitoring to send audio to the analyser."
                  icon={<Volume2 className="w-5 h-5" />}
                />
                <GettingStartedStep
                  step={3}
                  title="Analyze & improve"
                  description="Check spectrum, stereo width, phase and levels in real-time while mixing."
                  icon={<Zap className="w-5 h-5" />}
                />
              </div>
            </div>

            {/* Pro Tip */}
            <div className="bg-[#111113] rounded-xl p-5 border border-[#27272a] flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider mb-1">Pro Tip</div>
                <div className="text-sm font-semibold text-white">{tip.title}</div>
                <div className="text-sm text-zinc-400 mt-0.5">{tip.text}</div>
              </div>
              <button
                onClick={() => setTipIndex((tipIndex + 1) % proTips.length)}
                className="text-zinc-500 hover:text-white transition-colors flex-shrink-0 p-2 hover:bg-[#27272a] rounded-lg"
                title="Next tip"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-72 bg-[#111113] border-l border-[#27272a]/50 flex flex-col overflow-hidden">
        {/* System Status */}
        <div className="p-5 border-b border-[#27272a]/50">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">System Status</h3>
          <div className="space-y-4">
            <StatusItem
              icon={<HardDrive className="w-4 h-4" />}
              label="Disk Usage"
              value="234 GB"
              subValue="of 500 GB"
              progress={47}
            />
            <StatusItem
              icon={<Activity className="w-4 h-4" />}
              label="Indexing"
              value="Idle"
              status="success"
            />
            <StatusItem
              icon={<Volume2 className="w-4 h-4" />}
              label="Audio Engine"
              value="Active"
              status="success"
            />
          </div>
        </div>

        {/* Available Tools */}
        <div className="flex-1 p-5 overflow-y-auto">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Available Tools</h3>
          <div className="space-y-3">
            <ActivityItem time="Ready" text="Hardwave Analyser - Spectrum & metering" icon={<Activity className="w-3 h-3" />} />
            <ActivityItem time="Coming" text="Sample Organizer - File management" icon={<Folder className="w-3 h-3" />} />
            <ActivityItem time="Coming" text="Kickforge - Kick synthesizer" icon={<Zap className="w-3 h-3" />} />
            <ActivityItem time="Coming" text="More tools in development..." icon={<Star className="w-3 h-3" />} />
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="p-5 border-t border-[#27272a]/50">
          <div className="flex items-center gap-2 mb-3">
            <Keyboard className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Shortcuts</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {shortcuts.map((shortcut) => (
              <div key={shortcut.key} className="flex items-center justify-between">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#27272a] rounded text-zinc-400">{shortcut.key}</kbd>
                <span className="text-[10px] text-zinc-500">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'cyan' | 'purple' | 'pink' | 'yellow' }) {
  const colors = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    pink: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }

  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-bold font-mono text-white">{value}</span>
    </div>
  )
}

function ToolCard({
  name,
  description,
  icon,
  stat,
  gradient,
  onClick,
}: {
  name: string
  description: string
  icon: React.ReactNode
  stat: string
  gradient: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left p-6 bg-[#111113] rounded-2xl border border-[#27272a] hover:border-[#3f3f46] transition-all hover:shadow-xl hover:shadow-black/20"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-xl font-bold text-white mb-1">{name}</div>
          <div className="text-xs text-zinc-500">{stat}</div>
        </div>
        <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-1 transition-all" />
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </button>
  )
}

function ActionButton({ icon, label, primary, onClick }: { icon: React.ReactNode; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
        primary
          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/25'
          : 'bg-[#18181b] text-zinc-300 hover:bg-[#27272a] hover:text-white border border-[#27272a]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function RecentFileCard({ file }: { file: File }) {
  return (
    <div className="bg-[#111113] rounded-xl border border-[#27272a] p-4 hover:border-[#3f3f46] transition-all cursor-pointer group">
      {/* Waveform placeholder */}
      <div className="h-12 rounded-lg bg-[#18181b] mb-3 flex items-end justify-center gap-px p-2 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-cyan-500/40 rounded-full group-hover:bg-cyan-500/60 transition-colors"
            style={{ height: `${20 + Math.random() * 80}%` }}
          />
        ))}
      </div>
      <div className="text-sm font-medium text-white truncate mb-1" title={file.filename}>
        {file.filename}
      </div>
      <div className="flex items-center gap-2">
        {file.bpm && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
            {Math.round(file.bpm)} BPM
          </span>
        )}
        {file.detected_key && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
            {file.detected_key}
          </span>
        )}
      </div>
    </div>
  )
}

function GettingStartedStep({ step, title, description, icon }: { step: number; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#111113] rounded-xl p-6 border border-[#27272a] text-center hover:border-[#3f3f46] transition-colors">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <div className="text-xs font-bold text-cyan-400 mb-2">Step {step}</div>
      <div className="text-sm font-semibold text-white mb-2">{title}</div>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
    </div>
  )
}

function StatusItem({
  icon,
  label,
  value,
  subValue,
  progress,
  status
}: {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  progress?: number
  status?: 'success' | 'warning' | 'error'
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-zinc-400">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-xs font-medium text-white">{value}</span>
          {subValue && <span className="text-[10px] text-zinc-500 ml-1">{subValue}</span>}
          {status && (
            <span className={`ml-2 w-1.5 h-1.5 rounded-full inline-block ${
              status === 'success' ? 'bg-emerald-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
          )}
        </div>
      </div>
      {progress !== undefined && (
        <div className="h-1 bg-[#27272a] rounded-full overflow-hidden">
          <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}

function ActivityItem({ time, text, icon }: { time: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-lg bg-[#27272a] flex items-center justify-center text-zinc-500 flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300 leading-relaxed">{text}</p>
        <span className="text-[10px] text-zinc-600">{time}</span>
      </div>
    </div>
  )
}
