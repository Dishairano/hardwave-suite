import { Home, LayoutGrid, Cloud, AudioWaveform, GraduationCap, Settings as SettingsIcon, HelpCircle, LogOut } from 'lucide-react'
import { HwWaveMark } from './HwWaveMark'
import type { User } from '../lib/api'

export type SidebarView = 'home' | 'plugins' | 'workspace' | 'daw' | 'academy' | 'settings' | 'help'

interface SidebarProps {
  active: SidebarView
  onSelect: (view: SidebarView) => void
  /** An update waits for an installed plug-in: a dot on Plug-ins. */
  updateCount: number
  user: User
  planLabel: string
  onAccountClick: () => void
  onSignOut: () => void
}

const TOP: Array<[SidebarView, string, JSX.Element]> = [
  ['home', 'Home', <Home size={16} />],
  ['plugins', 'Plug-ins', <LayoutGrid size={16} />],
  ['workspace', 'Workspace', <Cloud size={16} />],
  ['daw', 'DAW', <AudioWaveform size={16} />],
  ['academy', 'Academy', <GraduationCap size={16} />],
]

const BOTTOM: Array<[SidebarView, string, JSX.Element]> = [
  ['settings', 'Settings', <SettingsIcon size={16} />],
  ['help', 'Help', <HelpCircle size={16} />],
]

export function Sidebar({ active, onSelect, updateCount, user, planLabel, onAccountClick, onSignOut }: SidebarProps) {
  const displayName = user.displayName || user.email.split('@')[0]
  const initial = (displayName[0] || 'H').toUpperCase()
  const item = ([key, label, icon]: [SidebarView, string, JSX.Element]) => (
    <button
      key={key}
      type="button"
      className={`a2-nav-link${active === key ? ' on' : ''}`}
      onClick={() => onSelect(key)}
    >
      {icon}
      {label}
      {key === 'plugins' && updateCount > 0 && <span className="dotb" title={`${updateCount} update${updateCount === 1 ? '' : 's'} ready`} />}
    </button>
  )
  return (
    <aside className="a2-side">
      <div className="a2-brand"><HwWaveMark size={26} />HARDWAVE</div>
      <nav className="a2-nav">
        {TOP.map(item)}
        <div className="gap" />
        {BOTTOM.map(item)}
      </nav>
      <div className="a2-me-row">
        <button className="a2-me" onClick={onAccountClick} type="button" title={`${user.email} · account and settings`}>
          <span className="av">{initial}</span>
          <span><b>{displayName}</b><span>{planLabel}</span></span>
        </button>
        <button className="a2-out" onClick={onSignOut} type="button" title="Sign out"><LogOut size={14} /></button>
      </div>
    </aside>
  )
}
