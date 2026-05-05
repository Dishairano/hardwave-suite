import { useState, useEffect, useRef } from 'react'
import { Settings, FolderOpen, RotateCcw, X, Lock, AlertTriangle, Sparkles } from 'lucide-react'
import anime from 'animejs'
import * as api from '../lib/api'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

type TabId = 'paths' | 'channel'

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [tab, setTab] = useState<TabId>('paths')
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [pathsLoading, setPathsLoading] = useState(true)

  const [channel, setChannel] = useState<api.UpdateChannel>('stable')
  const [autoAttachLogs, setAutoAttachLogs] = useState(true)
  const [subscription, setSubscription] = useState<api.SubscriptionInfo | null>(null)
  const [channelLoading, setChannelLoading] = useState(true)
  const [channelError, setChannelError] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    setPathsLoading(true)
    api.getInstallPaths()
      .then(setPaths)
      .catch(() => {})
      .finally(() => setPathsLoading(false))

    setChannelLoading(true)
    setChannelError(null)
    Promise.all([
      api.getUpdateChannel().catch(() => 'stable' as api.UpdateChannel),
      api.getAutoAttachCrashLogs().catch(() => true),
      api.getSubscriptionInfo().catch((e: unknown) => {
        const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
        setChannelError(msg)
        return null
      }),
    ])
      .then(([ch, aacl, sub]) => {
        setChannel(ch)
        setAutoAttachLogs(aacl)
        setSubscription(sub)
      })
      .finally(() => setChannelLoading(false))

    anime({
      targets: backdropRef.current,
      opacity: [0, 1],
      duration: 200,
      easing: 'easeOutCubic',
    })
    anime({
      targets: panelRef.current,
      translateX: ['100%', '0%'],
      duration: 300,
      easing: 'easeOutCubic',
    })
  }, [open])

  const handleClose = () => {
    anime({
      targets: backdropRef.current,
      opacity: [1, 0],
      duration: 200,
      easing: 'easeInCubic',
    })
    anime({
      targets: panelRef.current,
      translateX: ['0%', '100%'],
      duration: 250,
      easing: 'easeInCubic',
      complete: onClose,
    })
  }

  const handleBrowse = async (key: string, title: string) => {
    const selected = await api.pickFolder(title)
    if (selected) {
      await api.setInstallPath(key, selected)
      setPaths(prev => ({ ...prev, [key]: selected }))
    }
  }

  const handleReset = async (key: string) => {
    await api.setInstallPath(key, '')
    const defaultKey = `${key}_default`
    setPaths(prev => ({ ...prev, [key]: prev[defaultKey] || '' }))
  }

  const handleToggleBeta = async () => {
    const next: api.UpdateChannel = channel === 'beta' ? 'stable' : 'beta'
    setChannel(next)
    try {
      await api.setUpdateChannel(next)
    } catch (e) {
      setChannel(channel)
      setChannelError(typeof e === 'string' ? e : e instanceof Error ? e.message : String(e))
    }
  }

  const handleToggleAutoAttach = async () => {
    const next = !autoAttachLogs
    setAutoAttachLogs(next)
    try {
      await api.setAutoAttachCrashLogs(next)
    } catch (e) {
      setAutoAttachLogs(autoAttachLogs)
      setChannelError(typeof e === 'string' ? e : e instanceof Error ? e.message : String(e))
    }
  }

  const handleSubscribe = async () => {
    try {
      await api.openExternalUrl('https://hardwavestudios.com/pricing')
    } catch {
      window.open('https://hardwavestudios.com/pricing', '_blank')
    }
  }

  if (!open) return null

  const betaEligible = subscription?.betaEligible ?? false

  return (
    <div className="fixed inset-0 z-40">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0"
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0c0c12] border-l border-white/[0.06] flex flex-col translate-x-full"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.06] flex-shrink-0">
          <Settings className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-semibold text-white flex-1">Settings</span>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-white/[0.04] flex-shrink-0" role="tablist">
          <TabButton id="paths" active={tab === 'paths'} onClick={() => setTab('paths')}>
            Install paths
          </TabButton>
          <TabButton id="channel" active={tab === 'channel'} onClick={() => setTab('channel')}>
            Update channel
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {tab === 'paths' ? (
            <PathsTab
              paths={paths}
              loading={pathsLoading}
              onBrowse={handleBrowse}
              onReset={handleReset}
            />
          ) : (
            <ChannelTab
              loading={channelLoading}
              error={channelError}
              channel={channel}
              betaEligible={betaEligible}
              autoAttachLogs={autoAttachLogs}
              onToggleBeta={handleToggleBeta}
              onToggleAutoAttach={handleToggleAutoAttach}
              onSubscribe={handleSubscribe}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  id,
  active,
  onClick,
  children,
}: {
  id: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`tabpanel-${id}`}
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-md transition-all ${
        active
          ? 'text-white bg-white/[0.06]'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
      }`}
    >
      {children}
    </button>
  )
}

function PathsTab({
  paths,
  loading,
  onBrowse,
  onReset,
}: {
  paths: Record<string, string>
  loading: boolean
  onBrowse: (key: string, title: string) => Promise<void>
  onReset: (key: string) => Promise<void>
}) {
  return (
    <div role="tabpanel" id="tabpanel-paths">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Install Locations</h3>
      {loading ? (
        <div className="text-sm text-zinc-500">Loading...</div>
      ) : (
        <div className="space-y-5">
          <PathSetting
            label="VST3 / CLAP Plugins"
            path={paths.vst3 || ''}
            defaultPath={paths.vst3_default || ''}
            isDefault={!paths.vst3 || paths.vst3 === paths.vst3_default}
            onBrowse={() => onBrowse('vst3', 'Select VST3 install folder')}
            onReset={() => onReset('vst3')}
          />
          <PathSetting
            label="Sample Packs"
            path={paths.sample || ''}
            defaultPath={paths.sample_default || ''}
            isDefault={!paths.sample || paths.sample === paths.sample_default}
            onBrowse={() => onBrowse('sample', 'Select sample packs folder')}
            onReset={() => onReset('sample')}
          />
        </div>
      )}
      <p className="text-[11px] text-zinc-600 mt-6 leading-relaxed">
        Changes apply to future installs. Already installed plugins stay in their current location.
      </p>
    </div>
  )
}

function ChannelTab({
  loading,
  error,
  channel,
  betaEligible,
  autoAttachLogs,
  onToggleBeta,
  onToggleAutoAttach,
  onSubscribe,
}: {
  loading: boolean
  error: string | null
  channel: api.UpdateChannel
  betaEligible: boolean
  autoAttachLogs: boolean
  onToggleBeta: () => void
  onToggleAutoAttach: () => void
  onSubscribe: () => void
}) {
  return (
    <div role="tabpanel" id="tabpanel-channel" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Update channel</h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Choose which builds the Suite installs. Beta builds are unstable by definition and should never be used for a paid client session.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading channel info...</div>
      ) : (
        <>
          {/* Stable channel — always on */}
          <SettingCard>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white mb-1">Stable channel</div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Production-ready releases. This is what every Hardwave user gets by default. Auto-updated, fully tested.
                </p>
              </div>
              <Toggle on={true} disabled={true} accent="green" ariaLabel="Stable channel always on" />
            </div>
          </SettingCard>

          {/* Beta channel — gated by subscription */}
          <SettingCard tinted={betaEligible}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-white">Beta channel</span>
                  <BetaPill text={betaEligible ? 'PRO' : 'LOCKED · PRO'} locked={!betaEligible} />
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Pre-release builds of upcoming plug-ins. Available to Hardwave Pro subscribers. Installs to a separate folder so your stable plug-ins are untouched. New builds drop every 2–3 weeks.
                </p>
              </div>
              {betaEligible ? (
                <Toggle
                  on={channel === 'beta'}
                  onClick={onToggleBeta}
                  accent="beta"
                  ariaLabel="Toggle beta channel"
                />
              ) : (
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Toggle on={false} disabled={true} accent="beta" ariaLabel="Beta channel locked" />
                  <Lock className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
                </div>
              )}
            </div>

            {betaEligible && channel === 'beta' && (
              <div className="mt-3 flex gap-3 px-3 py-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/30">
                <div className="w-4 h-4 rounded-full bg-amber-500 text-black text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  !
                </div>
                <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                  <strong className="text-amber-400">Beta builds may crash.</strong> Don't load these in a paid session. Bug reports go to <code className="font-mono text-[11px] text-amber-300/90">#beta-testers</code> on Discord — crash logs auto-attached.
                </p>
              </div>
            )}

            {!betaEligible && (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-[11.5px] text-zinc-500 leading-relaxed">
                  Subscribe to Hardwave Pro for early access to upcoming plug-ins before public launch.
                </p>
                <button
                  onClick={onSubscribe}
                  className="self-start flex items-center gap-1.5 px-3 py-2 rounded-lg border border-beta/40 hover:border-beta hover:bg-beta/10 text-beta text-xs font-semibold transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Subscribe to Pro
                </button>
              </div>
            )}
          </SettingCard>

          {/* Auto-attach crash logs */}
          <SettingCard>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white mb-1">Auto-attach crash logs</div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  When a beta build crashes, Suite zips the log and DAW host info and offers to attach it to a Discord post in one click.
                </p>
              </div>
              <Toggle
                on={autoAttachLogs}
                onClick={onToggleAutoAttach}
                accent="beta"
                ariaLabel="Toggle auto-attach crash logs"
              />
            </div>
          </SettingCard>
        </>
      )}
    </div>
  )
}

function SettingCard({
  children,
  tinted,
}: {
  children: React.ReactNode
  tinted?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tinted
          ? 'bg-gradient-to-b from-beta/[0.06] to-white/[0.02] border-beta/30'
          : 'bg-white/[0.02] border-white/[0.06]'
      }`}
    >
      {children}
    </div>
  )
}

function Toggle({
  on,
  onClick,
  disabled,
  accent,
  ariaLabel,
}: {
  on: boolean
  onClick?: () => void
  disabled?: boolean
  accent: 'green' | 'beta'
  ariaLabel: string
}) {
  const onColor = accent === 'green' ? 'bg-emerald-500 border-emerald-500' : 'bg-beta border-beta'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`relative w-[46px] h-[26px] rounded-full border transition-colors flex-shrink-0 ${
        on ? onColor : 'bg-[#1c1c22] border-white/[0.12]'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
    >
      <span
        className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-all ${
          on ? 'left-[22px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

function BetaPill({ text, locked }: { text: string; locked?: boolean }) {
  return (
    <span
      className={`text-[9.5px] font-bold tracking-[1.5px] uppercase font-mono px-1.5 py-0.5 rounded border ${
        locked
          ? 'text-zinc-500 bg-white/[0.04] border-white/[0.12]'
          : 'text-beta bg-beta/10 border-beta/40'
      }`}
    >
      {text}
    </span>
  )
}

function PathSetting({ label, path, defaultPath, isDefault, onBrowse, onReset }: {
  label: string
  path: string
  defaultPath: string
  isDefault: boolean
  onBrowse: () => void
  onReset: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white font-medium">{label}</span>
        {!isDefault && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
            title={`Reset to ${defaultPath}`}
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-zinc-400 truncate font-mono">
          {path}
        </div>
        <button
          onClick={onBrowse}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-xs text-zinc-300 hover:text-white transition-all flex-shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Browse
        </button>
      </div>
      {isDefault && (
        <span className="text-[10px] text-zinc-600 mt-1 block">Default location</span>
      )}
    </div>
  )
}
