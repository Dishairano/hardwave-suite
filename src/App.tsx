import { useEffect, useState, useCallback, useRef } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { SplashScreen } from './components/SplashScreen'
import { Onboarding } from './components/Onboarding'
import { HubView } from './views/HubView'
import { CollabsView } from './views/CollabsView'
import { UpdateModal } from './components/UpdateModal'
import { Package, Users } from 'lucide-react'
import * as api from './lib/api'
import type { Product } from './lib/api'

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
  const [activeTab, setActiveTab] = useState<'hub' | 'collabs'>('hub')
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

      // Preload products if authenticated
      if (authenticated) {
        try {
          const [prods, installed] = await Promise.all([
            api.getProducts(),
            api.getInstalledVersions().catch(() => ({} as Record<string, string>)),
          ])
          setPreloadedProducts(prods)
          setPreloadedVersions(installed)
        } catch {
          // Products will load in HubView as fallback
        }
      }

      setDataReady(true)
      checkForUpdates()
    }
    init()
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
              const newProgress = Math.min(100, Math.round(((prev.progress / 100) * total + chunkLen) / total * 100))
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

  const handleLogout = async () => {
    try { await api.logout() } catch { /* ignore */ }
    api.clearSession()
    setUser(null)
  }

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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Tab navigation */}
      <div className="flex items-center gap-0 bg-[#08080c] border-b border-white/[0.06] px-4 flex-shrink-0" data-tauri-drag-region>
        <button
          onClick={() => setActiveTab('hub')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative ${
            activeTab === 'hub'
              ? 'text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Package size={13} />
          Hub
          {activeTab === 'hub' && (
            <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-red-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('collabs')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all relative ${
            activeTab === 'collabs'
              ? 'text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users size={13} />
          Collabs
          {activeTab === 'collabs' && (
            <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'hub' ? (
          <HubView user={user} onLogout={handleLogout} preloadedProducts={preloadedProducts} preloadedVersions={preloadedVersions} />
        ) : (
          <CollabsView user={user} />
        )}
      </div>

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
