import { Download, X, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'

interface UpdateModalProps {
  version: string
  changelog: string
  date: string | null
  downloading: boolean
  progress: number
  downloaded: boolean
  error: string | null
  onUpdate: () => void
  onDismiss: () => void
}

export function UpdateModal({
  version,
  changelog,
  date,
  downloading,
  progress,
  downloaded,
  error,
  onUpdate,
  onDismiss,
}: UpdateModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!downloading ? onDismiss : undefined} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#111118] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient accent line */}
        <div className="h-0.5 bg-gradient-to-r from-red-700 via-red-500 to-red-700" />

        {/* Header */}
        <div className="flex items-start gap-4 p-5 pb-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600/20 to-red-500/10 border border-red-600/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-white">Update Available</h2>
            <p className="text-sm text-zinc-400 mt-0.5">
              Hardwave Suite <span className="text-red-400 font-mono font-medium">v{version}</span>
            </p>
          </div>
          {!downloading && (
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Changelog */}
        <div className="px-5 pt-4 pb-3">
          {date && (
            <div className="text-[10px] text-zinc-600 font-mono mb-2">
              {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          )}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 max-h-48 overflow-y-auto">
            <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">What's new</h3>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {formatChangelog(changelog)}
            </div>
            <a
              href={`https://hardwavestudios.com/changelog#v${version}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              View full changelog
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>

        {/* Progress */}
        {downloading && (
          <div className="px-5 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-700 to-red-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(5, progress)}%` }}
                />
              </div>
              <span className="text-[11px] text-zinc-500 font-mono w-8 text-right">{progress}%</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400 truncate">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 p-5 pt-3">
          {!downloading && !downloaded && (
            <>
              <button
                onClick={onDismiss}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-sm text-zinc-400 hover:text-white transition-all"
              >
                Later
              </button>
              <button
                onClick={onUpdate}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-500 hover:from-red-500 text-sm font-semibold text-white transition-all shadow-lg shadow-red-600/15 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Update now
              </button>
            </>
          )}
          {downloading && (
            <div className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-zinc-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
              Downloading update...
            </div>
          )}
          {downloaded && (
            <div className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Restarting...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatChangelog(text: string): string {
  if (!text) return 'Bug fixes and improvements.'
  // Split into lines, clean up markdown, take first 4 items as summary
  const lines = text
    .replace(/^#+\s*/gm, '')
    .split('\n')
    .map(l => l.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)
  const items = lines.slice(0, 4)
  return items.map(l => `\u2022 ${l}`).join('\n')
}
