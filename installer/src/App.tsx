import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  cancelInstall, defaultInstallDir, fetchLatestVersion, InstallProgress, LatestVersion, launchInstalled, onProgress, quit, startInstall,
} from './lib/api'
import { WindowChrome } from './components/WindowChrome'
import { Splash } from './screens/Splash'
import { Install } from './screens/Install'
import { Installing } from './screens/Installing'
import { Done } from './screens/Done'

type Screen = 'splash' | 'install' | 'installing' | 'done'

/** A screen named in the URL skips the flow: for the screenshot check only. */
function screenFromUrl(): Screen | null {
  const s = new URLSearchParams(window.location.search).get('screen')
  return s === 'install' || s === 'installing' || s === 'done' ? s : null
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromUrl() ?? 'splash')
  const [version, setVersion] = useState<LatestVersion | null>(null)
  const [installDir, setInstallDir] = useState<string>('')
  const [desktopShortcut, setDesktopShortcut] = useState(true)
  const [startMenuShortcut, setStartMenuShortcut] = useState(true)
  const [progress, setProgress] = useState<InstallProgress>({ phase: 'downloading', percent: 0, message: 'Starting…' })
  const [error, setError] = useState<string | null>(null)
  const installedExe = useRef<string | null>(null)

  // The default folder and the newest version, then the install screen once the splash has played.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [dir, v] = await Promise.all([defaultInstallDir(), fetchLatestVersion().catch(() => null)])
        if (cancelled) return
        setInstallDir(dir)
        setVersion(v)
      } catch (e) {
        console.error(e)
      }
    })()
    const fixed = screenFromUrl()
    const splashTimer = setTimeout(() => { if (!cancelled && !fixed) setScreen('install') }, 1800)
    return () => { cancelled = true; clearTimeout(splashTimer) }
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | null = null
    onProgress((p) => {
      setProgress(p)
      if (p.phase === 'done') setScreen('done')
    }).then((un) => { unlisten = un })
    return () => { unlisten?.() }
  }, [])

  const beginInstall = async () => {
    setError(null)
    setProgress({ phase: 'downloading', percent: 0, message: 'Starting…' })
    setScreen('installing')
    try {
      const exe = await startInstall({
        install_dir: installDir,
        create_desktop_shortcut: desktopShortcut,
        create_start_menu_shortcut: startMenuShortcut,
        launch_after: false,
      })
      installedExe.current = exe
      setScreen('done')
    } catch (e) {
      setError(String(e))
    }
  }

  const launchSuite = async () => {
    if (installedExe.current) {
      try { await launchInstalled(installedExe.current) } catch (e) { console.error('Launch failed:', e) }
    }
    await quit()
  }

  const closeInstaller = async () => { await quit() }
  const cancelAndClose = async () => { await cancelInstall(); await quit() }

  return (
    <div className="win">
      <WindowChrome />
      <AnimatePresence mode="wait">
        {screen === 'splash' && <Splash key="splash" />}
        {screen === 'install' && (
          <Install
            key="install"
            version={version}
            installDir={installDir}
            setInstallDir={setInstallDir}
            desktopShortcut={desktopShortcut}
            setDesktopShortcut={setDesktopShortcut}
            startMenuShortcut={startMenuShortcut}
            setStartMenuShortcut={setStartMenuShortcut}
            onCancel={closeInstaller}
            onInstall={beginInstall}
          />
        )}
        {screen === 'installing' && (
          <Installing key="installing" progress={progress} version={version?.version ?? null} error={error} onRetry={beginInstall} onCancel={cancelAndClose} />
        )}
        {screen === 'done' && <Done key="done" onLaunch={launchSuite} onClose={closeInstaller} />}
      </AnimatePresence>
    </div>
  )
}
