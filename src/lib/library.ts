import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as api from './api'
import type { BetaPlugin, Product } from './api'
import { isBetaProduct } from './beta'
import { betaOffers, betaOnlyProducts, inBeta, installErrorText, latestOf as latestFor, tileState } from './channel'
import type { Latest, TileState } from './channel'
import { isNewerVersion } from './version'

export type { Latest, TileState } from './channel'

/**
 * The plug-in library: what the account owns, what is on this PC, what is
 * downloading, and whether an installed plug-in has ever been opened. One
 * hook, shared by Home and Plug-ins, so both show the same truth.
 *
 * With "Beta builds" on it also reads the beta manifest. A release candidate
 * that is newer than a plug-in's stable version is then that plug-in's newest
 * version everywhere: on the tile, in the update count, in Update all.
 */

export type Platform = 'windows' | 'mac' | 'linux'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'mac'
  return 'linux'
}

export interface DlState {
  percent: number
  status: 'idle' | 'downloading' | 'installing' | 'installed' | 'error'
  installPath?: string
  error?: string
}

type DlMap = Record<string, DlState>

type DlAction =
  | { type: 'start'; fileId: string }
  | { type: 'progress'; fileId: string; percent: number; status: DlState['status']; installPath?: string }
  | { type: 'error'; fileId: string; error: string }
  | { type: 'reset'; fileId: string }

function dlReducer(state: DlMap, action: DlAction): DlMap {
  switch (action.type) {
    case 'start':
      return { ...state, [action.fileId]: { percent: 0, status: 'downloading' } }
    case 'progress':
      return { ...state, [action.fileId]: { percent: action.percent, status: action.status, installPath: action.installPath } }
    case 'error':
      return { ...state, [action.fileId]: { percent: 0, status: 'error', error: action.error } }
    case 'reset': {
      const next = { ...state }
      delete next[action.fileId]
      return next
    }
    default:
      return state
  }
}

export interface Counts {
  total: number
  installed: number
  updates: number
  beta: number
}

export interface Library {
  products: Product[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  installedVersions: Record<string, string>
  platform: Platform
  firstRun: api.FirstRunItem[]
  /** Installed plug-ins that have something to say: never opened, or in the wrong place. */
  needsAttention: api.FirstRunItem[]
  counts: Counts
  updatable: Product[]
  stateOf: (p: Product) => TileState
  /** The newest version this account can install: the stable one, or a newer beta build when Beta builds is on. */
  latestOf: (p: Product) => Latest
  /** Installs the newest version: the beta build when one is on offer, the stable build otherwise. */
  install: (p: Product) => Promise<void>
  /** Replaces a beta build with the stable version. */
  installStable: (p: Product) => Promise<void>
  /** Runs the install that failed again: the stable build after a failed Back to stable, the newest version otherwise. */
  retry: (p: Product) => Promise<void>
  /** Beta builds is on and the manifest could not be read; builds read earlier stay listed, otherwise stable versions show. */
  betaError: string | null
  updateAll: () => Promise<void>
  uninstall: (p: Product) => Promise<void>
  cleanupBlocked: { slug: string; blocked: api.BlockedCopy[] } | null
  retryingCleanup: boolean
  retryCleanup: () => Promise<void>
  dismissCleanup: () => void
}

/**
 * `beta` is true when the Beta builds switch is on and the account may have
 * beta builds. When it is false the beta manifest is never asked for.
 */
export function useLibrary(preloadedProducts?: Product[] | null, preloadedVersions?: Record<string, string> | null, beta = false): Library {
  const hasPreloaded = !!(preloadedProducts && preloadedProducts.length >= 0)
  const [owned, setProducts] = useState<Product[]>(preloadedProducts ?? [])
  const [manifest, setManifest] = useState<BetaPlugin[]>([])
  const [betaError, setBetaError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!hasPreloaded)
  const [error, setError] = useState<string | null>(null)
  const [downloads, dispatch] = useReducer(dlReducer, {})
  const [installedVersions, setInstalledVersions] = useState<Record<string, string>>(preloadedVersions ?? {})
  const [cleanupBlocked, setCleanupBlocked] = useState<{ slug: string; blocked: api.BlockedCopy[] } | null>(null)
  const [retryingCleanup, setRetryingCleanup] = useState(false)
  const [firstRun, setFirstRun] = useState<api.FirstRunItem[]>([])
  const platform = useMemo(detectPlatform, [])

  // Only the newest request may answer: a manifest that arrives after the
  // switch went off must not bring the beta builds back.
  const manifestRequest = useRef(0)
  const loadManifest = useCallback(async () => {
    const request = ++manifestRequest.current
    if (!beta) {
      setManifest([])
      setBetaError(null)
      return
    }
    try {
      const list = await api.getBetaManifest()
      if (request !== manifestRequest.current) return
      setManifest(list)
      setBetaError(null)
    } catch (err) {
      if (request !== manifestRequest.current) return
      // Keep the builds already listed; the stable versions stay installable either way.
      setBetaError(installErrorText(err))
    }
  }, [beta])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, installed] = await Promise.all([
        api.getProducts(),
        api.getInstalledVersions().catch(() => ({} as Record<string, string>)),
        loadManifest(),
      ])
      setProducts(prods)
      setInstalledVersions(installed)
    } catch (err) {
      setError(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }, [loadManifest])

  useEffect(() => {
    if (!hasPreloaded) void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Read the manifest when Beta builds is switched on, drop it when it is switched off.
  useEffect(() => { void loadManifest() }, [loadManifest])

  // A build that expired is no longer on offer.
  useEffect(() => {
    let un: (() => void) | undefined
    let gone = false
    api.onBetaExpired(() => { void loadManifest() }).then((u) => { if (gone) u(); else un = u }).catch(() => {})
    return () => { gone = true; un?.() }
  }, [loadManifest])

  const offers = useMemo(() => betaOffers(manifest, Date.now()), [manifest])
  const products = useMemo(() => [...owned, ...betaOnlyProducts(owned, offers)], [owned, offers])
  const latestOf = useCallback((p: Product) => latestFor(p, offers), [offers])

  // After an install the backend sweeps stale copies from the other plug-in
  // folders. A copy it could not remove (the DAW has it open, or it sits in
  // a system folder) is shown so the user can close the DAW and retry.
  useEffect(() => {
    let un: (() => void) | undefined
    api.onPluginsCleaned((e) => {
      if (e.blocked && e.blocked.length > 0) setCleanupBlocked({ slug: e.slug, blocked: e.blocked })
    }).then((u) => { un = u })
    return () => { un?.() }
  }, [])

  // A beta install changes the registry without going through here.
  useEffect(() => {
    const reload = () => { api.getInstalledVersions().then(setInstalledVersions).catch(() => {}) }
    window.addEventListener(api.INSTALLED_CHANGED_EVENT, reload)
    return () => window.removeEventListener(api.INSTALLED_CHANGED_EVENT, reload)
  }, [])

  // What is on disk and whether it was ever opened; re-read after any install.
  useEffect(() => {
    const check = () => { api.firstRunCheck().then(setFirstRun).catch(() => {}) }
    check()
    window.addEventListener(api.INSTALLED_CHANGED_EVENT, check)
    return () => window.removeEventListener(api.INSTALLED_CHANGED_EVENT, check)
  }, [])

  const needsAttention = useMemo(() => firstRun.filter((f) => f.notes.length > 0), [firstRun])

  const updatable = useMemo(
    () => products.filter((p) => {
      const v = installedVersions[p.slug]
      return !!v && isNewerVersion(latestOf(p).version, v)
    }),
    [products, installedVersions, latestOf],
  )

  const installStableBuild = useCallback(async (product: Product) => {
    const url = product.downloads[platform]
    if (!url) return
    const fileId = `${product.id}-${platform}`
    const filename = url.split('/').pop() || `${product.slug}-${platform}`
    dispatch({ type: 'start', fileId })
    const unlisten = await api.onDownloadProgress((p) => {
      if (p.file_id === fileId) {
        dispatch({ type: 'progress', fileId, percent: p.percent, status: p.status as DlState['status'], installPath: p.install_path })
      }
    })
    try {
      await api.downloadAndInstall(fileId, url, filename, product.category || 'vst', product.name, product.slug, product.version)
      setInstalledVersions((prev) => ({ ...prev, [product.slug]: product.version }))
    } catch (err) {
      dispatch({ type: 'error', fileId, error: installErrorText(err) })
    } finally {
      unlisten()
    }
  }, [platform])

  // A beta build is checked against its sha256 and then goes through the same
  // installer as a stable build, into the same folders. The backend sends no
  // progress for it, so the tile says Installing until it is done.
  const installBeta = useCallback(async (product: Product, build: BetaPlugin) => {
    const fileId = `${product.id}-${platform}`
    dispatch({ type: 'progress', fileId, percent: 0, status: 'installing' })
    try {
      const installPath = await api.installBetaBuild(build.pluginSlug, build.version, build.artefactUrl, build.artefactSha256, build.expiresAt)
      setInstalledVersions((prev) => ({ ...prev, [product.slug]: build.version }))
      dispatch({ type: 'progress', fileId, percent: 100, status: 'installed', installPath })
      // The first-run check reads the disk again.
      window.dispatchEvent(new Event(api.INSTALLED_CHANGED_EVENT))
    } catch (err) {
      dispatch({ type: 'error', fileId, error: installErrorText(err) })
    }
  }, [platform])

  // Plug-ins whose last install was a Back to stable, so Try again repeats that and not the beta install.
  const wantsStable = useRef(new Set<string>())

  const install = useCallback(async (product: Product) => {
    wantsStable.current.delete(product.slug)
    const build = latestOf(product).beta
    if (build) await installBeta(product, build)
    else await installStableBuild(product)
  }, [latestOf, installBeta, installStableBuild])

  const installStable = useCallback(async (product: Product) => {
    wantsStable.current.add(product.slug)
    await installStableBuild(product)
  }, [installStableBuild])

  const retry = useCallback(async (product: Product) => {
    if (wantsStable.current.has(product.slug)) await installStable(product)
    else await install(product)
  }, [install, installStable])

  const updateAll = useCallback(async () => {
    for (const p of updatable) {
      // One at a time: each download is tracked on its own, and the disk is not hammered.
      // eslint-disable-next-line no-await-in-loop
      await install(p)
    }
  }, [updatable, install])

  const retryCleanup = useCallback(async () => {
    if (!cleanupBlocked) return
    setRetryingCleanup(true)
    try {
      await api.removeStalePlugins(cleanupBlocked.blocked.map((b) => b.path))
      setCleanupBlocked(null)
    } catch (err) {
      window.alert(`Some old copies still could not be removed:\n${String(err)}\n\nClose your DAW fully, then try again.`)
    } finally {
      setRetryingCleanup(false)
    }
  }, [cleanupBlocked])

  const uninstall = useCallback(async (product: Product) => {
    const ok = window.confirm(`Uninstall ${product.name}?\n\nThis removes the plug-in files. Close your DAW first.`)
    if (!ok) return
    try {
      await api.uninstallPlugin(product.slug, product.category || 'vst')
      setInstalledVersions((prev) => {
        const next = { ...prev }
        delete next[product.slug]
        return next
      })
      dispatch({ type: 'reset', fileId: `${product.id}-${platform}` })
    } catch (err) {
      window.alert(`Uninstall failed: ${String(err)}`)
    }
  }, [platform])

  const stateOf = useCallback((p: Product): TileState => {
    const fr = firstRun.find((f) => f.slug === p.slug)
    return tileState({
      stable: p.version,
      hasStableDownload: !!p.downloads[platform],
      latest: latestOf(p),
      installed: installedVersions[p.slug] ?? null,
      download: downloads[`${p.id}-${platform}`],
      pro: isBetaProduct(p),
      neverOpened: !!fr && fr.can_tell && !fr.last_opened,
    })
  }, [installedVersions, downloads, platform, firstRun, latestOf])

  const counts = useMemo<Counts>(() => {
    const installed = products.filter((p) => !!installedVersions[p.slug]).length
    const beta = products.filter((p) => inBeta(stateOf(p))).length
    return { total: products.length, installed, updates: updatable.length, beta }
  }, [products, installedVersions, updatable, stateOf])

  return {
    products, loading, error, reload, installedVersions, platform, firstRun, needsAttention, counts, updatable,
    stateOf, latestOf, install, installStable, retry, betaError, updateAll, uninstall,
    cleanupBlocked, retryingCleanup, retryCleanup, dismissCleanup: () => setCleanupBlocked(null),
  }
}
