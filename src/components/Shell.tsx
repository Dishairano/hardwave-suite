import { useState } from 'react'
import { Sidebar, type SidebarView } from './Sidebar'
import { HomeView } from '../views/HomeView'
import { PluginsView } from '../views/PluginsView'
import { WorkspaceView, DawView, AcademyView } from '../views/LineViews'
import { HelpView } from '../views/HelpView'
import { SettingsView } from '../views/SettingsView'
import { useLibrary } from '../lib/library'
import type { Product, SubscriptionInfo, User } from '../lib/api'

interface Props {
  user: User
  subscription: SubscriptionInfo | null
  appVersion: string
  preloadedProducts: Product[] | null
  preloadedVersions: Record<string, string> | null
  /** Opens the appearance panel, which keeps its own screen. */
  onOpenSettings: () => void
  onSignOut: () => void
  /** A setting changed that the app reads too (channel, crash logs). */
  onSettingsChanged: () => void
}

/**
 * The window after sign-in: the sidebar, the seven screens, the status line.
 * The library (products, what is installed, downloads) lives here once, so
 * Home and Plug-ins never disagree.
 */
export function Shell({ user, subscription, appVersion, preloadedProducts, preloadedVersions, onOpenSettings, onSignOut, onSettingsChanged }: Props) {
  const [view, setView] = useState<SidebarView>('home')
  const lib = useLibrary(preloadedProducts, preloadedVersions)
  const pro = !!subscription?.hasSubscription
  const planLabel = pro ? (subscription?.planName || 'Hardwave Pro').toUpperCase() : 'FREE'

  const select = (next: SidebarView) => setView(next)

  return (
    <div className="shell a2">
      <Sidebar active={view} onSelect={select} updateCount={lib.counts.updates} user={user} planLabel={planLabel} onAccountClick={() => setView('settings')} onSignOut={onSignOut} />
      <main className="a2-content">
        {view === 'home' && <HomeView lib={lib} pro={pro} go={setView} />}
        {view === 'plugins' && <PluginsView lib={lib} pro={pro} />}
        {view === 'workspace' && <WorkspaceView />}
        {view === 'daw' && <DawView />}
        {view === 'academy' && <AcademyView />}
        {view === 'settings' && <SettingsView user={user} subscription={subscription} appVersion={appVersion} onSignOut={onSignOut} onAppearance={onOpenSettings} onChanged={onSettingsChanged} />}
        {view === 'help' && <HelpView lib={lib} appVersion={appVersion} />}
        <div className="statusbar">
          <span className="pip" />
          <span>CONNECTED</span>
          <span className="sb-sep">·</span>
          <span>{lib.counts.installed} installed · {lib.counts.updates} update{lib.counts.updates === 1 ? '' : 's'} · {lib.counts.beta} in beta</span>
          <span className="sb-tail">{appVersion ? `v${appVersion}` : ''}</span>
        </div>
      </main>
    </div>
  )
}
