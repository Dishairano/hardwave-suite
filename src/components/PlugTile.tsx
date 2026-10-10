import type { Product } from '../lib/api'
import type { TileState } from '../lib/library'
import { tileArt, shortName } from '../lib/tiles'

interface Props {
  product: Product
  state: TileState
  /** Whether the account may install Pro plug-ins. */
  pro: boolean
  onInstall: () => void
  /** Opens what Pro gives, for a Pro plug-in the account cannot install yet. */
  onProLink?: () => void
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
      return s.pro ? { text: `Pro beta · ${s.latest}`, dot: 'var(--accent)' } : { text: `Not installed · ${s.latest}`, dot: 'var(--text-dim)' }
  }
}

/**
 * One plug-in as a large tile: the real interface as the picture, the name,
 * the state as a dot and a few words, and the one action that fits.
 */
export function PlugTile({ product, state, pro, onInstall, onProLink }: Props) {
  const art = tileArt(product.slug)
  const d = describe(state)
  const busy = state.kind === 'downloading' || state.kind === 'installing'
  const needsPro = state.pro && !pro
  let action: JSX.Element | null = null
  if (busy) action = null
  else if (state.kind === 'update') action = <button type="button" className="a2-btn red sm" onClick={onInstall}>Update</button>
  else if (state.kind === 'not_installed' || state.kind === 'error') {
    action = needsPro
      ? <button type="button" className="a2-btn ghost sm" onClick={onProLink}>With Pro</button>
      : <button type="button" className="a2-btn ghost sm" onClick={onInstall}>{state.kind === 'error' ? 'Try again' : 'Install'}</button>
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
