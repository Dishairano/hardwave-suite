import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, XCircle, Cloud, Upload, File } from 'lucide-react'
import { Button } from './Button'

interface CloudUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: () => void
}

interface UploadProgress {
  current: number
  total: number
  currentFile: {
    filename: string
    loaded: number
    total: number
    percent: number
    status: 'pending' | 'uploading' | 'complete' | 'error'
    error?: string
  } | null
  completed: any[]
  failed: { filename: string; error: string }[]
}

type UploadState = 'idle' | 'uploading' | 'complete' | 'error'

export function CloudUploadModal({ isOpen, onClose, onUploadComplete }: CloudUploadModalProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [storageInfo, setStorageInfo] = useState<{
    used_formatted: string
    quota_formatted: string
    usage_percent: number
  } | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setState('idle')
      setSelectedFiles([])
      setProgress(null)
    } else {
      // Fetch storage info when modal opens
      loadStorageInfo()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    // Listen for upload progress
    const unsubscribe = window.electron.cloud.onUploadProgress((prog) => {
      setProgress(prog)
      if (prog.current === prog.total && prog.currentFile === null) {
        if (prog.failed.length === 0) {
          setState('complete')
          onUploadComplete?.()
        } else if (prog.completed.length === 0) {
          setState('error')
        } else {
          setState('complete')
          onUploadComplete?.()
        }
      }
    })

    return unsubscribe
  }, [isOpen, onUploadComplete])

  const loadStorageInfo = async () => {
    try {
      const storage = await window.electron.cloud.getStorage()
      setStorageInfo({
        used_formatted: storage.used_formatted,
        quota_formatted: storage.quota_formatted,
        usage_percent: storage.usage_percent,
      })
    } catch (error) {
      console.error('Failed to load storage info:', error)
    }
  }

  const handleSelectFiles = async () => {
    const files = await window.electron.cloud.selectFilesForUpload()
    if (files && files.length > 0) {
      setSelectedFiles(files)
    }
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setState('uploading')
    setProgress({
      current: 0,
      total: selectedFiles.length,
      currentFile: null,
      completed: [],
      failed: [],
    })

    try {
      await window.electron.cloud.uploadFiles(selectedFiles)
    } catch (error) {
      console.error('Upload error:', error)
      setState('error')
    }
  }

  const getFilename = (path: string) => {
    return path.split(/[/\\]/).pop() || path
  }

  if (!isOpen) return null

  const totalProgress = progress
    ? (progress.current - 1 + (progress.currentFile?.percent || 0) / 100) / progress.total * 100
    : 0

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-bg-hover rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
            <Cloud className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Upload to Cloud</h2>
            <p className="text-sm text-text-tertiary">
              {storageInfo
                ? `${storageInfo.used_formatted} / ${storageInfo.quota_formatted} used`
                : 'Loading storage info...'}
            </p>
          </div>
        </div>

        {/* Idle State - File Selection */}
        {state === 'idle' && (
          <>
            {selectedFiles.length === 0 ? (
              <div
                onClick={handleSelectFiles}
                className="border-2 border-dashed border-bg-hover rounded-lg p-8 text-center cursor-pointer hover:border-accent-primary hover:bg-bg-hover/50 transition-colors mb-6"
              >
                <Upload className="mx-auto mb-3 text-text-tertiary" size={32} />
                <p className="text-text-secondary mb-1">Click to select audio files</p>
                <p className="text-xs text-text-tertiary">WAV, MP3, FLAC, OGG, AIFF supported</p>
              </div>
            ) : (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-text-secondary">
                    {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
                  </span>
                  <Button size="sm" variant="secondary" onClick={handleSelectFiles}>
                    Change
                  </Button>
                </div>
                <div className="bg-bg-tertiary rounded-lg max-h-48 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 border-b border-bg-hover last:border-b-0"
                    >
                      <File className="text-text-tertiary flex-shrink-0" size={16} />
                      <span className="text-sm text-text-secondary truncate">
                        {getFilename(file)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={selectedFiles.length === 0}
                className="flex-1"
              >
                Upload
              </Button>
            </div>
          </>
        )}

        {/* Uploading State */}
        {state === 'uploading' && progress && (
          <>
            <div className="mb-6">
              {/* Overall Progress Bar */}
              <div className="h-2 bg-bg-primary rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-text-secondary">
                  {progress.current} / {progress.total} files
                </span>
                <span className="text-text-tertiary">{Math.round(totalProgress)}%</span>
              </div>

              {/* Current File */}
              {progress.currentFile && (
                <div className="bg-bg-tertiary rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <Loader2 className="text-accent-primary animate-spin flex-shrink-0" size={18} />
                    <span className="text-sm text-text-secondary truncate">
                      {progress.currentFile.filename}
                    </span>
                  </div>
                  <div className="h-1 bg-bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-primary transition-all duration-100"
                      style={{ width: `${progress.currentFile.percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-text-tertiary text-center">
              Please wait while your files are uploading...
            </p>
          </>
        )}

        {/* Complete State */}
        {state === 'complete' && progress && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-accent-success/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-accent-success" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Upload Complete!</h3>
              <p className="text-sm text-text-secondary">
                {progress.completed.length} file{progress.completed.length !== 1 ? 's' : ''} uploaded
                successfully
              </p>
              {progress.failed.length > 0 && (
                <p className="text-sm text-accent-warning mt-1">
                  {progress.failed.length} file{progress.failed.length !== 1 ? 's' : ''} failed
                </p>
              )}
            </div>

            {/* Failed files list */}
            {progress.failed.length > 0 && (
              <div className="bg-accent-error/10 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                <p className="text-xs text-accent-error font-medium mb-2">Failed uploads:</p>
                {progress.failed.map((file, index) => (
                  <div key={index} className="text-xs text-text-secondary mb-1">
                    <span className="font-medium">{file.filename}:</span> {file.error}
                  </div>
                ))}
              </div>
            )}

            <Button variant="primary" onClick={onClose} className="w-full">
              Done
            </Button>
          </>
        )}

        {/* Error State */}
        {state === 'error' && progress && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-accent-error/20 flex items-center justify-center mx-auto mb-4">
                <XCircle className="text-accent-error" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Upload Failed</h3>
              <p className="text-sm text-text-secondary">
                All {progress.failed.length} files failed to upload
              </p>
            </div>

            {/* Failed files list */}
            <div className="bg-accent-error/10 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
              {progress.failed.map((file, index) => (
                <div key={index} className="text-xs text-text-secondary mb-1">
                  <span className="font-medium">{file.filename}:</span> {file.error}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setState('idle')
                  setProgress(null)
                }}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
