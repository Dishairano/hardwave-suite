import { useEffect, useState, useCallback, useRef } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { SplashScreen } from './components/SplashScreen'
import { Onboarding } from './components/Onboarding'
import { Shell } from './components/Shell'
import { UpdateModal } from './components/UpdateModal'
import { CrashReportModal } from './components/CrashReportModal'
import { SettingsPanel } from './components/SettingsPanel'
import { getVersion } from '@tauri-apps/api/app'
import * as api from './lib/api'
import type { Product, SubscriptionInfo, UpdateChannel, UserTheme } from './lib/api'
import { applyTheme, clearThemeOverrides } from './lib/applyTheme'

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
  const [appVersion, setAppVersion] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [, setUpdateChannel] = useState<UpdateChannel>('stable')
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [userTheme, setUserTheme] = useState<UserTheme | null>(null)

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

  // Pull the user's saved theme (per-user palette) once they're authed and
  // apply it to the document. Splash + login screens render before this
  // effect fires, so they always paint in the Hardwave default — matches
  // the `applyTo.splash = false` default of the backend contract.
  useEffect(() => {
    if (!user) {
      setUserTheme(null)
      clearThemeOverrides()
      return
    }
    let cancelled = false
    api.getUserTheme()
      .then((theme) => {
        if (cancelled) return
        setUserTheme(theme)
        applyTheme(theme)
      })
      .catch(() => {
        // Backend missing or first-time user — keep defaults silently.
      })
    return () => { cancelled = true }
  }, [user])

  // Local optimistic update — called by SettingsPanel after a save so the UI
  // re-paints instantly without waiting for a re-fetch.
  const handleThemeChange = useCallback((next: UserTheme | null) => {
    setUserTheme(next)
    applyTheme(next)
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

  if (showSplash) {
    return <SplashScreen dataReady={dataReady} onFinished={handleSplashFinished} />
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="app-shell">
      {/* Tauri title bar: a drag region only. The OS draws the window
          controls (decorations: true in tauri.conf.json). */}
      <div className="titlebar" data-tauri-drag-region>
        <div className="tb-title">Hardwave</div>
        <div className="tb-version">{appVersion ? `v${appVersion}` : ''}</div>
      </div>

      <Shell
        user={user}
        subscription={subscription}
        appVersion={appVersion}
        preloadedProducts={preloadedProducts}
        preloadedVersions={preloadedVersions}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={handleLogout}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          loadChannelAndSubscription()
        }}
        userTheme={userTheme}
        onThemeChange={handleThemeChange}
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

