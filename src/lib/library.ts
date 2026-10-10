import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import * as api from './api'
import type { Product } from './api'
import { isBetaProduct } from './beta'
import { isNewerVersion } from './version'

/**
 * The plug-in library: what the account owns, what is on this PC, what is
 * downloading, and whether an installed plug-in has ever been opened. One
 * hook, shared by Home and Plug-ins, so both show the same truth.
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

/** What a tile shows for one product. */
export interface TileState {
  kind: 'not_installed' | 'installed' | 'update' | 'never_opened' | 'downloading' | 'installing' | 'error'
  /** The version on this PC, if any. */
  installed: string | null
  /** The newest version the account can install. */
  latest: string
  percent?: number
  error?: string
  pro: boolean
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
  install: (p: Product) => Promise<void>
  updateAll: () => Promise<void>
  uninstall: (p: Product) => Promise<void>
  cleanupBlocked: { slug: string; blocked: api.BlockedCopy[] } | null
  retryingCleanup: boolean
  retryCleanup: () => Promise<void>
  dismissCleanup: () => void
}

export function useLibrary(preloadedProducts?: Product[] | null, preloadedVersions?: Record<string, string> | null): Library {
  const hasPreloaded = !!(preloadedProducts && preloadedProducts.length >= 0)
  const [products, setProducts] = useState<Product[]>(preloadedProducts ?? [])
  const [loading, setLoading] = useState<boolean>(!hasPreloaded)
  const [error, setError] = useState<string | null>(null)
  const [downloads, dispatch] = useReducer(dlReducer, {})
  const [installedVersions, setInstalledVersions] = useState<Record<string, string>>(preloadedVersions ?? {})
  const [cleanupBlocked, setCleanupBlocked] = useState<{ slug: string; blocked: api.BlockedCopy[] } | null>(null)
  const [retryingCleanup, setRetryingCleanup] = useState(false)
  const [firstRun, setFirstRun] = useState<api.FirstRunItem[]>([])
  const platform = useMemo(detectPlatform, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [prods, installed] = await Promise.all([
        api.getProducts(),
        api.getInstalledVersions().catch(() => ({} as Record<string, string>)),
      ])
      setProducts(prods)
      setInstalledVersions(installed)
    } catch (err) {
      setError(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasPreloaded) void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const counts = useMemo<Counts>(() => {
    const installed = products.filter((p) => !!installedVersions[p.slug]).length
    const updates = products.filter((p) => {
      const v = installedVersions[p.slug]
      return !!v && isNewerVersion(p.version, v)
    }).length
    const beta = products.filter(isBetaProduct).length
    return { total: products.length, installed, updates, beta }
  }, [products, installedVersions])

  const updatable = useMemo(
    () => products.filter((p) => {
      const v = installedVersions[p.slug]
      return !!v && isNewerVersion(p.version, v)
    }),
    [products, installedVersions],
  )

  const install = useCallback(async (product: Product) => {
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
      const msg = String(err)
      if (msg.includes('os error 32') || msg.includes('being used by another process')) {
        dispatch({ type: 'error', fileId, error: 'The plug-in is in use. Close your DAW and try again.' })
      } else {
        dispatch({ type: 'error', fileId, error: msg })
      }
    } finally {
      unlisten()
    }
  }, [platform])

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
    const installed = installedVersions[p.slug] ?? null
    const pro = isBetaProduct(p)
    const dl = downloads[`${p.id}-${platform}`]
    if (dl && dl.status === 'downloading') return { kind: 'downloading', installed, latest: p.version, percent: dl.percent, pro }
    if (dl && dl.status === 'installing') return { kind: 'installing', installed, latest: p.version, pro }
    if (dl && dl.status === 'error') return { kind: 'error', installed, latest: p.version, error: dl.error, pro }
    if (!installed) return { kind: 'not_installed', installed, latest: p.version, pro }
    if (isNewerVersion(p.version, installed)) return { kind: 'update', installed, latest: p.version, pro }
    const fr = firstRun.find((f) => f.slug === p.slug)
    if (fr && fr.can_tell && !fr.last_opened) return { kind: 'never_opened', installed, latest: p.version, pro }
    return { kind: 'installed', installed, latest: p.version, pro }
  }, [installedVersions, downloads, platform, firstRun])

  return {
    products, loading, error, reload, installedVersions, platform, firstRun, needsAttention, counts, updatable,
    stateOf, install, updateAll, uninstall,
    cleanupBlocked, retryingCleanup, retryCleanup, dismissCleanup: () => setCleanupBlocked(null),
  }
}
