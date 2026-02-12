import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, XCircle, Folder } from 'lucide-react'
import { Button } from './Button'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: () => Promise<void>
}

interface Progress {
  total: number
  indexed: number
  current_file?: string
  status: 'scanning' | 'analyzing' | 'complete' | 'error'
  error?: string
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setProgress(null)
      setIsScanning(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    // Listen for scan progress
    const unsubscribe = window.electron.folders.onScanProgress((prog) => {
      setProgress(prog)
      if (prog.status === 'complete' || prog.status === 'error') {
        setIsScanning(false)
      }
    })

    return unsubscribe
  }, [isOpen])

  const handleImport = async () => {
    setIsScanning(true)
    try {
      await onImport()
    } catch (error) {
      console.error('Import error:', error)
      setProgress({
        total: 0,
        indexed: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      setIsScanning(false)
    }
  }

  if (!isOpen) return null

  const progressPercent = progress ? (progress.indexed / progress.total) * 100 : 0

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-bg-hover rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-accent-primary to-accent-tertiary flex items-center justify-center">
            <Folder className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Import Folder</h2>
            <p className="text-sm text-text-tertiary">Scan and index your sample library</p>
          </div>
        </div>

        {!isScanning && !progress && (
          <>
            <div className="bg-bg-tertiary rounded-lg p-4 mb-6">
              <p className="text-sm text-text-secondary mb-3">
                Select a folder to scan for audio files. The app will:
              </p>
              <ul className="text-sm text-text-tertiary space-y-1.5 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-accent-success">✓</span>
                  <span>Find all audio files (WAV, MP3, FLAC, etc.)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-success">✓</span>
                  <span>Detect duplicates using file hashing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-success">✓</span>
                  <span>Auto-tag based on folder structure</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-success">✓</span>
                  <span>Extract BPM and musical key</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleImport} className="flex-1">
                Select Folder
              </Button>
            </div>
          </>
        )}

        {isScanning && progress && (
          <>
            <div className="mb-6">
              {/* Progress Bar */}
              <div className="h-2 bg-bg-primary rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-text-secondary">
                  {progress.indexed} / {progress.total} files
                </span>
                <span className="text-text-tertiary">{Math.round(progressPercent)}%</span>
              </div>

              {/* Current File */}
              {progress.current_file && (
                <div className="bg-bg-tertiary rounded-lg p-3 flex items-center gap-3">
                  <Loader2 className="text-accent-primary animate-spin" size={18} />
                  <span className="text-sm text-text-secondary truncate">
                    {progress.current_file}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-text-tertiary text-center">
              Please wait while we scan your files...
            </p>
          </>
        )}

        {progress?.status === 'complete' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-accent-success/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-accent-success" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Import Complete!</h3>
              <p className="text-sm text-text-secondary">
                Successfully indexed {progress.indexed} files
              </p>
            </div>

            <Button variant="primary" onClick={onClose} className="w-full">
              Done
            </Button>
          </>
        )}

        {progress?.status === 'error' && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-accent-error/20 flex items-center justify-center mx-auto mb-4">
                <XCircle className="text-accent-error" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Import Failed</h3>
              <p className="text-sm text-accent-error">
                {progress.error || 'An unknown error occurred'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleImport} className="flex-1">
                Try Again
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
