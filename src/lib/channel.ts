import type { BetaPlugin, Product } from './api'
import { compareVersions, isNewerVersion } from './version'

/**
 * The beta channel, as the library reads it.
 *
 * With "Beta builds" on, the site's beta manifest lists the release candidates
 * a tester may have. A candidate that is newer than the stable version of a
 * plug-in becomes that plug-in's newest version: the tile offers it, Install
 * and Update put it down, and the update check compares against it. With the
 * switch off the manifest is never read and none of this applies.
 *
 * Everything here is plain data in, plain data out, so it can be tested
 * without a window.
 */

/** Hours until a beta build expires, from its expiry date; the server's count when the date cannot be read. */
export function hoursLeft(beta: Pick<BetaPlugin, 'expiresAt' | 'hoursUntilExpiry'>, now: number): number {
  const ts = Date.parse(beta.expiresAt)
  if (Number.isNaN(ts)) return beta.hoursUntilExpiry
  return (ts - now) / 3_600_000
}

/**
 * The beta build on offer per plug-in: built for this computer, not expired,
 * and the newest one when the manifest lists several.
 */
export function betaOffers(manifest: BetaPlugin[], now: number): Record<string, BetaPlugin> {
  const best: Record<string, BetaPlugin> = {}
  for (const b of manifest) {
    // An older Suite binary sends no availableHere and no per-platform pick; it gets no offers.
    if (!b || !b.pluginSlug || !b.version || b.availableHere !== true) continue
    if (!b.artefactUrl || !b.artefactSha256) continue
    if (hoursLeft(b, now) <= 0) continue
    const have = best[b.pluginSlug]
    if (!have || compareVersions(b.version, have.version) === 1) best[b.pluginSlug] = b
  }
  return best
}

/** The beta build to offer for this plug-in: only one that is newer than its stable version. */
export function offerFor(product: Pick<Product, 'slug' | 'version'>, offers: Record<string, BetaPlugin>): BetaPlugin | null {
  const b = offers[product.slug]
  if (!b) return null
  if (!product.version) return b
  // Once 0.5.0 ships, 0.5.0-rc1 is the older build and the stable one wins.
  return compareVersions(b.version, product.version) === 1 ? b : null
}

/** What Install and Update put down for a plug-in, and the notes that go with it. */
export interface Latest {
  version: string
  changelog: string | null
  /** Set when the newest version is a beta build; it installs through the beta path. */
  beta: BetaPlugin | null
}

export function latestOf(product: Product, offers: Record<string, BetaPlugin>): Latest {
  const beta = offerFor(product, offers)
  return beta
    ? { version: beta.version, changelog: beta.changelog, beta }
    : { version: product.version, changelog: product.changelog, beta: null }
}

function titleFromSlug(slug: string): string {
  return slug.split(/[-_]/).map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s)).join(' ')
}

/**
 * Beta builds of plug-ins that are not in the account's list yet. A plug-in
 * that is still being built has no stable version; its betas reach the people
 * the site sends them to, and they need a tile to install it from.
 */
export function betaOnlyProducts(products: Product[], offers: Record<string, BetaPlugin>): Product[] {
  const known = new Set(products.map((p) => p.slug))
  return Object.values(offers)
    .filter((b) => !known.has(b.pluginSlug))
    .sort((a, b) => a.pluginSlug.localeCompare(b.pluginSlug))
    .map((b) => ({
      // Negative, so it can never collide with a product id from the site.
      id: -Math.abs(b.id) - 1,
      name: titleFromSlug(b.pluginSlug.replace(/^hardwave-/, '')),
      slug: b.pluginSlug,
      description: '',
      version: '',
      downloads: { windows: null, mac: null, linux: null },
      fileSize: b.artefactSize || null,
      changelog: b.changelog,
      category: 'vst',
      formats: [],
    }))
}

/** The download or install in flight for a tile, if any. */
export interface TileDownload {
  status: 'idle' | 'downloading' | 'installing' | 'installed' | 'error'
  percent: number
  error?: string
}

/** What a tile shows for one product. */
export interface TileState {
  kind: 'not_installed' | 'installed' | 'update' | 'never_opened' | 'downloading' | 'installing' | 'error'
  /** The version on this PC, if any. */
  installed: string | null
  /** The newest version the account can install. */
  latest: string
  percent?: number
  error?: string
  /** The plug-in itself is still in beta (a 0.x line). */
  pro: boolean
  /** The newest version is a build from the beta channel. */
  beta: boolean
  /** A beta build is on this PC and the stable version is older; the tile offers the way back. */
  canGoStable: boolean
}

export interface TileInput {
  /** The stable version; empty for a plug-in that only exists as a beta build. */
  stable: string
  hasStableDownload: boolean
  latest: Latest
  installed: string | null
  download?: TileDownload
  pro: boolean
  /** The plug-in is on disk, we can tell whether it was opened, and it never was. */
  neverOpened: boolean
}

export function tileState(i: TileInput): TileState {
  const base = { installed: i.installed, latest: i.latest.version, pro: i.pro, beta: !!i.latest.beta, canGoStable: false }
  const dl = i.download
  if (dl && dl.status === 'downloading') return { ...base, kind: 'downloading', percent: dl.percent }
  if (dl && dl.status === 'installing') return { ...base, kind: 'installing' }
  if (dl && dl.status === 'error') return { ...base, kind: 'error', error: dl.error }
  if (!i.installed) return { ...base, kind: 'not_installed' }
  if (isNewerVersion(i.latest.version, i.installed)) return { ...base, kind: 'update' }
  const canGoStable = !!i.stable && i.hasStableDownload && compareVersions(i.installed, i.stable) === 1
  if (i.neverOpened) return { ...base, canGoStable, kind: 'never_opened' }
  return { ...base, canGoStable, kind: 'installed' }
}

/** The words and the dot colour for a tile's state. */
export function describe(s: TileState): { text: string; dot: string } {
  switch (s.kind) {
    case 'downloading': return { text: `Downloading · ${Math.round(s.percent ?? 0)}%`, dot: 'var(--warning)' }
    case 'installing': return { text: 'Installing…', dot: 'var(--warning)' }
    case 'error': return { text: s.error || 'Something went wrong', dot: 'var(--danger)' }
    case 'update': return s.beta
      ? { text: `Beta ready · ${s.latest}`, dot: 'var(--accent)' }
      : { text: `Update ready · ${s.latest}`, dot: 'var(--brand)' }
    case 'never_opened': return { text: `Not opened yet · ${s.installed}`, dot: 'var(--warning)' }
    case 'installed': return s.canGoStable
      ? { text: `Beta · ${s.installed}`, dot: 'var(--accent)' }
      : { text: `Up to date · ${s.installed}`, dot: 'var(--success)' }
    case 'not_installed':
    default:
      return s.pro || s.beta ? { text: `Beta · ${s.latest}`, dot: 'var(--accent)' } : { text: `Not installed · ${s.latest}`, dot: 'var(--text-dim)' }
  }
}

/** A failed install in words a producer can act on. */
export function installErrorText(err: unknown): string {
  const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : String(err)
  if (msg.includes('os error 32') || msg.includes('being used by another process')) {
    return 'The plug-in is in use. Close your DAW and try again.'
  }
  return msg
}
