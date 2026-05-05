import { useEffect, useState, useRef, useCallback } from 'react'
import { Beaker, Lock, Loader2, CheckCircle, AlertCircle, Sparkles, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { BetaPlugin, SubscriptionInfo, UpdateChannel } from '../lib/api'

interface BetaBuildsSectionProps {
  channel: UpdateChannel
  subscription: SubscriptionInfo | null
  onSubscribe: () => void
}

interface InstallState {
  status: 'idle' | 'installing' | 'installed' | 'error'
  installPath?: string
  error?: string
}

export function BetaBuildsSection({ channel, subscription, onSubscribe }: BetaBuildsSectionProps) {
  const [plugins, setPlugins] = useState<BetaPlugin[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installs, setInstalls] = useState<Record<string, InstallState>>({})
  const [, setNowTick] = useState(0)

  const visible = channel === 'beta'
  const eligible = subscription?.betaEligible ?? false

  // Re-render every minute so countdown chips stay fresh.
  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [visible])

  // Listen for expiry events from the Rust watcher and refresh.
  useEffect(() => {
    let unlistenExpired: (() => void) | undefined
    let unlistenWarn: (() => void) | undefined
    api.onBetaExpired(() => loadManifest()).then((u) => { unlistenExpired = u })
    api.onBetaSoftWarning(() => setNowTick((n) => n + 1)).then((u) => { unlistenWarn = u })
    return () => {
      unlistenExpired?.()
      unlistenWarn?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadManifest = useCallback(async () => {
    if (!visible) return
    setLoading(true)
    setError(null)
    try {
      if (eligible) {
        const list = await api.getBetaManifest()
        setPlugins(list)
      } else {
        setPlugins([])
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [visible, eligible])

  useEffect(() => {
    loadManifest()
  }, [loadManifest])

  const handleInstall = useCallback(async (plugin: BetaPlugin) => {
    setInstalls((prev) => ({ ...prev, [plugin.pluginSlug]: { status: 'installing' } }))
    try {
      const path = await api.installBetaBuild(
        plugin.pluginSlug,
        plugin.version,
        plugin.artefactUrl,
        plugin.artefactSha256,
        plugin.expiresAt,
      )
      setInstalls((prev) => ({
        ...prev,
        [plugin.pluginSlug]: { status: 'installed', installPath: path },
      }))
    } catch (e) {
      const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
      setInstalls((prev) => ({ ...prev, [plugin.pluginSlug]: { status: 'error', error: msg } }))
    }
  }, [])

  if (!visible) return null

  return (
    <section className="mt-10" aria-labelledby="beta-builds-heading">
      <div className="flex items-center gap-2 mb-2">
        <Beaker className="w-4 h-4 text-beta" />
        <h2 id="beta-builds-heading" className="text-sm font-semibold text-white">
          Beta builds
        </h2>
        <span className="text-[9.5px] font-bold tracking-[1.5px] uppercase font-mono px-1.5 py-0.5 rounded border text-beta bg-beta/10 border-beta/40">
          PRE-RELEASE
        </span>
      </div>
      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
        Pre-release plug-ins for Hardwave Pro subscribers. Installs to a separate folder so your stable plug-ins are untouched.
      </p>

      {!eligible ? (
        <LockedState onSubscribe={onSubscribe} />
      ) : error ? (
        <ErrorRow error={error} onRetry={loadManifest} />
      ) : loading ? (
        <LoadingRow />
      ) : plugins.length === 0 ? (
        <EmptyRow />
      ) : (
        <div className="space-y-2">
          {plugins.map((p) => (
            <BetaRow
              key={`${p.pluginSlug}-${p.version}`}
              plugin={p}
              install={installs[p.pluginSlug]}
              onInstall={() => handleInstall(p)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BetaRow({
  plugin,
  install,
  onInstall,
}: {
  plugin: BetaPlugin
  install?: InstallState
  onInstall: () => void
}) {
  const status = install?.status ?? 'idle'
  const hoursLeft = computeHoursLeft(plugin.expiresAt, plugin.hoursUntilExpiry)
  const expired = hoursLeft <= 0
  const countdown = formatCountdown(hoursLeft)
  const countdownTone =
    hoursLeft < 6 ? 'red' : hoursLeft < 24 ? 'amber' : 'beta'

  const rowRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={rowRef}
      className={`grid grid-cols-[48px_1fr_auto] gap-4 items-center p-4 rounded-xl bg-white/[0.02] border ${
        expired ? 'border-zinc-700/60 opacity-60' : 'border-beta/25 hover:border-beta/40'
      } transition-colors`}
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-beta to-beta-dark flex items-center justify-center flex-shrink-0">
        <Beaker className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-white truncate">
            {prettySlug(plugin.pluginSlug)}
          </h3>
          <span className="text-[9.5px] font-bold tracking-[1.5px] uppercase font-mono px-1.5 py-0.5 rounded border text-beta bg-beta/10 border-beta/40">
            BETA · PRO
          </span>
          {!expired && (
            <CountdownChip text={countdown} tone={countdownTone} />
          )}
          {expired && (
            <span className="text-[9.5px] font-bold tracking-[1.5px] uppercase font-mono px-1.5 py-0.5 rounded border text-zinc-500 bg-white/[0.04] border-white/[0.12]">
              EXPIRED
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 font-mono">
          v{plugin.version}
          {plugin.artefactSize > 0 && (
            <span className="ml-2 text-zinc-600">{formatBytes(plugin.artefactSize)}</span>
          )}
        </div>
        {plugin.changelog && (
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
            {plugin.changelog}
          </p>
        )}
        {status === 'error' && install?.error && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-400">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{install.error}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {status === 'installing' ? (
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-beta/20 border border-beta/40 text-beta text-xs font-semibold"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Installing
          </button>
        ) : status === 'installed' ? (
          <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <CheckCircle className="w-3.5 h-3.5" />
            Installed
          </span>
        ) : expired ? (
          <button
            disabled
            className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-zinc-500 text-xs font-semibold cursor-not-allowed"
          >
            Expired
          </button>
        ) : (
          <button
            onClick={onInstall}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-beta hover:bg-beta-dark text-white text-xs font-semibold transition-colors shadow-sm shadow-beta/20"
          >
            <Download className="w-3.5 h-3.5" />
            Install beta
          </button>
        )}
      </div>
    </div>
  )
}

function LockedState({ onSubscribe }: { onSubscribe: () => void }) {
  return (
    <div className="grid grid-cols-[48px_1fr_auto] gap-4 items-center p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] opacity-90">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center flex-shrink-0">
        <Lock className="w-5 h-5 text-zinc-500" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-white">Beta plug-ins are locked</h3>
          <span className="text-[9.5px] font-bold tracking-[1.5px] uppercase font-mono px-1.5 py-0.5 rounded border text-zinc-500 bg-white/[0.04] border-white/[0.12]">
            LOCKED · PRO
          </span>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Subscribe to Hardwave Pro to unlock beta access. New builds drop every 2-3 weeks.
        </p>
      </div>
      <button
        onClick={onSubscribe}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-beta/40 hover:border-beta hover:bg-beta/10 text-beta text-xs font-semibold transition-all flex-shrink-0"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Subscribe to access
      </button>
    </div>
  )
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 px-4 py-6 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm text-zinc-500">
      <Loader2 className="w-4 h-4 animate-spin text-beta" />
      Loading beta manifest...
    </div>
  )
}

function ErrorRow({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-sm">
      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="flex-1 text-red-300 text-xs truncate">{error}</span>
      <button
        onClick={onRetry}
        className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-zinc-300 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

function EmptyRow() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
      <Beaker className="w-6 h-6 text-beta/60" />
      <p className="text-sm text-white">No beta builds available right now</p>
      <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
        New beta drops appear here every 2-3 weeks. Discord announcements in #beta-testers.
      </p>
    </div>
  )
}

function CountdownChip({ text, tone }: { text: string; tone: 'beta' | 'amber' | 'red' }) {
  const cls =
    tone === 'red'
      ? 'text-red-400 bg-red-500/10 border-red-500/30'
      : tone === 'amber'
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-beta bg-beta/10 border-beta/40'
  return (
    <span className={`text-[9.5px] font-bold tracking-[1.5px] uppercase font-mono px-1.5 py-0.5 rounded border ${cls}`}>
      {text}
    </span>
  )
}

function computeHoursLeft(expiresAt: string, fallback: number): number {
  const ts = Date.parse(expiresAt)
  if (Number.isNaN(ts)) return fallback
  return (ts - Date.now()) / (1000 * 60 * 60)
}

function formatCountdown(hoursLeft: number): string {
  if (hoursLeft <= 0) return 'EXPIRED'
  if (hoursLeft < 1) {
    const m = Math.max(1, Math.floor(hoursLeft * 60))
    return `EXPIRES IN ${m}M`
  }
  if (hoursLeft < 48) {
    const h = Math.floor(hoursLeft)
    const m = Math.floor((hoursLeft - h) * 60)
    return `EXPIRES IN ${h}H ${m}M`
  }
  const d = Math.floor(hoursLeft / 24)
  const h = Math.floor(hoursLeft - d * 24)
  return `EXPIRES IN ${d}D ${h}H`
}

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function prettySlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((s) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join(' ')
}
