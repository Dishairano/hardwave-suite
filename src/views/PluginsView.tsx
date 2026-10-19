import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import * as api from '../lib/api'
import type { Library } from '../lib/library'
import { PlugTile } from '../components/PlugTile'
import { shortName } from '../lib/tiles'

type Filter = 'all' | 'installed' | 'updates' | 'beta'

const SITE = 'https://hardwavestudios.com'

function open(url: string) {
  api.openExternalUrl(url).catch(() => { if (api.isWebUrl(url)) window.open(url, '_blank') })
}

/** The first lines of a changelog as bullet points; the markdown stays simple. */
function bullets(changelog: string | null): string[] {
  if (!changelog) return []
  return changelog.split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter((l) => l && !l.startsWith('#')).slice(0, 4)
}

interface Props {
  lib: Library
}

export function PluginsView({ lib }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [paths, setPaths] = useState<Record<string, string>>({})

  useEffect(() => {
    api.getInstallPaths().then(setPaths).catch(() => {})
  }, [])

  const list = useMemo(() => {
    switch (filter) {
      case 'installed': return lib.products.filter((p) => !!lib.installedVersions[p.slug])
      case 'updates': return lib.updatable
      case 'beta': return lib.products.filter((p) => lib.stateOf(p).pro)
      default: return lib.products
    }
  }, [filter, lib])

  const firstUpdate = lib.updatable[0] ?? null
  const changed = bullets(firstUpdate?.changelog ?? null)

  if (lib.loading) {
    return <div className="a2-main"><div className="loading-state"><p>Loading your library…</p></div></div>
  }
  if (lib.error) {
    return (
      <div className="a2-main">
        <div className="error-state">
          <AlertCircle size={28} color="var(--brand-hover)" />
          <h3>Could not load your library</h3>
          <p>{lib.error}</p>
          <button className="a2-btn ghost" onClick={lib.reload} type="button"><RefreshCw size={13} /> Retry</button>
        </div>
      </div>
    )
  }

  const filters: Array<[Filter, string, number]> = [
    ['all', 'All', lib.counts.total],
    ['installed', 'On this PC', lib.counts.installed],
    ['updates', 'Updates', lib.counts.updates],
    ['beta', 'Pro beta', lib.counts.beta],
  ]

  return (
    <div className="a2-main">
      <div className="phd">
        <div><h2 className="ph1">Plug-ins</h2><p>Every Hardwave plug-in. Installed where your DAW looks, VST3 and CLAP.</p></div>
        <button type="button" className="a2-btn red" disabled={lib.updatable.length === 0} onClick={lib.updateAll}>
          {lib.updatable.length > 1 ? `Update all · ${lib.updatable.length}` : 'Update all'}
        </button>
      </div>

      <div className="fil">
        {filters.map(([key, label, n]) => (
          <span key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label} · {n}</span>
        ))}
      </div>

      {lib.cleanupBlocked && (() => {
        const inUse = lib.cleanupBlocked.blocked.some((b) => b.reason === 'in_use')
        const name = lib.cleanupBlocked.slug || 'this plug-in'
        return (
          <div className="a2-card warn">
            <div className="k">An old copy could not be removed</div>
            <p>{inUse
              ? `Close your DAW to finish removing an old copy of ${name}, then retry. Otherwise your DAW may keep loading the old version.`
              : `An old copy of ${name} is in a system folder and needs administrator rights to remove.`}</p>
            <div className="row">
              <button type="button" className="a2-btn red sm" onClick={lib.retryCleanup} disabled={lib.retryingCleanup}>{lib.retryingCleanup ? 'Removing…' : inUse ? 'Retry' : 'Remove (admin)'}</button>
              <button type="button" className="a2-btn ghost sm" onClick={lib.dismissCleanup}>Dismiss</button>
            </div>
          </div>
        )
      })()}

      {list.length === 0 ? (
        <div className="a2-card"><div className="k">Nothing here</div><p>{filter === 'updates' ? 'Everything on this PC is up to date.' : filter === 'installed' ? 'No plug-in is installed on this PC yet.' : 'Your plug-ins appear here once your account has them.'}</p></div>
      ) : (
        <div className="shelf six">
          {list.map((p) => (
            <PlugTile key={p.id} product={p} state={lib.stateOf(p)} onInstall={() => lib.install(p)} />
          ))}
        </div>
      )}

      <div className="det">
        <div className="a2-card">
          <div className="k">{firstUpdate ? `${shortName(firstUpdate.name)} ${firstUpdate.version} · what changed` : 'What changed'}</div>
          {firstUpdate && changed.length > 0
            ? <ul>{changed.map((c, i) => <li key={i}>{c}</li>)}</ul>
            : <p>{firstUpdate ? 'The notes for this version are on the site.' : 'When an update is ready, its notes appear here.'}</p>}
          {firstUpdate && <div className="row"><button type="button" className="a2-btn ghost sm" onClick={() => open(`${SITE}/changelog`)}>Full changelog</button></div>}
        </div>
        <div className="a2-card">
          <div className="k">Where they go</div>
          {Object.keys(paths).length === 0 ? <p>Reading the install folders…</p> : (
            <>
              {Object.entries(paths).map(([k, v]) => (
                <div className="kv" key={k}><span>{k.toUpperCase()}</span><b>{v}</b></div>
              ))}
            </>
          )}
          <div className="row">
            <button type="button" className="a2-btn ghost sm" onClick={() => api.openInstallFolder('vst')}>Open folder</button>
            <button type="button" className="a2-btn ghost sm" onClick={lib.reload}>Refresh</button>
          </div>
        </div>
      </div>
    </div>
  )
}
