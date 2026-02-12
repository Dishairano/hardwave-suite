import { useState, useEffect } from 'react'
import { Share2, Copy, ExternalLink, Check, X, Loader2 } from 'lucide-react'
import { Button } from './Button'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
  file: {
    id: number
    original_filename: string
    share_token?: string
    is_public?: boolean
  } | null
}

export function ShareDialog({ isOpen, onClose, file }: ShareDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !file) {
      setShareUrl(null)
      setCopied(false)
      setError(null)
      return
    }

    // If file already has a share token, construct the URL
    if (file.share_token) {
      setShareUrl(`https://hardwavestudios.com/share/${file.share_token}`)
    }
  }, [isOpen, file])

  const handleCreateShare = async () => {
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electron.cloud.shareFile(file.id)
      setShareUrl(result.share_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return

    try {
      await window.electron.cloud.copyShareLink(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleOpenLink = async () => {
    if (!shareUrl) return

    try {
      await window.electron.cloud.openShareLink(shareUrl)
    } catch (err) {
      console.error('Failed to open link:', err)
    }
  }

  const handleRevokeShare = async () => {
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      await window.electron.cloud.revokeShare(file.id)
      setShareUrl(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share link')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !file) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-bg-secondary border border-bg-hover rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <Share2 className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Share File</h2>
              <p className="text-xs text-text-tertiary truncate max-w-[200px]">
                {file.original_filename}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {shareUrl ? (
          <>
            <div className="bg-bg-tertiary rounded-lg p-3 mb-4">
              <label className="text-xs text-text-tertiary block mb-1">Share link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-sm text-text-primary outline-none truncate"
                />
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <Button
                variant="secondary"
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check size={16} className="text-accent-success" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={handleOpenLink}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} />
                Open
              </Button>
            </div>

            <div className="border-t border-bg-hover pt-4">
              <Button
                variant="danger"
                onClick={handleRevokeShare}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin mr-2" size={16} />
                ) : null}
                Revoke Share Link
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-bg-tertiary rounded-lg p-4 mb-4">
              <p className="text-sm text-text-secondary mb-2">
                Create a public link to share this file with anyone.
              </p>
              <ul className="text-xs text-text-tertiary space-y-1">
                <li>Anyone with the link can download this file</li>
                <li>You can revoke access at any time</li>
                <li>Download count is tracked</li>
              </ul>
            </div>

            {error && (
              <div className="bg-accent-error/10 text-accent-error text-sm rounded-lg p-3 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateShare}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Share2 size={16} />
                )}
                Create Link
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
