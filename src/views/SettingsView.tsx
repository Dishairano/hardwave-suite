import { useCallback, useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { SubscriptionInfo, User } from '../lib/api'

const SITE = 'https://hardwavestudios.com'

function open(url: string) {
  api.openExternalUrl(url).catch(() => { if (api.isWebUrl(url)) window.open(url, '_blank') })
}

interface Props {
  user: User
  subscription: SubscriptionInfo | null
  appVersion: string
  onSignOut: () => void
  /** Opens the appearance panel (the per-user palette), which keeps its own screen. */
  onAppearance: () => void
  /** The channel or crash-log setting changed; the app re-reads them. */
  onChanged: () => void
}

/** A switch with a line under it; the whole row toggles. */
function Toggle({ on, label, hint, disabled, onChange }: { on: boolean; label: string; hint: string; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className={`tg${disabled ? ' off' : ''}`} onClick={() => !disabled && onChange(!on)} aria-pressed={on} disabled={disabled}>
      <div><span>{label}</span><small>{hint}</small></div>
      <i className={`sw2${on ? ' on' : ''}`} />
    </button>
  )
}

/**
 * Settings as a page: the account, how updates arrive, where plug-ins go,
 * and this app. Every control talks to the same commands the old panel
 * used; nothing new on the Rust side.
 */
export function SettingsView({ user, subscription, appVersion, onSignOut, onAppearance, onChanged }: Props) {
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [channel, setChannel] = useState<api.UpdateChannel>('stable')
  const [crashLogs, setCrashLogs] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [stale, setStale] = useState<api.StalePlugin[] | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, ch, cl] = await Promise.all([
      api.getInstallPaths().catch(() => ({} as Record<string, string>)),
      api.getUpdateChannel().catch(() => 'stable' as api.UpdateChannel),
      api.getAutoAttachCrashLogs().catch(() => true),
    ])
    setPaths(p); setChannel(ch); setCrashLogs(cl)
  }, [])

  useEffect(() => { void load() }, [load])

  const pro = !!subscription?.hasSubscription
  const betaEligible = !!subscription?.betaEligible

  const setBeta = async (on: boolean) => {
    setBusy('channel')
    try { await api.setUpdateChannel(on ? 'beta' : 'stable'); setChannel(on ? 'beta' : 'stable'); onChanged() }
    catch (e) { setNote(String(e)) }
    finally { setBusy(null) }
  }
  const setLogs = async (on: boolean) => {
    setBusy('logs')
    try { await api.setAutoAttachCrashLogs(on); setCrashLogs(on); onChanged() }
    catch (e) { setNote(String(e)) }
    finally { setBusy(null) }
  }
  const changePath = async (key: string) => {
    const picked = await api.pickFolder(`Choose the ${key.toUpperCase()} folder`).catch(() => null)
    if (!picked) return
    setBusy(key)
    try { await api.setInstallPath(key, picked); await load() }
    catch (e) { setNote(String(e)) }
    finally { setBusy(null) }
  }
  const resetPath = async (key: string) => {
    setBusy(key)
    try { await api.setInstallPath(key, ''); await load() }
    catch (e) { setNote(String(e)) }
    finally { setBusy(null) }
  }
  const scan = async () => {
    setBusy('scan')
    try { setStale(await api.scanStalePlugins()) }
    catch (e) { setNote(String(e)) }
    finally { setBusy(null) }
  }
  const clean = async () => {
    if (!stale || stale.length === 0) return
    setBusy('clean')
    try { await api.removeStalePlugins(stale.map((s) => s.path)); setStale([]) }
    catch (e) { setNote(String(e)) }
    finally { setBusy(null) }
  }

  const os = navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'macOS' : 'Linux'

  return (
    <div className="a2-main">
      <div className="phd"><div><h2 className="ph1">Settings</h2><p>Your account, where plug-ins go, and how updates arrive.</p></div></div>
      {note && <div className="a2-card warn"><div className="k">Something did not work</div><p>{note}</p><div className="row"><button type="button" className="a2-btn ghost sm" onClick={() => setNote(null)}>Dismiss</button></div></div>}
      <div className="set">
        <div className="a2-card">
          <h3>Account</h3>
          <div className="kv"><span>Signed in as</span><b>{user.email}</b></div>
          <div className="kv"><span>Plan</span><b>{pro ? (subscription?.planName || 'Hardwave Pro') : 'Free'}</b></div>
          {subscription?.currentPeriodEnd && <div className="kv"><span>Renews</span><b>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</b></div>}
          <div className="row">
            <button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/dashboard/subscription`)}>{pro ? 'Manage subscription' : 'See Pro'}</button>
            <button type="button" className="a2-btn ghost sm" onClick={onSignOut}>Sign out</button>
          </div>
        </div>

        <div className="a2-card">
          <h3>Updates</h3>
          <Toggle on={channel === 'beta'} disabled={!betaEligible || busy === 'channel'} onChange={setBeta}
            label="Beta builds" hint={betaEligible ? 'Try new versions first. They expire; the stable build takes over.' : 'Included with Pro.'} />
          <Toggle on={crashLogs} disabled={busy === 'logs'} onChange={setLogs}
            label="Attach the log to crash reports" hint="When a plug-in breaks, its editor log travels with the report." />
          <p style={{ marginTop: 10 }}>Plug-ins update from the Plug-ins page: one click per plug-in, or Update all.</p>
        </div>

        <div className="a2-card">
          <h3>Install locations</h3>
          {Object.keys(paths).length === 0 ? <p>Reading the install folders…</p> : Object.entries(paths).map(([k, v]) => (
            <div className="kv" key={k}><span>{k.toUpperCase()}</span><b>{v || 'default'}</b></div>
          ))}
          <div className="row">
            {Object.keys(paths).map((k) => (
              <button type="button" key={k} className="a2-btn ghost sm" disabled={busy === k} onClick={() => changePath(k)}>Change {k.toUpperCase()}</button>
            ))}
            {Object.entries(paths).some(([, v]) => !!v) && (
              <button type="button" className="a2-btn ghost sm" onClick={() => Object.keys(paths).forEach((k) => void resetPath(k))}>Back to default</button>
            )}
            <button type="button" className="a2-btn ghost sm" onClick={() => api.openInstallFolder('vst')}>Open folder</button>
          </div>
          <div className="kv" style={{ marginTop: 10 }}><span>Old versions</span><b>{stale === null ? 'not checked' : stale.length === 0 ? 'none found' : `${stale.length} old cop${stale.length === 1 ? 'y' : 'ies'}`}</b></div>
          <div className="row">
            <button type="button" className="a2-btn ghost sm" disabled={busy === 'scan'} onClick={scan}>{busy === 'scan' ? 'Checking…' : 'Check for old versions'}</button>
            {stale && stale.length > 0 && <button type="button" className="a2-btn red sm" disabled={busy === 'clean'} onClick={clean}>{busy === 'clean' ? 'Removing…' : 'Remove them'}</button>}
          </div>
        </div>

        <div className="a2-card">
          <h3>This app</h3>
          <div className="kv"><span>Version</span><b>{appVersion || '…'}</b></div>
          <div className="kv"><span>System</span><b>{os}</b></div>
          <div className="row">
            <button type="button" className="a2-btn ghost sm" onClick={onAppearance}>Appearance</button>
            <button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/changelog`)}>What changed</button>
          </div>
        </div>
      </div>
    </div>
  )
}
