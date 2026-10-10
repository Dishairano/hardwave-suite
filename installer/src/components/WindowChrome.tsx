import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, X } from 'lucide-react'

export function WindowChrome() {
  const win = getCurrentWindow()
  return (
    <div className="itb" data-tauri-drag-region>
      <span data-tauri-drag-region>HARDWAVE · SETUP</span>
      <span className="c">
        <button type="button" onClick={() => win.minimize()} title="Minimize"><Minus size={14} /></button>
        <button type="button" className="x" onClick={() => win.close()} title="Close"><X size={14} /></button>
      </span>
    </div>
  )
}
