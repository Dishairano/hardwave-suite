import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, X } from 'lucide-react'

interface Props {
  title?: string
  /** False while something must not be interrupted: the close button is hidden. */
  closable?: boolean
}

export function WindowChrome({ title = 'HARDWAVE · SETUP', closable = true }: Props) {
  const win = getCurrentWindow()
  return (
    <div className="itb" data-tauri-drag-region>
      <span data-tauri-drag-region>{title}</span>
      <span className="c">
        <button type="button" onClick={() => win.minimize()} title="Minimize"><Minus size={14} /></button>
        {closable && <button type="button" className="x" onClick={() => win.close()} title="Close"><X size={14} /></button>}
      </span>
    </div>
  )
}
