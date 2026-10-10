import { useState } from 'react'
import { motion } from 'framer-motion'
import { open } from '@tauri-apps/plugin-dialog'
import type { LatestVersion } from '../lib/api'
import analyser from '../assets/analyser.jpg'
import wettboi from '../assets/wettboi.jpg'
import loudlab from '../assets/loudlab.jpg'

interface Props {
  version: LatestVersion | null
  installDir: string
  setInstallDir: (v: string) => void
  desktopShortcut: boolean
  setDesktopShortcut: (v: boolean) => void
  startMenuShortcut: boolean
  setStartMenuShortcut: (v: boolean) => void
  onCancel: () => void
  onInstall: () => void
}

/** One screen: what you get on the left, where it goes on the right. */
export function Install({ version, installDir, setInstallDir, desktopShortcut, setDesktopShortcut, startMenuShortcut, setStartMenuShortcut, onCancel, onInstall }: Props) {
  const [error, setError] = useState<string | null>(null)

  const pick = async () => {
    try {
      const picked = await open({ directory: true, multiple: false, defaultPath: installDir, title: 'Choose where Hardwave goes' })
      if (typeof picked === 'string') { setInstallDir(picked); setError(null) }
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3 }} className="screen">
      <div className="split">
        <div className="vis">
          <img src={analyser} alt="" />
          <img src={wettboi} alt="" />
          <img src={loudlab} alt="" />
        </div>
        <div className="frm">
          <div className="cap">Install</div>
          <h1 className="t">Your plug-ins, Workspace and the DAW, in one app.</h1>
          <p className="sub">One login. Updates arrive on their own.</p>
          {version && <div className="ver">Hardwave {version.version}</div>}
          <div className="field"><span className="path" title={installDir}>{installDir || '…'}</span><button type="button" onClick={pick}>Change</button></div>
          {error && <div className="err">{error}</div>}
          <button type="button" className="opt" onClick={() => setDesktopShortcut(!desktopShortcut)}><i className={desktopShortcut ? 'on' : ''} />Desktop shortcut</button>
          <button type="button" className="opt" onClick={() => setStartMenuShortcut(!startMenuShortcut)}><i className={startMenuShortcut ? 'on' : ''} />Start menu</button>
          <div className="ft">
            <button type="button" className="ibtn ghost" onClick={onCancel}>Cancel</button>
            <button type="button" className="ibtn" onClick={onInstall} disabled={!installDir}>Install</button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
