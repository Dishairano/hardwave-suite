import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Search, LogOut } from 'lucide-react'
import { LoginScreen } from './components/LoginScreen'
import { SplashScreen } from './components/SplashScreen'
import { Onboarding } from './components/Onboarding'
import { HubView, type HubCounts } from './views/HubView'
import { UpdateModal } from './components/UpdateModal'
import { CrashReportModal } from './components/CrashReportModal'
import { Sidebar, type SidebarView } from './components/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { BetaBuildsSection } from './components/BetaBuildsSection'
import { getVersion } from '@tauri-apps/api/app'
import * as api from './lib/api'
import type { Product, SubscriptionInfo, UpdateChannel } from './lib/api'

interface UpdateInfo {
  version: string
  changelog: string
  date: string | null
  available: boolean
  dismissed: boolean
  downloading: boolean
  progress: number
  downloaded: boolean
  error: string | null
}

export default function App() {
  const [user, setUser] = useState<api.User | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [dataReady, setDataReady] = useState(false)
  const [preloadedProducts, setPreloadedProducts] = useState<Product[] | null>(null)
  const [preloadedVersions, setPreloadedVersions] = useState<Record<string, string> | null>(null)
  const [crashReport, setCrashReport] = useState<api.CrashReport | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    version: '',
    changelog: '',
    date: null,
    available: false,
    dismissed: false,
    downloading: false,
    progress: 0,
    downloaded: false,
    error: null,
  })
  const initRan = useRef(false)

  // Shell-level UI state
  const [view, setView] = useState<SidebarView>('plugins')
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<HubCounts>({ total: 0, installed: 0, updates: 0, beta: 0 })
  const [appVersion, setAppVersion] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [updateChannel, setUpdateChannel] = useState<UpdateChannel>('stable')
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
    if (initRan.current) return
    initRan.current = true

    const init = async () => {
      const saved = api.loadSession()
      let authenticated = false

      if (saved) {
        try {
          await api.setToken(saved.token)
          const valid = await api.getAuthStatus()
          if (valid) {
            setUser(saved.user)
            authenticated = true
            if (!localStorage.getItem('hw_onboarding_done')) {
              setShowOnboarding(true)
            }
          } else {
            api.clearSession()
            try { await api.logout() } catch { /* clear shared token */ }
          }
        } catch {
          setUser(saved.user)
          authenticated = true
          if (!localStorage.getItem('hw_onboarding_done')) {
            setShowOnboarding(true)
          }
        }
      }

      if (authenticated) {
        try {
          const [prods, installed] = await Promise.all([
            api.getProducts(),
            api.getInstalledVersions().catch(() => ({} as Record<string, string>)),
          ])
          setPreloadedProducts(prods)
          setPreloadedVersions(installed)
          setLastSync(new Date())
        } catch {
          /* HubView will load as a fallback */
        }
      }

      setDataReady(true)
      checkForUpdates()
      api.checkCrashReport().then((r) => { if (r) setCrashReport(r) }).catch(() => {})
    }
    init()
  }, [])

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {})
  }, [])

  const loadChannelAndSubscription = useCallback(async () => {
    try {
      const [ch, sub] = await Promise.all([
        api.getUpdateChannel().catch(() => 'stable' as UpdateChannel),
        api.getSubscriptionInfo().catch(() => null),
      ])
      setUpdateChannel(ch)
      setSubscription(sub)
    } catch {
      /* non-blocking */
    }
  }, [])

  useEffect(() => {
    if (user) loadChannelAndSubscription()
  }, [user, loadChannelAndSubscription])

  const handleSubscribe = useCallback(async () => {
    try {
      await api.openExternalUrl('https://hardwavestudios.com/pricing')
    } catch {
      window.open('https://hardwavestudios.com/pricing', '_blank')
    }
  }, [])

  const checkForUpdates = async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update?.available) {
        setUpdateInfo((prev) => ({
          ...prev,
          available: true,
          version: update.version,
          changelog: update.body || '',
          date: update.date || null,
        }))
      }
    } catch { /* not in Tauri or no update */ }
  }

  const handleUpdate = async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const { relaunch } = await import('@tauri-apps/plugin-process')
      const update = await check()
      if (!update?.available) return
      setUpdateInfo((prev) => ({ ...prev, downloading: true, error: null }))
      await update.downloadAndInstall((event) => {
        if (event.event === 'Progress' && 'contentLength' in event.data) {
          const total = (event.data as { contentLength: number }).contentLength
          if (total > 0) {
            setUpdateInfo((prev) => {
              const chunkLen = (event.data as { chunkLength?: number }).chunkLength || 0
              const newProgress = Math.min(
                100,
                Math.round((((prev.progress / 100) * total + chunkLen) / total) * 100),
              )
              return { ...prev, progress: newProgress }
            })
          }
        }
        if (event.event === 'Finished') {
          setUpdateInfo((prev) => ({ ...prev, downloading: false, downloaded: true, progress: 100 }))
        }
      })
      await relaunch()
    } catch (err) {
      setUpdateInfo((prev) => ({ ...prev, downloading: false, error: String(err) }))
    }
  }

  const handleLogin = async (email: string, password: string, rememberMe: boolean) => {
    const res = await api.login(email, password)
    if (res.success && res.token && res.user) {
      if (rememberMe) {
        api.saveSession(res.token, res.user)
      }
      if (!localStorage.getItem('hw_onboarding_done')) {
        setShowOnboarding(true)
      }
      setUser(res.user)
    } else {
      throw new Error(res.error ?? 'Login failed')
    }
  }

  const handleOnboardingComplete = () => {
    localStorage.setItem('hw_onboarding_done', '1')
    setShowOnboarding(false)
  }

  const handleLogout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    api.clearSession()
    setUser(null)
  }, [])

  const handleSplashFinished = useCallback(() => {
    setShowSplash(false)
  }, [])

  const handleSidebarSelect = useCallback((next: SidebarView) => {
    if (next === 'settings') {
      setSettingsOpen(true)
      return
    }
    setView(next)
  }, [])

  const lastSyncLabel = useMemo(() => formatLastSync(lastSync), [lastSync])

  if (showSplash) {
    return <SplashScreen dataReady={dataReady} onFinished={handleSplashFinished} />
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  // Map sidebar view → content props. Beta builds is a filtered view of the
  // same product grid (only plug-ins where isBetaProduct(p) === true). Beta
  // plug-ins still appear on Plug-ins / Installed / Updates because they're
  // in the same product list — this tab just narrows to the beta cohort.
  const filter: 'all' | 'installed' | 'updates' | 'beta' =
    view === 'installed' ? 'installed'
    : view === 'updates' ? 'updates'
    : view === 'beta' ? 'beta'
    : 'all'

  const topbarTitle = topbarTitleFor(view)
  const topbarMeta = topbarMetaFor(view, counts)

  const showHub = view === 'plugins' || view === 'installed' || view === 'updates' || view === 'beta'
  const showHelp = view === 'help'

  return (
    <div className="app-shell">
      {/* Tauri title bar — drag region only. Native OS window controls
          (Windows ⨯ □ ─ on the right, macOS traffic lights top-left) are
          rendered by the OS via `decorations: true` in tauri.conf.json,
          so we don't paint our own. The 32px strip is just a draggable
          ribbon with the app name. */}
      <div className="titlebar" data-tauri-drag-region>
        <div className="tb-title">Hardwave Suite</div>
        <div className="tb-version">{appVersion ? `v${appVersion}` : ''}</div>
      </div>

      <div className="shell">
        <Sidebar
          active={view}
          onSelect={handleSidebarSelect}
          updateCount={counts.updates}
          betaCount={counts.beta}
          user={user}
          onAccountClick={() => setSettingsOpen(true)}
        />

        <main className="main">
          <div className="topbar">
            <div className="topbar-title">{topbarTitle}</div>
            <div className="topbar-meta">{topbarMeta}</div>
            <div className="search">
              <Search size={13} />
              <input
                placeholder="Search plug-ins…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="kbd">⌘K</span>
            </div>
            <button
              className="btn"
              onClick={handleLogout}
              type="button"
              title={`Sign out (${user.email})`}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>

          {showHub && (
            <div className="content">
              {view === 'beta' && (
                /* Channel switcher + subscription gating sits above the card
                   grid. Tells the user whether they're on stable or beta auto-
                   updates and offers Pro upgrade if not subscribed. The actual
                   per-plug-in beta builds render as cards below. */
                <BetaBuildsSection
                  channel={updateChannel}
                  subscription={subscription}
                  onSubscribe={handleSubscribe}
                />
              )}
              <HubView
                preloadedProducts={preloadedProducts}
                preloadedVersions={preloadedVersions}
                filter={filter}
                search={search}
                onCountsChange={setCounts}
                onLastSyncChange={setLastSync}
              />
            </div>
          )}

          {showHelp && (
            <div className="content">
              <div className="help-panel">
                <h2>Help &amp; bugs</h2>
                <p>
                  Need a hand? The fastest paths:
                </p>
                <p>
                  <a href="https://hardwavestudios.com/support" target="_blank" rel="noreferrer">
                    Open the support hub
                  </a>{' '}
                  for guides, FAQs and contact options.
                </p>
                <p>
                  Found a bug? Send a crash report from the plug-in window if you have one — otherwise email{' '}
                  <a href="mailto:support@hardwavestudios.com">support@hardwavestudios.com</a> with the build version
                  and steps to reproduce.
                </p>
                <p>
                  Pre-release testers: report beta issues in the Discord <strong>#beta-testers</strong> channel.
                </p>
              </div>
            </div>
          )}

          <div className="statusbar">
            <span className="pip" />
            <span>CONNECTED</span>
            <span className="sb-sep">·</span>
            <span>
              {counts.installed} installed · {counts.updates} update{counts.updates === 1 ? '' : 's'} · {counts.beta} in beta
            </span>
            <span className="sb-tail">
              {appVersion ? `v${appVersion}` : ''}
              {lastSyncLabel && ` — last sync ${lastSyncLabel}`}
            </span>
          </div>
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          loadChannelAndSubscription()
        }}
      />

      {crashReport && (
        <CrashReportModal report={crashReport} onDone={() => setCrashReport(null)} />
      )}

      {updateInfo.available && !updateInfo.dismissed && (
        <UpdateModal
          version={updateInfo.version}
          changelog={updateInfo.changelog}
          date={updateInfo.date}
          downloading={updateInfo.downloading}
          progress={updateInfo.progress}
          downloaded={updateInfo.downloaded}
          error={updateInfo.error}
          onUpdate={handleUpdate}
          onDismiss={() => setUpdateInfo((prev) => ({ ...prev, dismissed: true }))}
        />
      )}
    </div>
  )
}

function topbarTitleFor(view: SidebarView): string {
  switch (view) {
    case 'installed':
      return 'Installed'
    case 'updates':
      return 'Updates'
    case 'beta':
      return 'Beta builds'
    case 'help':
      return 'Help & bugs'
    case 'settings':
      return 'Settings'
    default:
      return 'Plug-ins'
  }
}

function topbarMetaFor(view: SidebarView, c: HubCounts): string {
  if (view === 'beta') return `${c.beta} in beta`
  if (view === 'installed') return `${c.installed} installed`
  if (view === 'updates') return `${c.updates} update${c.updates === 1 ? '' : 's'} available`
  return `${c.total} in catalogue · ${c.installed} installed · ${c.updates} update${c.updates === 1 ? '' : 's'} · ${c.beta} in beta`
}

function formatLastSync(date: Date | null): string {
  if (!date) return ''
  const diffSec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const min = Math.round(diffSec / 60)
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return date.toLocaleString()
}
