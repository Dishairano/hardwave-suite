import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  cancelInstall, defaultInstallDir, fetchLatestVersion, InstallProgress, LatestVersion, launchInstalled, launchMode, onProgress,
  onUninstallProgress, quit, startInstall, startUninstall, UninstallFailure, UninstallProgress, uninstallOverview,
} from './lib/api'
import { WindowChrome } from './components/WindowChrome'
import { Splash } from './screens/Splash'
import { Install } from './screens/Install'
import { Installing } from './screens/Installing'
import { Done } from './screens/Done'
import { Remove } from './screens/Remove'
import { Removing } from './screens/Removing'
import { Removed } from './screens/Removed'
import { CannotRemove } from './screens/CannotRemove'

type InstallScreen = 'splash' | 'install' | 'installing' | 'done'
type UninstallScreen = 'remove' | 'removing' | 'removed' | 'cannot-remove'
type Screen = InstallScreen | UninstallScreen

const UNINSTALL_SCREENS: Screen[] = ['remove', 'removing', 'removed', 'cannot-remove']
const URL_SCREENS: Screen[] = ['install', 'installing', 'done', ...UNINSTALL_SCREENS]

/** A screen named in the URL skips the flow: for the screenshot check only. */
function screenFromUrl(): Screen | null {
  const s = new URLSearchParams(window.location.search).get('screen')
  return URL_SCREENS.find((u) => u === s) ?? null
}

export default function App() {
  // No screen until the exe has said which mode it is in, so uninstalling never shows an install screen.
  const [screen, setScreen] = useState<Screen | null>(() => screenFromUrl())
  const [version, setVersion] = useState<LatestVersion | null>(null)
  const [installDir, setInstallDir] = useState<string>('')
  const [desktopShortcut, setDesktopShortcut] = useState(true)
  const [startMenuShortcut, setStartMenuShortcut] = useState(true)
  const [progress, setProgress] = useState<InstallProgress>({ phase: 'downloading', percent: 0, message: 'Starting…' })
  const [error, setError] = useState<string | null>(null)
  const installedExe = useRef<string | null>(null)

  const [plugins, setPlugins] = useState<string[] | null>(null)
  const [removePlugins, setRemovePlugins] = useState(false)
  const [removal, setRemoval] = useState<UninstallProgress>({ steps: [], done: 0 })
  const [failure, setFailure] = useState<UninstallFailure>({ step: null, reason: '' })

  // Install mode: the default folder and the newest version, then the install screen once the splash has played.
  // Uninstall mode: the plug-ins the Suite installed, for the option on the first screen. Nothing is removed yet.
  useEffect(() => {
    let cancelled = false
    let splashTimer: ReturnType<typeof setTimeout> | undefined
    const fixed = screenFromUrl()
    ;(async () => {
      const mode = await launchMode().catch((e) => { console.error(e); return null })
      if (cancelled || mode === null) return
      if (mode === 'uninstall') {
        if (!fixed) setScreen('remove')
        const names = await uninstallOverview().catch(() => [])
        if (!cancelled) setPlugins(names)
        return
      }
      if (!fixed) setScreen('splash')
      splashTimer = setTimeout(() => { if (!cancelled && !fixed) setScreen('install') }, 1800)
      try {
        const [dir, v] = await Promise.all([defaultInstallDir(), fetchLatestVersion().catch(() => null)])
        if (cancelled) return
        setInstallDir(dir)
        setVersion(v)
      } catch (e) {
        console.error(e)
      }
    })()
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

  useEffect(() => {
    let unlisten: (() => void) | null = null
    onUninstallProgress(setRemoval).then((un) => { unlisten = un })
    return () => { unlisten?.() }
  }, [])

  const beginRemove = async () => {
    setRemoval({ steps: [], done: 0 })
    setScreen('removing')
    try {
      await startUninstall(removePlugins)
      setScreen('removed')
    } catch (e) {
      setFailure(e as UninstallFailure)
      setScreen('cannot-remove')
    }
  }

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

  const uninstalling = screen !== null && UNINSTALL_SCREENS.includes(screen)

  return (
    <div className="win">
      <WindowChrome title={uninstalling ? 'HARDWAVE · UNINSTALL' : 'HARDWAVE · SETUP'} closable={screen !== 'removing'} />
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
        {screen === 'remove' && (
          <Remove
            key="remove"
            plugins={plugins}
            removePlugins={removePlugins}
            setRemovePlugins={setRemovePlugins}
            onCancel={closeInstaller}
            onRemove={beginRemove}
          />
        )}
        {screen === 'removing' && <Removing key="removing" progress={removal} />}
        {screen === 'removed' && <Removed key="removed" removedPlugins={removePlugins} onClose={closeInstaller} />}
        {screen === 'cannot-remove' && <CannotRemove key="cannot-remove" failure={failure} onClose={closeInstaller} onRetry={beginRemove} />}
      </AnimatePresence>
    </div>
  )
}
