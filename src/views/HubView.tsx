import { useEffect, useReducer, useCallback } from 'react'
import { Download, Package, Music2, Zap, FolderOpen, CheckCircle, Loader2, AlertCircle, LogOut, RefreshCw } from 'lucide-react'
import { getVersion } from '@tauri-apps/api/app'
import * as api from '../lib/api'
import type { Purchase, DownloadFile } from '../lib/api'

interface HubViewProps {
  user: api.User
  onLogout: () => void
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

export function HubView({ user, onLogout }: HubViewProps) {
  const [purchases, setPurchases] = useReducer((_: Purchase[], v: Purchase[]) => v, [])
  const [loadingPurchases, setLoadingPurchases] = useReducer((_: boolean, v: boolean) => v, true)
  const [fetchError, setFetchError] = useReducer((_: string | null, v: string | null) => v, null)
  const [appVersion, setAppVersion] = useReducer((_: string, v: string) => v, '')
  const [downloads, dispatch] = useReducer(dlReducer, {})

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {})
  }, [])

  const loadPurchases = useCallback(async () => {
    setLoadingPurchases(true)
    setFetchError(null)
    try {
      setPurchases(await api.getPurchases())
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load purchases')
    } finally {
      setLoadingPurchases(false)
    }
  }, [])

  useEffect(() => { loadPurchases() }, [loadPurchases])

  const handleDownload = useCallback(async (file: DownloadFile, purchase: Purchase) => {
    dispatch({ type: 'start', fileId: file.id })
    const unlisten = await api.onDownloadProgress((p) => {
      if (p.file_id === file.id) {
        dispatch({ type: 'progress', fileId: file.id, percent: p.percent, status: p.status as DlState['status'], installPath: p.install_path })
      }
    })
    try {
      await api.downloadAndInstall(file.id, file.url, file.filename, purchase.product.category, purchase.product.name)
    } catch (err) {
      dispatch({ type: 'error', fileId: file.id, error: String(err) })
    } finally {
      unlisten()
    }
  }, [])

  const displayName = user.displayName || user.email.split('@')[0]

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-[#09090b]">
      {/* Header */}
      <header className="flex items-center gap-3 px-5 h-14 bg-[#111113] border-b border-[#27272a]/60 flex-shrink-0 drag">
        <div className="flex items-center gap-2.5 no-drag">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow shadow-cyan-500/20">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-white">Hardwave Suite</span>
            {appVersion && <span className="ml-1.5 text-[10px] text-zinc-600">v{appVersion}</span>}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 no-drag">
          <span className="text-xs text-zinc-500 hidden sm:block">{user.email}</span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-400 hover:text-white text-xs transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">
              Hey, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">{displayName}</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Your purchased products are ready to download and install.</p>
          </div>

          {loadingPurchases ? (
            <div className="flex items-center gap-3 text-zinc-500 py-12 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading your library…</span>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-zinc-400">{fetchError}</p>
              <button onClick={loadPurchases} className="flex items-center gap-1.5 px-4 py-2 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-zinc-300 text-sm rounded-lg transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />Retry
              </button>
            </div>
          ) : purchases.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <PurchaseCard
                  key={purchase.id}
                  purchase={purchase}
                  downloads={downloads}
                  onDownload={(file) => handleDownload(file, purchase)}
                  onOpenFolder={() => api.openInstallFolder(purchase.product.category)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function PurchaseCard({ purchase, downloads, onDownload, onOpenFolder }: {
  purchase: Purchase; downloads: DlMap
  onDownload: (file: DownloadFile) => void; onOpenFolder: () => void
}) {
  const { product } = purchase
  const anyInstalled = product.files.some((f) => downloads[f.id]?.status === 'installed')

  return (
    <div className="bg-[#111113] rounded-2xl border border-[#27272a] hover:border-[#3f3f46] transition-colors overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-[#1c1c1f] border border-[#27272a] flex items-center justify-center flex-shrink-0">
            <CategoryIcon category={product.category} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-white">{product.name}</h3>
              <CategoryBadge category={product.category} />
              {anyInstalled && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <CheckCircle className="w-2.5 h-2.5" />Installed
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-600 mb-1">v{product.version}</div>
            <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{product.description}</p>
          </div>
          {anyInstalled && (
            <button onClick={onOpenFolder} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-xs text-zinc-400 hover:text-white transition-all flex-shrink-0">
              <FolderOpen className="w-3.5 h-3.5" /><span className="hidden sm:block">Open Folder</span>
            </button>
          )}
        </div>
        <div className="space-y-2">
          {product.files.map((file) => (
            <FileRow key={file.id} file={file} state={downloads[file.id]} onDownload={() => onDownload(file)} />
          ))}
        </div>
        {purchase.license_key && (
          <div className="mt-4 pt-3 border-t border-[#1e1e23] flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider flex-shrink-0">License</span>
            <code className="text-[11px] font-mono text-zinc-500 bg-[#0d0d0f] px-2 py-0.5 rounded truncate">{purchase.license_key}</code>
          </div>
        )}
      </div>
    </div>
  )
}

function FileRow({ file, state, onDownload }: { file: DownloadFile; state: DlState | undefined; onDownload: () => void }) {
  const status = state?.status ?? 'idle'
  const inProgress = status === 'downloading' || status === 'installing'

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0d0d0f] rounded-xl border border-[#1c1c1f]">
      <PlatformBadge platform={file.platform} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-zinc-300 truncate">{file.filename}</div>
        <div className="text-[10px] text-zinc-600">{formatBytes(file.file_size)}</div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {inProgress && (
          <>
            <div className="w-20 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-200" style={{ width: `${state?.percent ?? 0}%` }} />
            </div>
            <span className="text-[10px] text-zinc-500 w-7 text-right">{state?.percent ?? 0}%</span>
            <span className="text-[10px] text-cyan-400 w-16">{status === 'installing' ? 'Installing…' : 'Downloading…'}</span>
            <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          </>
        )}
        {status === 'installed' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />Installed
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-red-400" title={state?.error}>
            <AlertCircle className="w-3.5 h-3.5" />Failed
          </span>
        )}
        {!inProgress && status !== 'installed' && (
          <button onClick={onDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-lg transition-colors">
            <Download className="w-3 h-3" />{status === 'error' ? 'Retry' : 'Install'}
          </button>
        )}
      </div>
    </div>
  )
}

function CategoryIcon({ category }: { category: string }) {
  if (category === 'vst') return <Zap className="w-5 h-5 text-purple-400" />
  if (category === 'sample_pack') return <Music2 className="w-5 h-5 text-cyan-400" />
  return <Package className="w-5 h-5 text-blue-400" />
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, [string, string]> = {
    vst:         ['VST3',        'text-purple-400 bg-purple-500/10 border-purple-500/20'],
    sample_pack: ['Sample Pack', 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'],
    preset_pack: ['Preset Pack', 'text-blue-400 bg-blue-500/10 border-blue-500/20'],
  }
  const [label, cls] = map[category] ?? [category, 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20']
  return <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${cls}`}>{label}</span>
}

function PlatformBadge({ platform }: { platform: string }) {
  const labels: Record<string, string> = { windows: 'Win', mac: 'Mac', linux: 'Linux', all: 'All' }
  return (
    <span className="text-[10px] font-mono text-zinc-600 bg-[#18181b] border border-[#27272a] rounded px-1.5 py-0.5 flex-shrink-0">
      {labels[platform] ?? platform}
    </span>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
        <Package className="w-7 h-7 text-cyan-400/60" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">No purchases yet</h3>
      <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
        Your purchased VST plugins and sample packs will appear here.{' '}
        <a href="https://hardwavestudios.com" target="_blank" rel="noreferrer" className="text-cyan-500 hover:text-cyan-400 transition-colors">
          Browse the store
        </a>
      </p>
    </div>
  )
}
