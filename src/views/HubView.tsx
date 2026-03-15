import { useEffect, useLayoutEffect, useReducer, useCallback, useState, useRef } from 'react'
import { Download, Package, FolderOpen, CheckCircle, Loader2, AlertCircle, LogOut, RefreshCw, ArrowUpCircle, Trash2 } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import anime from 'animejs'
import * as api from '../lib/api'
import type { Product } from '../lib/api'

interface HubViewProps {
  user: api.User
  onLogout: () => void
  preloadedProducts?: Product[] | null
  preloadedVersions?: Record<string, string> | null
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

function dlReducer(state: DlMap, action: DlAction): DlMap {
  switch (action.type) {
    case 'start':
      return { ...state, [action.fileId]: { percent: 0, status: 'downloading' } }
    case 'progress':
      return { ...state, [action.fileId]: { percent: action.percent, status: action.status, installPath: action.installPath } }
    case 'error':
      return { ...state, [action.fileId]: { percent: 0, status: 'error', error: action.error } }
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

export function HubView({ user, onLogout, preloadedProducts, preloadedVersions }: HubViewProps) {
  const hasPreloaded = !!(preloadedProducts && preloadedProducts.length >= 0)
  const [products, setProducts] = useReducer((_: Product[], v: Product[]) => v, preloadedProducts ?? [])
  const [loading, setLoading] = useReducer((_: boolean, v: boolean) => v, !hasPreloaded)
  const [fetchError, setFetchError] = useReducer((_: string | null, v: string | null) => v, null)
  const [appVersion, setAppVersion] = useReducer((_: string, v: string) => v, '')
  const [downloads, dispatch] = useReducer(dlReducer, {})
  const [installedVersions, setInstalledVersions] = useState<Record<string, string>>(preloadedVersions ?? {})

  const headerRef = useRef<HTMLElement>(null)
  const greetingRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const glow1Ref = useRef<HTMLDivElement>(null)
  const glow2Ref = useRef<HTMLDivElement>(null)
  const animatedRef = useRef(false)

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {})
  }, [])

  // Entrance animations
  useEffect(() => {
    const tl = anime.timeline({ easing: 'easeOutCubic' })

    // Background glows fade in smoothly
    tl.add({
      targets: [glow1Ref.current, glow2Ref.current],
      opacity: [0, 1],
      duration: 1200,
      easing: 'easeOutQuad',
    }, 0)

    // Glow breathing — slow, subtle drift
    anime({
      targets: glow1Ref.current,
      translateX: [0, 20, 0],
      translateY: [0, -15, 0],
      scale: [1, 1.05, 1],
      duration: 10000,
      easing: 'easeInOutSine',
      loop: true,
    })
    anime({
      targets: glow2Ref.current,
      translateX: [0, -15, 0],
      translateY: [0, 10, 0],
      scale: [1, 1.08, 1],
      duration: 12000,
      easing: 'easeInOutSine',
      loop: true,
    })

    // Header slides down with gentle deceleration
    tl.add({
      targets: headerRef.current,
      translateY: [-30, 0],
      opacity: [0, 1],
      duration: 600,
      easing: 'easeOutCubic',
    }, 50)

    // Greeting fades up (not sideways — cleaner)
    tl.add({
      targets: greetingRef.current,
      translateY: [20, 0],
      opacity: [0, 1],
      filter: ['blur(4px)', 'blur(0px)'],
      duration: 500,
      easing: 'easeOutCubic',
    }, 250)
  }, [])

  // Stagger product cards when they load
  useEffect(() => {
    if (!loading && products.length > 0 && cardsRef.current && !animatedRef.current) {
      animatedRef.current = true
      anime({
        targets: cardsRef.current.children,
        translateY: [30, 0],
        opacity: [0, 1],
        duration: 500,
        delay: anime.stagger(80, { start: 200 }),
        easing: 'easeOutCubic',
      })
    }
  }, [loading, products])

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
    } catch (err) {
      setFetchError(typeof err === 'string' ? err : (err instanceof Error ? err.message : 'Failed to load purchases'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!hasPreloaded) loadProducts() }, [loadProducts, hasPreloaded])

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
      setInstalledVersions(prev => ({ ...prev, [product.slug]: product.version }))
    } catch (err) {
      const msg = String(err)
      if (msg.includes('os error 32') || msg.includes('being used by another process')) {
        dispatch({ type: 'error', fileId, error: 'Plugin is in use. Close your DAW (e.g. FL Studio) and try again.' })
      } else {
        dispatch({ type: 'error', fileId, error: msg })
      }
    } finally {
      unlisten()
    }
  }, [])

  const handleUninstall = useCallback(async (product: Product) => {
    try {
      await api.uninstallPlugin(product.slug, product.category || 'vst')
      setInstalledVersions(prev => {
        const next = { ...prev }
        delete next[product.slug]
        return next
      })
      const fileId = `${product.id}-${detectPlatform()}`
      dispatch({ type: 'progress', fileId, percent: 0, status: 'idle' })
    } catch (err) {
      const fileId = `${product.id}-${detectPlatform()}`
      dispatch({ type: 'error', fileId, error: String(err) })
    }
  }, [])

  const displayName = user.displayName || user.email.split('@')[0]

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#08080c] relative">
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div ref={glow1Ref} className="absolute -top-32 -right-32 w-[500px] h-[500px] bg-orange-500/[0.03] rounded-full blur-[120px] opacity-0" />
        <div ref={glow2Ref} className="absolute -bottom-32 -left-32 w-[400px] h-[400px] bg-fuchsia-500/[0.03] rounded-full blur-[120px] opacity-0" />
      </div>

      {/* Header */}
      <header ref={headerRef} className="relative flex items-center gap-3 px-5 h-14 bg-white/[0.02] border-b border-white/[0.06] flex-shrink-0 drag backdrop-blur-md opacity-0">
        <div className="flex items-center gap-2.5 no-drag">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-orange-500/15">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-white">Hardwave Suite</span>
            {appVersion && <span className="ml-1.5 text-[10px] text-zinc-600 font-mono">v{appVersion}</span>}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 no-drag">
          <span className="text-xs text-zinc-500 hidden sm:block">{user.email}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 hover:text-white text-xs transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Greeting */}
          <div ref={greetingRef} className="mb-8 opacity-0">
            <h1 className="text-2xl font-bold text-white">
              Hey, <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-fuchsia-400">{displayName}</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Your products are ready to download and install.</p>
          </div>

          {loading ? (
            <LoadingState />
          ) : fetchError ? (
            <ErrorState error={fetchError} onRetry={loadProducts} />
          ) : products.length === 0 ? (
            <EmptyState />
          ) : (
            <div ref={cardsRef} className="space-y-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  downloads={downloads}
                  installedVersion={installedVersions[product.slug] ?? null}
                  onDownload={(platform, url) => handleDownload(product, platform, url)}
                  onOpenFolder={() => api.openInstallFolder(product.category || 'vst')}
                  onUninstall={() => handleUninstall(product)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function LoadingState() {
  const ref = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    anime({
      targets: ref.current,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      easing: 'easeOutCubic',
    })
    if (dotsRef.current) {
      anime({
        targets: dotsRef.current.children,
        scale: [0.5, 1.2, 0.5],
        opacity: [0.3, 1, 0.3],
        duration: 1200,
        delay: anime.stagger(200),
        loop: true,
        easing: 'easeInOutSine',
      })
    }
  }, [])

  return (
    <div ref={ref} className="flex flex-col items-center gap-4 py-16 opacity-0">
      <div ref={dotsRef} className="flex gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
      </div>
      <span className="text-sm text-zinc-500">Loading your library...</span>
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    anime({
      targets: ref.current,
      opacity: [0, 1],
      scale: [0.9, 1],
      duration: 500,
      easing: 'easeOutCubic',
    })
  }, [])

  return (
    <div ref={ref} className="flex flex-col items-center gap-4 py-16 text-center opacity-0">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm text-zinc-400">{error}</p>
      <button onClick={onRetry} className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-sm rounded-lg transition-colors">
        <RefreshCw className="w-3.5 h-3.5" />Retry
      </button>
    </div>
  )
}

function ProductCard({ product, downloads, installedVersion, onDownload, onOpenFolder, onUninstall }: {
  product: Product; downloads: DlMap; installedVersion: string | null
  onDownload: (platform: string, url: string) => void; onOpenFolder: () => void; onUninstall: () => void
}) {
  const currentPlatform = detectPlatform()
  const platformUrl = product.downloads[currentPlatform]
  const fileId = `${product.id}-${currentPlatform}`
  const dlState = downloads[fileId]
  const status = dlState?.status ?? 'idle'
  const inProgress = status === 'downloading' || status === 'installing'
  const sessionInstalled = status === 'installed'
  const isInstalled = !!installedVersion || sessionInstalled
  const hasUpdate = installedVersion ? installedVersion !== product.version : false
  const showInstalled = sessionInstalled || (isInstalled && !hasUpdate && status === 'idle')

  const cardRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const installedRef = useRef<HTMLDivElement>(null)
  const prevStatus = useRef(status)
  const justInstalled = useRef(false)

  // Track if we just transitioned to installed (before paint)
  useLayoutEffect(() => {
    if (prevStatus.current !== status) {
      if (status === 'installed') {
        justInstalled.current = true
        // Hide the installed UI before browser paints
        if (installedRef.current) {
          installedRef.current.style.opacity = '0'
        }
      }
    }
  }, [status])

  // Run animations after paint
  useEffect(() => {
    if (prevStatus.current !== status) {
      if (status === 'installed' && cardRef.current) {
        const tl = anime.timeline({ easing: 'easeOutCubic' })

        // Gentle green glow on card
        tl.add({
          targets: cardRef.current,
          borderColor: ['rgba(255,255,255,0.06)', 'rgba(16,185,129,0.3)', 'rgba(16,185,129,0.12)'],
          boxShadow: ['0 0 0px rgba(16,185,129,0)', '0 0 20px rgba(16,185,129,0.1)', '0 0 0px rgba(16,185,129,0)'],
          duration: 1500,
          easing: 'easeOutQuad',
        }, 0)

        // Entire installed row fades in
        if (installedRef.current) {
          tl.add({
            targets: installedRef.current,
            opacity: [0, 1],
            translateY: [8, 0],
            duration: 400,
            easing: 'easeOutCubic',
          }, 100)
        }

        // Stop icon pulse
        if (iconRef.current) {
          anime.remove(iconRef.current)
          anime({
            targets: iconRef.current,
            scale: 1,
            duration: 300,
            easing: 'easeOutCubic',
          })
        }

        justInstalled.current = false
      }
      if (status === 'error' && cardRef.current) {
        anime({
          targets: cardRef.current,
          translateX: [0, -8, 8, -6, 6, -3, 3, 0],
          duration: 500,
          easing: 'easeInOutQuad',
        })
        if (iconRef.current) {
          anime.remove(iconRef.current)
          anime({
            targets: iconRef.current,
            scale: 1,
            duration: 300,
            easing: 'easeOutCubic',
          })
        }
      }
      if (status === 'downloading' && iconRef.current) {
        anime({
          targets: iconRef.current,
          scale: [1, 1.08, 1],
          duration: 1200,
          easing: 'easeInOutSine',
          loop: true,
        })
      }
      prevStatus.current = status
    }
  }, [status])

  // Hover interaction — subtle lift
  const handleMouseEnter = () => {
    if (cardRef.current && !inProgress) {
      anime({
        targets: cardRef.current,
        translateY: -1,
        duration: 250,
        easing: 'easeOutCubic',
      })
    }
    if (iconRef.current && !inProgress) {
      anime({
        targets: iconRef.current,
        scale: 1.05,
        rotate: '3deg',
        duration: 250,
        easing: 'easeOutCubic',
      })
    }
  }
  const handleMouseLeave = () => {
    if (cardRef.current && !inProgress) {
      anime({
        targets: cardRef.current,
        translateY: 0,
        duration: 250,
        easing: 'easeOutCubic',
      })
    }
    if (iconRef.current && !inProgress) {
      anime.remove(iconRef.current)
      anime({
        targets: iconRef.current,
        scale: 1,
        rotate: '0deg',
        duration: 250,
        easing: 'easeOutCubic',
      })
    }
  }

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="bg-white/[0.03] rounded-2xl border border-white/[0.06] transition-colors overflow-hidden backdrop-blur-sm opacity-0"
    >
      <div className="p-5">
        {/* Product header */}
        <div className="flex items-start gap-4">
          <div ref={iconRef} className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-fuchsia-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold text-white">{product.name}</h3>
              {(product.formats?.length ? product.formats : ['VST3']).map((fmt) => (
                <span key={fmt} className="text-[10px] font-medium border rounded-full px-2 py-0.5 text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20">{fmt}</span>
              ))}
            </div>
            <div className="text-[11px] text-zinc-600 font-mono mb-1">
              {hasUpdate ? (
                <><span className="text-zinc-500">v{installedVersion}</span> <span className="text-orange-400">&rarr; v{product.version}</span></>
              ) : (
                <>v{product.version}</>
              )}
              <span className="ml-2 text-zinc-600">{platformLabels[currentPlatform]}</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{product.description}</p>
          </div>
        </div>

        {/* Error banner */}
        {status === 'error' && (
          <div className="flex items-center gap-2 px-3 py-2.5 mt-4 rounded-xl bg-red-500/[0.08] border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-300">{dlState?.error || 'Installation failed'}</span>
          </div>
        )}

        {/* Action area */}
        {platformUrl ? (
          <div className="mt-4 flex items-center gap-3">
            {inProgress ? (
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-fuchsia-500 rounded-full transition-all duration-200" style={{ width: `${dlState?.percent ?? 0}%` }} />
                </div>
                <span className="text-xs text-zinc-400 font-mono w-8 text-right">{dlState?.percent ?? 0}%</span>
                <span className="text-xs text-orange-400">{status === 'installing' ? 'Installing...' : 'Downloading...'}</span>
                <Loader2 className="w-4 h-4 text-orange-400 animate-spin flex-shrink-0" />
              </div>
            ) : showInstalled ? (
              <div ref={installedRef} className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400 font-medium">Installed</span>
                </div>
                <button onClick={onUninstall} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 text-xs text-zinc-400 hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />Uninstall
                </button>
                <button onClick={onOpenFolder} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-all">
                  <FolderOpen className="w-3.5 h-3.5" />Open Folder
                </button>
              </div>
            ) : hasUpdate ? (
              <>
                <div className="flex items-center gap-2 flex-1">
                  <ArrowUpCircle className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-orange-400 font-medium">Update available</span>
                </div>
                <button onClick={onUninstall} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 text-xs text-zinc-400 hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />Uninstall
                </button>
                <button onClick={onOpenFolder} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-all">
                  <FolderOpen className="w-3.5 h-3.5" />Open Folder
                </button>
                <button onClick={() => onDownload(currentPlatform, platformUrl)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-400 hover:to-fuchsia-500 text-white text-sm font-medium rounded-lg transition-all shadow-md shadow-orange-500/20">
                  <ArrowUpCircle className="w-4 h-4" />Update
                </button>
              </>
            ) : (
              <button onClick={() => onDownload(currentPlatform, platformUrl)} className="flex items-center gap-2 px-4 py-2 ml-auto bg-gradient-to-r from-orange-500 to-fuchsia-600 hover:from-orange-400 hover:to-fuchsia-500 text-white text-sm font-medium rounded-lg transition-all shadow-md shadow-orange-500/20">
                <Download className="w-4 h-4" />{status === 'error' ? 'Retry' : `Install for ${platformLabels[currentPlatform]}`}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
            <span className="text-xs text-zinc-500">Not available for {platformLabels[currentPlatform]}</span>
          </div>
        )}

        {product.fileSize && (
          <div className="mt-2 text-[10px] text-zinc-600 text-right">Size: {formatBytes(product.fileSize * 1024 * 1024)}</div>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function EmptyState() {
  const ref = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    anime({
      targets: ref.current,
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 700,
      easing: 'easeOutCubic',
    })
    anime({
      targets: iconRef.current,
      scale: [0, 1],
      rotate: ['-20deg', '0deg'],
      duration: 800,
      easing: 'easeOutElastic(1, 0.6)',
      delay: 200,
    })
  }, [])

  return (
    <div ref={ref} className="flex flex-col items-center justify-center py-20 text-center opacity-0">
      <div ref={iconRef} className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/10 to-fuchsia-500/10 border border-orange-500/20 flex items-center justify-center mb-5">
        <Package className="w-7 h-7 text-orange-400/60" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">No purchases yet</h3>
      <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
        Your purchased VST plugins and sample packs will appear here.{' '}
        <a href="https://hardwavestudios.com" target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300 transition-colors">
          Browse the store
        </a>
      </p>
    </div>
  )
}
