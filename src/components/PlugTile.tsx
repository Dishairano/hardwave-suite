import type { Product } from '../lib/api'
import type { TileState } from '../lib/library'
import { tileArt, shortName } from '../lib/tiles'

interface Props {
  product: Product
  state: TileState
  onInstall: () => void
}

/** The words and the dot colour for a tile's state. */
export function describe(s: TileState): { text: string; dot: string } {
  switch (s.kind) {
    case 'downloading': return { text: `Downloading · ${Math.round(s.percent ?? 0)}%`, dot: 'var(--warning)' }
    case 'installing': return { text: 'Installing…', dot: 'var(--warning)' }
    case 'error': return { text: s.error || 'Something went wrong', dot: 'var(--danger)' }
    case 'update': return { text: `Update ready · ${s.latest}`, dot: 'var(--brand)' }
    case 'never_opened': return { text: `Not opened yet · ${s.installed}`, dot: 'var(--warning)' }
    case 'installed': return { text: `Up to date · ${s.installed}`, dot: 'var(--success)' }
    case 'not_installed':
    default:
      return s.pro ? { text: `Beta · ${s.latest}`, dot: 'var(--accent)' } : { text: `Not installed · ${s.latest}`, dot: 'var(--text-dim)' }
  }
}

/**
 * One plug-in as a large tile: the real interface as the picture, the name,
 * the state as a dot and a few words, and the one action that fits.
 *
 * Every tile can be installed: the list comes from /api/downloads, which only
 * returns the plug-ins this account may have (Pro, or bought on its own). A
 * "With Pro" lock here turned away people who had bought a beta plug-in
 * without Pro (2026-10-19).
 */
export function PlugTile({ product, state, onInstall }: Props) {
  const art = tileArt(product.slug)
  const d = describe(state)
  const busy = state.kind === 'downloading' || state.kind === 'installing'
  let action: JSX.Element | null = null
  if (busy) action = null
  else if (state.kind === 'update') action = <button type="button" className="a2-btn red sm" onClick={onInstall}>Update</button>
  else if (state.kind === 'not_installed' || state.kind === 'error') {
    action = <button type="button" className="a2-btn ghost sm" onClick={onInstall}>{state.kind === 'error' ? 'Try again' : 'Install'}</button>
  }
  return (
    <div className="pc" data-slug={product.slug}>
      {art?.live
        ? <video src={art.live} poster={art.poster} autoPlay muted loop playsInline />
        : art
          ? <img src={art.poster} alt="" />
          : <div className="ph" />}
      {art?.live && product.slug.includes('analyser') && <span className="live">● LIVE PREVIEW</span>}
      <div className="in">
        <div>
          <h4>{shortName(product.name)}</h4>
          <div className="s"><i style={{ background: d.dot }} />{d.text}</div>
        </div>
        {action}
      </div>
    </div>
  )
}
