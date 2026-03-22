import { Download, RotateCcw, Loader2, CheckCircle } from 'lucide-react'

interface UpdateBannerProps {
  version: string
  downloading: boolean
  progress: number
  downloaded: boolean
  error: string | null
  onUpdate: () => void
}

export function UpdateBanner({
  version,
  downloading,
  downloaded,
  error,
  onUpdate,
}: UpdateBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-red-600/10 border-b border-red-600/20 text-sm no-drag backdrop-blur-sm">
      <div className="flex items-center gap-2 flex-1">
        {downloaded ? (
          <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        ) : downloading ? (
          <Loader2 className="w-4 h-4 text-red-400 animate-spin flex-shrink-0" />
        ) : (
          <Download className="w-4 h-4 text-red-400 flex-shrink-0" />
        )}
        <span className="text-zinc-300">
          {downloaded
            ? 'Update ready — restarting...'
            : downloading
            ? 'Downloading update...'
            : `Hardwave Suite ${version} is available`}
        </span>
        {error && <span className="text-red-400 text-xs ml-2">{error}</span>}
      </div>
      {!downloading && !downloaded && (
        <button
          onClick={onUpdate}
          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3" />
          Update now
        </button>
      )}
    </div>
  )
}
