import { AlertTriangle, X } from 'lucide-react'
import * as api from '../lib/api'

interface CrashReportModalProps {
  report: api.CrashReport
  onDone: () => void
}

// The plug-in reports its own crashes to Hardwave as they happen (message,
// version, OS and stack, no project data), so this notice only tells the user
// what happened and where the full log is. It used to upload the log to the
// company document archive with a key built into the app; a desktop app
// cannot keep a key secret, so that upload is gone.
export function CrashReportModal({ report, onDone }: CrashReportModalProps) {
  const pluginName = report.plugin.charAt(0).toUpperCase() + report.plugin.slice(1)

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
            The {pluginName} plug-in crashed during your last session. It reported the crash to us
            by itself, so you do not need to send anything.
          </p>
          <p className="text-[10px] text-zinc-600 mb-4 break-all">
            If it keeps happening, write to support@hardwavestudios.com. The full log is at {report.logPath}
          </p>

          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-zinc-300 text-xs font-semibold rounded-lg transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
