import { useState, useEffect, useRef } from 'react'
import { Settings, FolderOpen, RotateCcw, X } from 'lucide-react'
import anime from 'animejs'
import * as api from '../lib/api'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setLoading(true)
      api.getInstallPaths()
        .then(setPaths)
        .catch(() => {})
        .finally(() => setLoading(false))

      // Animate in
      anime({
        targets: backdropRef.current,
        opacity: [0, 1],
        duration: 200,
        easing: 'easeOutCubic',
      })
      anime({
        targets: panelRef.current,
        translateX: ['100%', '0%'],
        duration: 300,
        easing: 'easeOutCubic',
      })
    }
  }, [open])

  const handleClose = () => {
    anime({
      targets: backdropRef.current,
      opacity: [1, 0],
      duration: 200,
      easing: 'easeInCubic',
    })
    anime({
      targets: panelRef.current,
      translateX: ['0%', '100%'],
      duration: 250,
      easing: 'easeInCubic',
      complete: onClose,
    })
  }

  const handleBrowse = async (key: string, title: string) => {
    const selected = await api.pickFolder(title)
    if (selected) {
      await api.setInstallPath(key, selected)
      setPaths(prev => ({ ...prev, [key]: selected }))
    }
  }

  const handleReset = async (key: string) => {
    await api.setInstallPath(key, '')
    const defaultKey = `${key}_default`
    setPaths(prev => ({ ...prev, [key]: prev[defaultKey] || '' }))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40">
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0"
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0c0c12] border-l border-white/[0.06] flex flex-col translate-x-full"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.06] flex-shrink-0">
          <Settings className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-semibold text-white flex-1">Settings</span>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Install Locations</h3>

          {loading ? (
            <div className="text-sm text-zinc-500">Loading...</div>
          ) : (
            <div className="space-y-5">
              <PathSetting
                label="VST3 / CLAP Plugins"
                path={paths.vst3 || ''}
                defaultPath={paths.vst3_default || ''}
                isDefault={!paths.vst3 || paths.vst3 === paths.vst3_default}
                onBrowse={() => handleBrowse('vst3', 'Select VST3 install folder')}
                onReset={() => handleReset('vst3')}
              />
              <PathSetting
                label="Sample Packs"
                path={paths.sample || ''}
                defaultPath={paths.sample_default || ''}
                isDefault={!paths.sample || paths.sample === paths.sample_default}
                onBrowse={() => handleBrowse('sample', 'Select sample packs folder')}
                onReset={() => handleReset('sample')}
              />
            </div>
          )}

          <p className="text-[11px] text-zinc-600 mt-6 leading-relaxed">
            Changes apply to future installs. Already installed plugins stay in their current location.
          </p>
        </div>
      </div>
    </div>
  )
}

function PathSetting({ label, path, defaultPath, isDefault, onBrowse, onReset }: {
  label: string
  path: string
  defaultPath: string
  isDefault: boolean
  onBrowse: () => void
  onReset: () => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white font-medium">{label}</span>
        {!isDefault && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-orange-400 transition-colors"
            title={`Reset to ${defaultPath}`}
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-zinc-400 truncate font-mono">
          {path}
        </div>
        <button
          onClick={onBrowse}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-xs text-zinc-300 hover:text-white transition-all flex-shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Browse
        </button>
      </div>
      {isDefault && (
        <span className="text-[10px] text-zinc-600 mt-1 block">Default location</span>
      )}
    </div>
  )
}
