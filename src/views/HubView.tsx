import { useEffect, useReducer, useCallback, useState, useMemo } from 'react'
import {
  Activity,
  Zap,
  Droplet,
  CircleDot,
  TrendingUp,
  ChevronsLeftRight,
  Music,
  Package,
  FolderOpen,
  Download,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import * as api from '../lib/api'
import type { Product } from '../lib/api'
import { isBetaProduct } from '../lib/beta'

interface HubViewProps {
  preloadedProducts?: Product[] | null
  preloadedVersions?: Record<string, string> | null
  filter?: 'all' | 'installed' | 'updates' | 'beta'
  search?: string
  onCountsChange?: (counts: HubCounts) => void
  onLastSyncChange?: (lastSync: Date | null) => void
}

export interface HubCounts {
  total: number
  installed: number
  updates: number
  beta: number
}

interface DlState {
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

function detectPlatform(): 'windows' | 'mac' | 'linux' {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'mac'
  return 'linux'
}

const platformLabels: Record<string, string> = { windows: 'Windows', mac: 'macOS', linux: 'Linux' }

/**
 * Pick a representative icon for a plug-in based on its slug.
 * Falls back to a generic Package mark for sample packs / unknown.
 */
function iconForSlug(slug: string, isSample: boolean) {
  if (isSample) return Music
  switch (slug) {
    case 'analyser':
    case 'hardwave-analyser':
      return Activity
    case 'loudlab':
      return Zap
    case 'wettboi':
      return Droplet
    case 'kickforge':
      return CircleDot
    case 'pumpcontrol':
      return TrendingUp
    case 'wideboi':
      return ChevronsLeftRight
    default:
      return Package
  }
}

/**
 * Render a plug-in name with the suffix coloured to match the mockup —
 * brand-red for released stable plug-ins, accent-violet for beta.
 */
function renderProductName(p: Product, beta: boolean) {
  const prefix = 'Hardwave '
  if (!p.name.startsWith(prefix)) {
    return <span>{p.name}</span>
  }
  const suffix = p.name.slice(prefix.length)
  return (
    <>
      Hardwave <span className={beta ? 'accent-violet' : 'accent-brand'}>{suffix}</span>
    </>
  )
}

function categoryLabel(p: Product): string {
  if (p.category === 'sample' || p.category === 'preset') return 'Sample pack'
  // Lightweight friendly mapping based on slug — keeps UI readable.
  switch (p.slug) {
    case 'analyser':
    case 'hardwave-analyser':
      return 'Spectrum analyser'
    case 'loudlab':
      return 'Limiter / loudness'
    case 'wettboi':
      return 'Reverb'
    case 'kickforge':
      return 'Kick synth'
    case 'pumpcontrol':
      return 'Sidechain'
    case 'wideboi':
      return 'Stereo width'
    default:
      return p.category ? p.category.toUpperCase() : 'Plug-in'
  }
}

function formatLabel(p: Product): string {
  if (p.category === 'sample' || p.category === 'preset') return 'Sample pack'
  const fmts = (p.formats && p.formats.length ? p.formats : ['VST3', 'CLAP']).join(' · ')
  return fmts
}

export function HubView({
  preloadedProducts,
  preloadedVersions,
  filter = 'all',
  search = '',
  onCountsChange,
  onLastSyncChange,
}: HubViewProps) {
  const hasPreloaded = !!(preloadedProducts && preloadedProducts.length >= 0)
  const [products, setProducts] = useState<Product[]>(preloadedProducts ?? [])
  const [loading, setLoading] = useState<boolean>(!hasPreloaded)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [downloads, dispatch] = useReducer(dlReducer, {})
  const [installedVersions, setInstalledVersions] = useState<Record<string, string>>(preloadedVersions ?? {})
  const [lastSync, setLastSync] = useState<Date | null>(hasPreloaded ? new Date() : null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [prods, installed] = await Promise.all([
        api.getProducts(),
        api.getInstalledVersions().catch(() => ({} as Record<string, string>)),
      ])
      setProducts(prods)
      setInstalledVersions(installed)
      const now = new Date()
      setLastSync(now)
      onLastSyncChange?.(now)
    } catch (err) {
      setFetchError(typeof err === 'string' ? err : err instanceof Error ? err.message : 'Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }, [onLastSyncChange])

  useEffect(() => {
    if (!hasPreloaded) loadProducts()
    else if (lastSync) onLastSyncChange?.(lastSync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo<HubCounts>(() => {
    const installed = products.filter((p) => !!installedVersions[p.slug]).length
    const updates = products.filter((p) => {
      const v = installedVersions[p.slug]
      return v && v !== p.version
    }).length
    const beta = products.filter(isBetaProduct).length
    return { total: products.length, installed, updates, beta }
  }, [products, installedVersions])

  useEffect(() => { onCountsChange?.(counts) }, [counts, onCountsChange])

  const handleDownload = useCallback(async (product: Product, platform: string, url: string) => {
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
        dispatch({ type: 'error', fileId, error: 'Plug-in is in use. Close your DAW (e.g. FL Studio) and try again.' })
      } else {
        dispatch({ type: 'error', fileId, error: msg })
      }
    } finally {
      unlisten()
    }
  }, [])

  // Filter + search logic
  const filtered = useMemo(() => {
    let list = products
    if (filter === 'installed') {
      list = list.filter((p) => !!installedVersions[p.slug])
    } else if (filter === 'updates') {
      list = list.filter((p) => {
        const v = installedVersions[p.slug]
        return v && v !== p.version
      })
    } else if (filter === 'beta') {
      list = list.filter(isBetaProduct)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [products, installedVersions, filter, search])

  const updatableProducts = useMemo(
    () => products.filter((p) => {
      const v = installedVersions[p.slug]
      return v && v !== p.version
    }),
    [products, installedVersions],
  )

  const handleUpdateAll = useCallback(async () => {
    const platform = detectPlatform()
    for (const p of updatableProducts) {
      const url = p.downloads[platform]
      if (url) {
        // Sequential to avoid hammering disk; each download tracked independently.
        // eslint-disable-next-line no-await-in-loop
        await handleDownload(p, platform, url)
      }
    }
  }, [updatableProducts, handleDownload])

  // Loading / error short-circuits
  if (loading) {
    return (
      <div className="loading-state">
        <p>Loading your library&hellip;</p>
      </div>
    )
  }
  if (fetchError) {
    return (
      <div className="error-state">
        <AlertCircle size={28} color="var(--brand-hover)" />
        <h3>Couldn&rsquo;t load your library</h3>
        <p>{fetchError}</p>
        <button className="btn" onClick={loadProducts} type="button">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    )
  }

  // Filtered-empty states get dedicated copy so the page isn't blank.
  const emptyByFilter = filtered.length === 0 && products.length > 0

  return (
    <>
      <div className="hub-h">
        <div>
          <h1>{filterTitle(filter)}</h1>
          <p className="lede">{filterLede(filter)}</p>
        </div>
        <div className="right">
          <button className="btn" onClick={loadProducts} type="button">
            <RefreshCw size={13} />
            Refresh
          </button>
          {filter !== 'installed' && (
            <button
              className="btn btn-primary"
              onClick={handleUpdateAll}
              disabled={updatableProducts.length === 0}
              type="button"
            >
              <Download size={13} />
              Update all
            </button>
          )}
        </div>
      </div>

      {filter !== 'installed' && updatableProducts.length > 0 && (
        <div className="update-banner">
          <Download className="update-banner-icon" size={18} />
          <div className="update-banner-body">
            <strong>{updatableProducts.length} update{updatableProducts.length === 1 ? '' : 's'} available.</strong>{' '}
            {updatableProducts.length === 1
              ? `${updatableProducts[0].name} v${updatableProducts[0].version} is ready to install.`
              : 'Pull the latest builds for everything you have installed.'}
          </div>
          <button className="update-banner-btn" onClick={handleUpdateAll} type="button">
            {updatableProducts.length === 1 ? 'Install' : 'Update all'}
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="empty-state">
          <Package size={28} color="var(--text-dim)" />
          <h3>No purchases yet</h3>
          <p>
            Your purchased Hardwave plug-ins and sample packs will appear here.{' '}
            <a href="https://hardwavestudios.com" target="_blank" rel="noreferrer" style={{ color: 'var(--brand-hover)' }}>
              Browse the store.
            </a>
          </p>
        </div>
      ) : emptyByFilter ? (
        <div className="empty-state">
          <Package size={28} color="var(--text-dim)" />
          <h3>Nothing here yet</h3>
          <p>{filterEmptyCopy(filter, search)}</p>
        </div>
      ) : (
        <div className="cards">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              downloads={downloads}
              installedVersion={installedVersions[product.slug] ?? null}
              onDownload={handleDownload}
              onOpenFolder={() => api.openInstallFolder(product.category || 'vst')}
            />
          ))}
        </div>
      )}
    </>
  )
}

function filterTitle(f: 'all' | 'installed' | 'updates' | 'beta'): string {
  switch (f) {
    case 'installed':
      return 'Installed'
    case 'updates':
      return 'Updates'
    case 'beta':
      return 'Beta builds'
    default:
      return 'Library'
  }
}

function filterLede(f: 'all' | 'installed' | 'updates' | 'beta'): string {
  switch (f) {
    case 'installed':
      return 'Plug-ins currently installed on this machine.'
    case 'updates':
      return 'New builds for plug-ins you already have installed.'
    case 'beta':
      return 'Time-limited cutting-edge builds for subscribers. Each plug-in still in beta is listed below — they also appear on Plug-ins, Installed, and Updates.'
    default:
      return 'Every Hardwave plug-in. Installed locally where they belong.'
  }
}

function filterEmptyCopy(f: 'all' | 'installed' | 'updates' | 'beta', search: string): string {
  if (search) return `No plug-ins match “${search}”.`
  if (f === 'installed') return 'You haven’t installed any plug-ins yet. Switch to Plug-ins to grab one.'
  if (f === 'updates') return 'You’re fully up to date. Nothing to install.'
  if (f === 'beta') return 'No plug-ins are currently in beta — everything in the catalogue is stable.'
  return 'No plug-ins to show.'
}

interface ProductCardProps {
  product: Product
  downloads: DlMap
  installedVersion: string | null
  onDownload: (product: Product, platform: string, url: string) => void
  onOpenFolder: () => void
}

function ProductCard({ product, downloads, installedVersion, onDownload, onOpenFolder }: ProductCardProps) {
  const platform = detectPlatform()
  const isSample = product.category === 'sample' || product.category === 'preset'
  const platformUrl = isSample
    ? (product.downloads[platform] || product.downloads.windows || product.downloads.mac || product.downloads.linux)
    : product.downloads[platform]
  const fileId = `${product.id}-${platform}`
  const dl = downloads[fileId]
  const status = dl?.status ?? 'idle'
  const inProgress = status === 'downloading' || status === 'installing'
  const sessionInstalled = status === 'installed'
  const isInstalled = !!installedVersion || sessionInstalled
  const hasUpdate = !!installedVersion && installedVersion !== product.version
  const beta = isBetaProduct(product)

  const Icon = iconForSlug(product.slug, isSample)

  // Corner pill: UPDATE | INSTALLED | BETA | AVAILABLE
  let cornerLabel: string
  let cornerClass: string
  if (hasUpdate) {
    cornerLabel = 'UPDATE'
    cornerClass = 'update'
  } else if (isInstalled) {
    cornerLabel = 'INSTALLED'
    cornerClass = 'installed'
  } else if (beta) {
    cornerLabel = 'BETA'
    cornerClass = 'beta'
  } else {
    cornerLabel = 'AVAILABLE'
    cornerClass = 'notinstalled'
  }

  const versionNode = hasUpdate ? (
    <span>
      v{installedVersion} &rarr; <span className={`v ${beta ? 'beta' : 'update'}`}>v{product.version}</span>
    </span>
  ) : (
    <span>
      {beta && <span className="beta-tag">BETA</span>}
      <span className={`v ${beta ? 'beta' : ''}`}>v{product.version}</span>
    </span>
  )

  const actionDisabled = !platformUrl
  const installLabel = beta && !isInstalled ? 'Install beta' : 'Install'

  let primary: React.ReactNode
  if (inProgress) {
    primary = (
      <div className="card-progress">
        <div className="card-progress-bar">
          <div className="card-progress-fill" style={{ width: `${dl?.percent ?? 0}%` }} />
        </div>
        <span className="card-progress-pct">{dl?.percent ?? 0}%</span>
      </div>
    )
  } else if (hasUpdate) {
    primary = (
      <button
        className="card-action update"
        onClick={() => platformUrl && onDownload(product, platform, platformUrl)}
        disabled={actionDisabled}
        type="button"
      >
        <RefreshCw size={13} /> Update
      </button>
    )
  } else if (isInstalled) {
    primary = (
      <button className="card-action" disabled type="button">
        <Check size={13} /> Up to date
      </button>
    )
  } else {
    primary = (
      <button
        className="card-action primary"
        onClick={() => platformUrl && onDownload(product, platform, platformUrl)}
        disabled={actionDisabled}
        type="button"
      >
        <Download size={13} /> {installLabel}
      </button>
    )
  }

  return (
    <div className="card">
      <div className="card-art">
        <div className="card-art-icon">
          <Icon size={22} />
        </div>
        <span className={`card-art-corner ${cornerClass}`}>{cornerLabel}</span>
      </div>
      <div className="card-body">
        <div className="card-cat">{categoryLabel(product)}</div>
        <div className="card-name">{renderProductName(product, beta)}</div>
        <p className="card-desc">{product.description || 'Hardwave plug-in.'}</p>
        <div className="card-meta">
          {versionNode}
          <span>{actionDisabled ? `Not on ${platformLabels[platform]}` : formatLabel(product)}</span>
        </div>
        {status === 'error' && (
          <div className="card-error">{dl?.error || 'Installation failed'}</div>
        )}
        <div className="card-actions">
          {primary}
          {(isInstalled || hasUpdate) && (
            <button
              className="card-action icon"
              onClick={onOpenFolder}
              title="Open install folder"
              type="button"
            >
              <FolderOpen size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
