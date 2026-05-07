import { LayoutGrid, Settings as SettingsIcon, Download, Layers, HelpCircle, Sliders } from 'lucide-react'
import { HwWaveMark } from './HwWaveMark'
import type { User } from '../lib/api'

export type SidebarView = 'plugins' | 'installed' | 'updates' | 'beta' | 'settings' | 'help'

interface SidebarProps {
  active: SidebarView
  onSelect: (view: SidebarView) => void
  updateCount: number
  betaCount: number
  user: User
  onAccountClick: () => void
}

export function Sidebar({ active, onSelect, updateCount, betaCount, user, onAccountClick }: SidebarProps) {
  const displayName = user.displayName || user.email.split('@')[0]
  const initial = (displayName[0] || 'H').toUpperCase()
  const tier = user.isAdmin ? 'FOUNDER' : 'MEMBER'

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <HwWaveMark size={16} />
        Hardwave Suite
      </div>

      <div className="side-section-h">Library</div>
      <nav className="side-nav">
        <button
          className={`side-link ${active === 'plugins' ? 'active' : ''}`}
          onClick={() => onSelect('plugins')}
          type="button"
        >
          <LayoutGrid size={14} />
          Plug-ins
        </button>
        <button
          className={`side-link ${active === 'installed' ? 'active' : ''}`}
          onClick={() => onSelect('installed')}
          type="button"
        >
          <Sliders size={14} />
          Installed
        </button>
        <button
          className={`side-link ${active === 'updates' ? 'active' : ''}`}
          onClick={() => onSelect('updates')}
          type="button"
        >
          <Download size={14} />
          Updates
          {updateCount > 0 && <span className="badge update">{updateCount}</span>}
        </button>
        <button
          className={`side-link ${active === 'beta' ? 'active' : ''}`}
          onClick={() => onSelect('beta')}
          type="button"
        >
          <Layers size={14} />
          Beta builds
          {betaCount > 0 && <span className="badge beta">{betaCount}</span>}
        </button>
      </nav>

      <div className="side-section-h">System</div>
      <nav className="side-nav">
        <button
          className={`side-link ${active === 'settings' ? 'active' : ''}`}
          onClick={() => onSelect('settings')}
          type="button"
        >
          <SettingsIcon size={14} />
          Settings
        </button>
        <button
          className={`side-link ${active === 'help' ? 'active' : ''}`}
          onClick={() => onSelect('help')}
          type="button"
        >
          <HelpCircle size={14} />
          Help &amp; bugs
        </button>
      </nav>

      <div className="side-spacer" />

      <button className="side-account" onClick={onAccountClick} type="button" title="Account">
        <span className="avatar">{initial}</span>
        <span className="acc-text">
          <span className="acc-name">{displayName}</span>
          <span className="acc-tier">{tier}</span>
        </span>
      </button>
    </aside>
  )
}
