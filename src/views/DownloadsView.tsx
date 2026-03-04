import { useEffect } from 'react'
import { Download, Package, Music2, Zap, FolderOpen, CheckCircle, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAppStore } from '../store'
import type { Purchase, DownloadFile, DownloadState } from '../types'

interface DownloadsViewProps {
  onBack: () => void
}

export function DownloadsView({ onBack }: DownloadsViewProps) {
  const { purchases, activeDownloads, loadPurchases, downloadAndInstall, openInstallFolder } = useAppStore()

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0b]">
      {/* Header */}
      <div className="h-16 bg-[#111113] border-b border-[#27272a]/50 flex items-center px-6 drag">
        <div className="flex items-center gap-3 no-drag">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-[#18181b] hover:bg-[#27272a] flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            title="Back to Hub"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white">Downloads</span>
            <div className="text-[10px] text-zinc-500">{purchases.length} purchased product{purchases.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {purchases.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-6">
              {purchases.map((purchase) => (
                <PurchaseCard
                  key={purchase.id}
                  purchase={purchase}
                  activeDownloads={activeDownloads}
                  onDownload={(file) =>
                    downloadAndInstall(
                      file.id,
                      file.url,
                      file.filename,
                      purchase.product.category,
                      purchase.product.name,
                    )
                  }
                  onOpenFolder={() => openInstallFolder(purchase.product.category)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PurchaseCard({
  purchase,
  activeDownloads,
  onDownload,
  onOpenFolder,
}: {
  purchase: Purchase
  activeDownloads: Record<string, DownloadState>
  onDownload: (file: DownloadFile) => void
  onOpenFolder: () => void
}) {
  const { product } = purchase
  const anyInstalled = product.files.some((f) => activeDownloads[f.id]?.status === 'installed')

  return (
    <div className="bg-[#111113] rounded-2xl border border-[#27272a] overflow-hidden hover:border-[#3f3f46] transition-colors">
      <div className="p-6">
        {/* Product Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1e1e23] to-[#27272a] border border-[#3f3f46] flex items-center justify-center flex-shrink-0">
            <CategoryIcon category={product.category} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-white truncate">{product.name}</h3>
              <CategoryBadge category={product.category} />
              {anyInstalled && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                  <CheckCircle className="w-3 h-3" />
                  Installed
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500 mb-1">v{product.version}</div>
            <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{product.description}</p>
          </div>
          {anyInstalled && (
            <button
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] border border-[#3f3f46] text-xs text-zinc-400 hover:text-white transition-all flex-shrink-0"
              title="Open install folder"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Open Folder
            </button>
          )}
        </div>

        {/* Files */}
        <div className="space-y-2">
          {product.files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              downloadState={activeDownloads[file.id]}
              onDownload={() => onDownload(file)}
            />
          ))}
        </div>

        {/* License key */}
        {purchase.license_key && (
          <div className="mt-4 pt-4 border-t border-[#27272a] flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">License:</span>
            <code className="text-[10px] font-mono text-zinc-500 bg-[#18181b] px-2 py-0.5 rounded">
              {purchase.license_key}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}

function FileRow({
  file,
  downloadState,
  onDownload,
}: {
  file: DownloadFile
  downloadState: DownloadState | undefined
  onDownload: () => void
}) {
  const isDownloading = downloadState?.status === 'downloading'
  const isInstalling = downloadState?.status === 'installing'
  const isInstalled = downloadState?.status === 'installed'
  const isError = downloadState?.status === 'error'
  const inProgress = isDownloading || isInstalling

  return (
    <div className="flex items-center gap-3 p-3 bg-[#0d0d0f] rounded-xl border border-[#1e1e23]">
      {/* Platform badge */}
      <PlatformBadge platform={file.platform} />

      {/* Filename + size */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-zinc-300 truncate">{file.filename}</div>
        <div className="text-[10px] text-zinc-600">{formatBytes(file.file_size)}</div>
      </div>

      {/* Progress / Status / Button */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {inProgress && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${downloadState?.percent ?? 0}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-500 w-8 text-right">
              {downloadState?.percent ?? 0}%
            </span>
            <span className="text-[10px] text-blue-400">
              {isInstalling ? 'Installing…' : 'Downloading…'}
            </span>
            <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
          </div>
        )}

        {isInstalled && !inProgress && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Installed</span>
          </div>
        )}

        {isError && !inProgress && (
          <div className="flex items-center gap-1.5 text-red-400" title={downloadState?.error}>
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">Failed</span>
          </div>
        )}

        {!inProgress && !isInstalled && (
          <button
            onClick={onDownload}
            disabled={inProgress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {isError ? 'Retry' : 'Download & Install'}
          </button>
        )}
      </div>

      {/* Install path tooltip on hover (shown when installed) */}
      {isInstalled && downloadState?.installPath && (
        <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 px-2 py-1 bg-[#1e1e23] border border-[#3f3f46] rounded text-[10px] text-zinc-400 whitespace-nowrap z-10 pointer-events-none">
          {downloadState.installPath}
        </div>
      )}
    </div>
  )
}

function CategoryIcon({ category }: { category: string }) {
  const cls = "w-6 h-6"
  if (category === 'vst') return <Zap className={`${cls} text-purple-400`} />
  if (category === 'sample_pack') return <Music2 className={`${cls} text-cyan-400`} />
  return <Package className={`${cls} text-blue-400`} />
}

function CategoryBadge({ category }: { category: string }) {
  const labels: Record<string, { label: string; cls: string }> = {
    vst: { label: 'VST3', cls: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
    sample_pack: { label: 'Sample Pack', cls: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
    preset_pack: { label: 'Preset Pack', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  }
  const { label, cls } = labels[category] ?? { label: category, cls: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' }
  return (
    <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${cls}`}>{label}</span>
  )
}

function PlatformBadge({ platform }: { platform: string }) {
  const labels: Record<string, string> = {
    windows: 'Win',
    mac: 'Mac',
    linux: 'Linux',
    all: 'All',
  }
  return (
    <span className="text-[10px] font-mono text-zinc-500 bg-[#18181b] border border-[#27272a] rounded px-1.5 py-0.5 flex-shrink-0">
      {labels[platform] ?? platform}
    </span>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
        <Package className="w-8 h-8 text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">No Purchases Yet</h2>
      <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
        Your purchased VST plugins and sample packs will appear here. Visit the Hardwave Studios store to browse products.
      </p>
    </div>
  )
}
