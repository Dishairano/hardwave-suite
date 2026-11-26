import type { Product } from '../lib/api'
import type { TileState } from '../lib/library'
import { describe } from '../lib/channel'
import { tileArt, shortName } from '../lib/tiles'

interface Props {
  product: Product
  state: TileState
  /** Installs the newest version: a beta build when one is on offer. */
  onInstall: () => void
  /** Puts the stable version back over a beta build. */
  onStable: () => void
  /** Runs the install that failed again. */
  onRetry: () => void
}

/**
 * One plug-in as a large tile: the real interface as the picture, the name,
 * the state as a dot and a few words, and the one action that fits.
 *
 * Every tile can be installed: the list comes from /api/downloads, which only
 * returns the plug-ins this account may have (Pro, or bought on its own). A
 * "With Pro" lock here turned away people who had bought a beta plug-in
 * without Pro (2026-10-19).
 *
 * With Beta builds on, the newest version can be a release candidate: the
 * tile then says Beta and the same button installs it. A beta build on this
 * PC keeps a Back to stable button, also after the switch is turned off.
 */
export function PlugTile({ product, state, onInstall, onStable, onRetry }: Props) {
  const art = tileArt(product.slug)
  const d = describe(state)
  const busy = state.kind === 'downloading' || state.kind === 'installing'
  let action: JSX.Element | null = null
  if (busy) action = null
  else if (state.kind === 'update') action = <button type="button" className="a2-btn red sm" onClick={onInstall}>Update</button>
  else if (state.kind === 'error') action = <button type="button" className="a2-btn ghost sm" onClick={onRetry}>Try again</button>
  else if (state.kind === 'not_installed') action = <button type="button" className="a2-btn ghost sm" onClick={onInstall}>Install</button>
  else if (state.canGoStable) {
    action = <button type="button" className="a2-btn ghost sm" onClick={onStable}>Back to stable</button>
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
