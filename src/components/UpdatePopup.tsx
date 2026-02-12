import { useState } from 'react'
import { Button } from './Button'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

interface UpdatePopupProps {
  updateInfo: UpdateInfo | null
  isDownloading: boolean
  downloadProgress: DownloadProgress | null
  isDownloaded: boolean
  onDownload: () => void
  onInstall: () => void
  onDismiss: () => void
}

export function UpdatePopup({
  updateInfo,
  isDownloading,
  downloadProgress,
  isDownloaded,
  onDownload,
  onInstall,
  onDismiss,
}: UpdatePopupProps) {
  const [minimized, setMinimized] = useState(false)

  if (!updateInfo) return null

  // Minimized state - small badge in corner
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 bg-accent-primary text-white px-4 py-2 rounded-full shadow-lg hover:bg-accent-primary/90 transition-colors flex items-center gap-2 z-50"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {isDownloading ? (
          <span>{Math.round(downloadProgress?.percent || 0)}%</span>
        ) : isDownloaded ? (
          <span>Ready to install</span>
        ) : (
          <span>Update available</span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-2xl p-6 max-w-md w-full mx-4 border border-bg-hover shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Update Available</h2>
              <p className="text-sm text-text-secondary">Version {updateInfo.version}</p>
            </div>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Release Notes */}
        {updateInfo.releaseNotes && (
          <div className="mb-4 p-3 bg-bg-primary rounded-lg max-h-32 overflow-y-auto">
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{updateInfo.releaseNotes}</p>
          </div>
        )}

        {/* Download Progress */}
        {isDownloading && downloadProgress && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">Downloading...</span>
              <span className="text-text-primary">{Math.round(downloadProgress.percent)}%</span>
            </div>
            <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-primary to-accent-tertiary transition-all duration-300"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-2">
              {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)} ({formatBytes(downloadProgress.bytesPerSecond)}/s)
            </p>
          </div>
        )}

        {/* Downloaded State */}
        {isDownloaded && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-400">Download complete! Ready to install.</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!isDownloading && !isDownloaded && (
            <>
              <Button variant="secondary" onClick={onDismiss} className="flex-1">
                Later
              </Button>
              <Button variant="primary" onClick={onDownload} className="flex-1">
                Download Now
              </Button>
            </>
          )}

          {isDownloading && (
            <Button variant="secondary" onClick={() => setMinimized(true)} className="flex-1">
              Continue in Background
            </Button>
          )}

          {isDownloaded && (
            <>
              <Button variant="secondary" onClick={onDismiss} className="flex-1">
                Later
              </Button>
              <Button variant="primary" onClick={onInstall} className="flex-1">
                Install & Restart
              </Button>
            </>
          )}
        </div>

        {isDownloaded && (
          <p className="text-xs text-text-tertiary text-center mt-3">
            The app will close and restart to complete the update.
          </p>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
