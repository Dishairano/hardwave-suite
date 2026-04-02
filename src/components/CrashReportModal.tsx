import { useState } from 'react'
import { AlertTriangle, Upload, X, Loader2, CheckCircle } from 'lucide-react'
import * as api from '../lib/api'

interface CrashReportModalProps {
  report: api.CrashReport
  onDone: () => void
}

export function CrashReportModal({ report, onDone }: CrashReportModalProps) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pluginName = report.plugin.charAt(0).toUpperCase() + report.plugin.slice(1)

  const handleUpload = async () => {
    setUploading(true)
    setError(null)
    try {
      await api.uploadCrashReport()
      setUploaded(true)
      setTimeout(onDone, 1500)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDismiss = async () => {
    await api.dismissCrashReport().catch(() => {})
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[380px] bg-[#111315] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Crash Detected</h3>
            <p className="text-[11px] text-zinc-500">Hardwave {pluginName} v{report.version}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-400 leading-relaxed mb-4">
            It looks like the {pluginName} plugin crashed during your last session.
            Sending the crash report helps us fix the issue faster.
          </p>
          <p className="text-[10px] text-zinc-600 mb-4">
            The report contains technical details about the crash (stack trace, plugin version, OS).
            No personal data or project files are included.
          </p>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-red-500/[0.08] border border-red-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-red-300">{error}</span>
            </div>
          )}

          {uploaded ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">Report sent. Thank you!</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-700 to-red-500 hover:from-red-600 hover:to-red-400 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Sending...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" />Send Crash Report</>
                )}
              </button>
              <button
                onClick={handleDismiss}
                disabled={uploading}
                className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-400 text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
