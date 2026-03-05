import { useEffect, useState } from 'react'
import { LoginScreen } from './components/LoginScreen'
import { HubView } from './views/HubView'
import { UpdateBanner } from './components/UpdateBanner'
import * as api from './lib/api'

interface UpdateInfo {
  version: string
  available: boolean
  downloading: boolean
  progress: number
  downloaded: boolean
  error: string | null
}

export default function App() {
  const [user, setUser] = useState<api.User | null>(null)
  const [loading, setLoading] = useState(true)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({
    version: '',
    available: false,
    downloading: false,
    progress: 0,
    downloaded: false,
    error: null,
  })

  useEffect(() => {
    const init = async () => {
      const saved = api.loadSession()
      if (saved) {
        try {
          const valid = await api.getAuthStatus()
          if (valid) {
            setUser(saved.user)
          } else {
            api.clearSession()
          }
        } catch {
          setUser(saved.user)
        }
      }
      setLoading(false)
      checkForUpdates()
    }
    init()
  }, [])

  const checkForUpdates = async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update?.available) {
        setUpdateInfo((prev) => ({ ...prev, available: true, version: update.version }))
      }
    } catch { /* not in Tauri or no update */ }
  }

  const handleUpdate = async () => {
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const { relaunch } = await import('@tauri-apps/plugin-process')
      const update = await check()
      if (!update?.available) return
      setUpdateInfo((prev) => ({ ...prev, downloading: true }))
      await update.downloadAndInstall((event) => {
        if (event.event === 'Finished') {
          setUpdateInfo((prev) => ({ ...prev, downloading: false, downloaded: true }))
        }
      })
      await relaunch()
    } catch (err) {
      setUpdateInfo((prev) => ({ ...prev, downloading: false, error: String(err) }))
    }
  }

  const handleLogin = async (email: string, password: string) => {
    const res = await api.login(email, password)
    if (res.success && res.token && res.user) {
      api.saveSession(res.token, res.user)
      setUser(res.user)
    } else {
      throw new Error(res.error ?? 'Login failed')
    }
  }

  const handleLogout = async () => {
    try { await api.logout() } catch { /* ignore */ }
    api.clearSession()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#08080c]">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-fuchsia-600 animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {updateInfo.available && (
        <UpdateBanner
          version={updateInfo.version}
          downloading={updateInfo.downloading}
          progress={updateInfo.progress}
          downloaded={updateInfo.downloaded}
          error={updateInfo.error}
          onUpdate={handleUpdate}
        />
      )}
      <HubView user={user} onLogout={handleLogout} />
    </div>
  )
}
