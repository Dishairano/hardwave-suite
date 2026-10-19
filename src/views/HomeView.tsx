import { useMemo, useState } from 'react'
import * as api from '../lib/api'
import type { Library } from '../lib/library'
import type { SidebarView } from '../components/Sidebar'
import { PlugTile } from '../components/PlugTile'
import { tileArt, shortName } from '../lib/tiles'
import logoWorkspace from '../assets/lines/logo-workspace.png'
import logoDaw from '../assets/lines/logo-daw.png'
import logoAcademy from '../assets/lines/logo-academy.png'

const SITE = 'https://hardwavestudios.com'

type Daw = 'FL Studio' | 'Ableton' | 'Bitwig' | 'Reaper'

/** Where a DAW lists its plug-ins, so a freshly installed one can be found once. */
const HOW: Record<Daw, Array<{ kbd: string; rest?: string }>> = {
  'FL Studio': [{ kbd: 'Options' }, { kbd: 'Manage plugins' }, { kbd: 'Find installed plugins', rest: ', then look under Effects' }],
  'Ableton': [{ kbd: 'Preferences' }, { kbd: 'Plug-Ins', rest: ': turn on VST3' }, { kbd: 'Rescan', rest: ', then look in the browser under Plug-Ins' }],
  'Bitwig': [{ kbd: 'Settings' }, { kbd: 'Locations', rest: ': the VST3 folder is on by default' }, { kbd: 'Browser', rest: ': search the name' }],
  'Reaper': [{ kbd: 'Options' }, { kbd: 'Preferences, Plug-ins, VST' }, { kbd: 'Re-scan', rest: ', then FX, Add' }],
}

const DAWS: Daw[] = ['FL Studio', 'Ableton', 'Bitwig', 'Reaper']

function open(url: string) {
  api.openExternalUrl(url).catch(() => { if (api.isWebUrl(url)) window.open(url, '_blank') })
}

interface Props {
  lib: Library
  pro: boolean
  go: (view: SidebarView) => void
}

export function HomeView({ lib, pro, go }: Props) {
  const [daw, setDaw] = useState<Daw>(() => (localStorage.getItem('hw_daw') as Daw) || 'FL Studio')
  const [found, setFound] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hw_found') || '[]') } catch { return [] }
  })

  const installed = useMemo(() => lib.products.filter((p) => !!lib.installedVersions[p.slug]), [lib.products, lib.installedVersions])
  const proNotInstalled = useMemo(
    () => lib.products.filter((p) => !lib.installedVersions[p.slug] && lib.stateOf(p).pro),
    [lib.products, lib.installedVersions, lib.stateOf],
  )
  const task = lib.needsAttention.find((f) => !found.includes(f.slug)) ?? null
  const updates = lib.updatable

  const markFound = (slug: string) => {
    const next = [...found, slug]
    setFound(next)
    localStorage.setItem('hw_found', JSON.stringify(next))
  }
  const pickDaw = (d: Daw) => { setDaw(d); localStorage.setItem('hw_daw', d) }

  const statusText = (() => {
    if (lib.loading) return 'Reading what is on this PC…'
    const n = installed.length
    const head = n === 0 ? 'No plug-ins on this PC yet.' : `${n} plug-in${n === 1 ? '' : 's'} on this PC.`
    if (updates.length === 0) return n === 0 ? head : `${head} All up to date.`
    if (updates.length === 1) return `${head} All up to date except ${shortName(updates[0].name)}.`
    return `${head} ${updates.length} updates ready.`
  })()

  return (
    <div className="a2-main">
      <div className="stat">
        <span className={`ok${updates.length ? ' warn' : ''}`}>{updates.length ? '↑' : '✓'}</span>
        <span><b>{statusText.split('. ')[0]}.</b> {statusText.split('. ').slice(1).join('. ')}</span>
        <span className="sp" />
        {updates.length === 1 && (
          <button type="button" className="lnk" onClick={() => lib.install(updates[0])}>Update {shortName(updates[0].name)} to {updates[0].version}</button>
        )}
        {updates.length > 1 && (
          <button type="button" className="lnk" onClick={lib.updateAll}>Update all</button>
        )}
      </div>

      {task && (
        <section className="nx">
          <div className="l">
            <div className="k">One thing left</div>
            <h3>Open {shortName(task.name)} in {daw}</h3>
            <p>{task.notes.join(' ')}</p>
            <div className="acts">
              <button type="button" className="a2-btn red" onClick={() => markFound(task.slug)}>I found it</button>
              <button type="button" className="a2-btn ghost" onClick={() => open(`${SITE}/learn/plug-ins/${task.slug.replace(/^hardwave-/, '')}`)}>Show me how</button>
            </div>
          </div>
          <div className="r">
            <div className="seg2">{DAWS.map((d) => <span key={d} className={d === daw ? 'on' : ''} onClick={() => pickDaw(d)}>{d}</span>)}</div>
            <div className="how">
              {HOW[daw].map((step, i) => (
                <div key={i}><i>{i + 1}</i><span><span className="kbd">{step.kbd}</span>{step.rest}</span></div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="shelfh"><h2>Your plug-ins</h2><button type="button" className="shelf-link" onClick={() => go('plugins')}>All plug-ins →</button></div>
        {installed.length === 0 ? (
          <div className="a2-card"><div className="k">Nothing on this PC yet</div><p>Install Analyser from the Plug-ins page; it is free with your account.</p>
            <div className="row"><button type="button" className="a2-btn red sm" onClick={() => go('plugins')}>Go to Plug-ins</button></div></div>
        ) : (
          <div className="shelf">
            {installed.slice(0, 3).map((p) => (
              <PlugTile key={p.id} product={p} state={lib.stateOf(p)} onInstall={() => lib.install(p)} />
            ))}
          </div>
        )}
      </section>

      {proNotInstalled.length > 0 && (
        <section>
          <div className="shelfh"><h2>{pro ? 'Ready with your Pro' : 'Yours to install'}</h2>{!pro && <button type="button" className="shelf-link" onClick={() => open(`${SITE}/pricing`)}>What Pro gives →</button>}</div>
          <div className="pro3">
            {proNotInstalled.slice(0, 3).map((p) => {
              const art = tileArt(p.slug)
              const st = lib.stateOf(p)
              const busy = st.kind === 'downloading' || st.kind === 'installing'
              return (
                <div key={p.id}>
                  {art ? <img src={art.poster} alt="" /> : <span className="ph" />}
                  <div><b>{shortName(p.name)}</b><small>{busy ? (st.kind === 'downloading' ? `Downloading · ${Math.round(st.percent ?? 0)}%` : 'Installing…') : art?.kind ?? ''}</small></div>
                  {!busy && <button type="button" className="a2-btn ghost sm" onClick={() => lib.install(p)}>Install</button>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <div className="shelfh"><h2>More from Hardwave</h2></div>
        <div className="lines3">
          <button type="button" style={{ ['--c' as string]: 'var(--accent)' }} onClick={() => go('workspace')}><div><img src={logoWorkspace} alt="Workspace" /><span>Your projects, backed up on every PC</span></div><em>→</em></button>
          <button type="button" style={{ ['--c' as string]: 'var(--brand)' }} onClick={() => go('daw')}><div><img src={logoDaw} alt="DAW" /><span>Free, with every Hardwave plug-in inside</span></div><em>→</em></button>
          <button type="button" style={{ ['--c' as string]: 'var(--warning)' }} onClick={() => go('academy')}><div><img src={logoAcademy} alt="Academy" /><span>Waitlist open · 36 guides free</span></div><em>→</em></button>
        </div>
      </section>
    </div>
  )
}
