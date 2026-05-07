import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Settings, FolderOpen, RotateCcw, X, Lock, AlertTriangle, Sparkles, Check } from 'lucide-react'
import anime from 'animejs'
import * as api from '../lib/api'
import type { UserTheme, UserThemePatch } from '../lib/api'
import { normalizeHex } from '../lib/applyTheme'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  userTheme: UserTheme | null
  onThemeChange: (theme: UserTheme | null) => void
}

type TabId = 'paths' | 'appearance' | 'channel'

// Default Hardwave palette — also acts as the "fallback" when the backend
// hasn't returned a theme yet. Mirrors the `:root` defaults in index.css.
const DEFAULT_THEME: UserTheme = {
  primary: '#DC2626',
  accent: '#A855F7',
  glowStrength: 0.45,
  applyTo: { suite: true, plugins: true, splash: false },
}

interface Preset {
  name: string
  primary: string
  accent: string
}

// Same set as the mockup at /var/www/hardwave-app/theme-picker-mockup/. Order
// matters — Hardwave default first so users always see it as the "home" pick.
const PRESETS: Preset[] = [
  { name: 'Hardwave', primary: '#DC2626', accent: '#A855F7' },
  { name: 'Sunset',   primary: '#FB7185', accent: '#FBBF24' },
  { name: 'Ocean',    primary: '#06B6D4', accent: '#3B82F6' },
  { name: 'Mint',     primary: '#10B981', accent: '#84CC16' },
  { name: 'Amber',    primary: '#F59E0B', accent: '#EA580C' },
  { name: 'Violet',   primary: '#A855F7', accent: '#EC4899' },
  { name: 'Mono',     primary: '#FAFAFA', accent: '#666666' },
  { name: 'Heat',     primary: '#EF4444', accent: '#FDE047' },
]

export function SettingsPanel({ open, onClose, userTheme, onThemeChange }: SettingsPanelProps) {
  const [tab, setTab] = useState<TabId>('paths')
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [pathsLoading, setPathsLoading] = useState(true)

  const [channel, setChannel] = useState<api.UpdateChannel>('stable')
  const [autoAttachLogs, setAutoAttachLogs] = useState(true)
  const [subscription, setSubscription] = useState<api.SubscriptionInfo | null>(null)
  const [channelLoading, setChannelLoading] = useState(true)
  const [channelError, setChannelError] = useState<string | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const reloadPaths = useCallback(async () => {
    try {
      const next = await api.getInstallPaths()
      setPaths(next)
    } catch {
      // swallow — UI keeps last known good state
    }
  }, [])

  useEffect(() => {
    if (!open) return

    setPathsLoading(true)
    api.getInstallPaths()
      .then(setPaths)
      .catch(() => {})
      .finally(() => setPathsLoading(false))

    setChannelLoading(true)
    setChannelError(null)
    Promise.all([
      api.getUpdateChannel().catch(() => 'stable' as api.UpdateChannel),
      api.getAutoAttachCrashLogs().catch(() => true),
      api.getSubscriptionInfo().catch((e: unknown) => {
        const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
        setChannelError(msg)
        return null
      }),
    ])
      .then(([ch, aacl, sub]) => {
        setChannel(ch)
        setAutoAttachLogs(aacl)
        setSubscription(sub)
      })
      .finally(() => setChannelLoading(false))

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

  const handleToggleBeta = async () => {
    const next: api.UpdateChannel = channel === 'beta' ? 'stable' : 'beta'
    setChannel(next)
    try {
      await api.setUpdateChannel(next)
    } catch (e) {
      setChannel(channel)
      setChannelError(typeof e === 'string' ? e : e instanceof Error ? e.message : String(e))
    }
  }

  const handleToggleAutoAttach = async () => {
    const next = !autoAttachLogs
    setAutoAttachLogs(next)
    try {
      await api.setAutoAttachCrashLogs(next)
    } catch (e) {
      setAutoAttachLogs(autoAttachLogs)
      setChannelError(typeof e === 'string' ? e : e instanceof Error ? e.message : String(e))
    }
  }

  const handleSubscribe = async () => {
    try {
      await api.openExternalUrl('https://hardwavestudios.com/pricing')
    } catch {
      window.open('https://hardwavestudios.com/pricing', '_blank')
    }
  }

  if (!open) return null

  const betaEligible = subscription?.betaEligible ?? false

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
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-white/[0.04] flex-shrink-0" role="tablist">
          <TabButton id="paths" active={tab === 'paths'} onClick={() => setTab('paths')}>
            Install paths
          </TabButton>
          <TabButton id="appearance" active={tab === 'appearance'} onClick={() => setTab('appearance')}>
            Appearance
          </TabButton>
          <TabButton id="channel" active={tab === 'channel'} onClick={() => setTab('channel')}>
            Update channel
          </TabButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {tab === 'paths' && (
            <PathsTab
              paths={paths}
              loading={pathsLoading}
              onBrowse={handleBrowse}
              onReset={handleReset}
              reloadPaths={reloadPaths}
            />
          )}
          {tab === 'appearance' && (
            <AppearanceTab
              userTheme={userTheme}
              onThemeChange={onThemeChange}
            />
          )}
          {tab === 'channel' && (
            <ChannelTab
              loading={channelLoading}
              error={channelError}
              channel={channel}
              betaEligible={betaEligible}
              autoAttachLogs={autoAttachLogs}
              onToggleBeta={handleToggleBeta}
              onToggleAutoAttach={handleToggleAutoAttach}
              onSubscribe={handleSubscribe}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  id,
  active,
  onClick,
  children,
}: {
  id: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      aria-controls={`tabpanel-${id}`}
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium rounded-md transition-all ${
        active
          ? 'text-white bg-white/[0.06]'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
      }`}
    >
      {children}
    </button>
  )
}

function PathsTab({
  paths,
  loading,
  onBrowse,
  onReset,
  reloadPaths,
}: {
  paths: Record<string, string>
  loading: boolean
  onBrowse: (key: string, title: string) => Promise<void>
  onReset: (key: string) => Promise<void>
  reloadPaths: () => Promise<void>
}) {
  // Probe once per panel open. `null` = still probing, false = locked,
  // true = ACL grant succeeded (or non-Windows where UAC doesn't apply).
  const [systemWritable, setSystemWritable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    api.probeSystemVst3Writable()
      .then((ok) => { if (!cancelled) setSystemWritable(ok) })
      .catch(() => { if (!cancelled) setSystemWritable(false) })
    return () => { cancelled = true }
  }, [])

  // The toggle reads "system" iff the configured vst3 path matches the
  // OS-canonical system path. Otherwise the user is on per-user (default)
  // or a custom override (still treated as "user" for the purpose of the
  // toggle — they can browse/reset separately below).
  const scope: 'user' | 'system' =
    paths.vst3 && paths.vst3_system && paths.vst3 === paths.vst3_system
      ? 'system'
      : 'user'

  const handleScopeChange = async (next: 'user' | 'system') => {
    if (next === 'system') {
      // Point the existing vst3_path setting at the system folder. All
      // downstream install logic (vst3_dir(), download_and_install) just
      // reads that setting — no other code paths need to change.
      const target = paths.vst3_system || ''
      if (!target) return
      await api.setInstallPath('vst3', target)
    } else {
      // Empty string clears the override; vst3_dir() falls back to the
      // per-user default in default_vst3_dir().
      await api.setInstallPath('vst3', '')
    }
    await reloadPaths()
  }

  const handleOpenInstaller = async () => {
    const url = 'https://hardwavestudios.com/suite'
    try {
      await api.openExternalUrl(url)
    } catch {
      window.open(url, '_blank')
    }
  }

  return (
    <div role="tabpanel" id="tabpanel-paths">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">Install Locations</h3>
      {loading ? (
        <div className="text-sm text-zinc-500">Loading...</div>
      ) : (
        <div className="space-y-5">
          <InstallScopeToggle
            scope={scope}
            systemPath={paths.vst3_system || ''}
            systemWritable={systemWritable}
            onChange={handleScopeChange}
            onOpenInstaller={handleOpenInstaller}
          />
          <PathSetting
            label="VST3 / CLAP Plugins"
            path={paths.vst3 || ''}
            defaultPath={paths.vst3_default || ''}
            isDefault={!paths.vst3 || paths.vst3 === paths.vst3_default}
            onBrowse={() => onBrowse('vst3', 'Select VST3 install folder')}
            onReset={() => onReset('vst3')}
          />
          <PathSetting
            label="Sample Packs"
            path={paths.sample || ''}
            defaultPath={paths.sample_default || ''}
            isDefault={!paths.sample || paths.sample === paths.sample_default}
            onBrowse={() => onBrowse('sample', 'Select sample packs folder')}
            onReset={() => onReset('sample')}
          />
        </div>
      )}
      <p className="text-[11px] text-zinc-600 mt-6 leading-relaxed">
        Changes apply to future installs. Already installed plugins stay in their current location.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// InstallScopeToggle — Per-user / System radio for VST3 install path.
// Surfaces the v0.18 installer's UAC ACL grant: when the system folder
// is writable (icacls Modify granted), users can opt into installing to
// C:\Program Files\Common Files\VST3 with no further UAC prompts.
// ─────────────────────────────────────────────────────────────────

function InstallScopeToggle({
  scope,
  systemPath,
  systemWritable,
  onChange,
  onOpenInstaller,
}: {
  scope: 'user' | 'system'
  systemPath: string
  systemWritable: boolean | null
  onChange: (next: 'user' | 'system') => Promise<void> | void
  onOpenInstaller: () => void
}) {
  // Only block the System option when we're certain it's not writable.
  // While probing (`null`) we leave the option enabled to avoid a brief
  // flash of the locked state on first open.
  const systemLocked = systemWritable === false

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">
        Install scope
      </div>
      <div className="space-y-3">
        <ScopeOption
          checked={scope === 'user'}
          disabled={false}
          title="Per-user (recommended for solo studios)"
          subtitle="Plug-ins install to your personal Common Files folder. Visible only to your Windows account. No UAC ever."
          onSelect={() => { void onChange('user') }}
        />
        <ScopeOption
          checked={scope === 'system'}
          disabled={systemLocked}
          title="System (all users on this machine)"
          subtitle={
            systemLocked
              ? 'Re-run the installer to grant system-folder access (one-time UAC prompt).'
              : `Plug-ins install to ${systemPath || 'the system folder'}. Available to every account on this machine.`
          }
          onSelect={() => { if (!systemLocked) void onChange('system') }}
        />
      </div>
      {systemLocked && (
        <button
          type="button"
          onClick={onOpenInstaller}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Open installer
        </button>
      )}
    </div>
  )
}

function ScopeOption({
  checked,
  disabled,
  title,
  subtitle,
  onSelect,
}: {
  checked: boolean
  disabled: boolean
  title: string
  subtitle: string
  onSelect: () => void
}) {
  return (
    <label
      className={`flex gap-3 items-start cursor-pointer rounded-md p-2 -m-2 transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:bg-white/[0.03]'
      }`}
    >
      <input
        type="radio"
        name="install-scope"
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 accent-red-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium leading-tight">{title}</div>
        <div className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{subtitle}</div>
      </div>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────
// AppearanceTab — per-user theme picker
// ─────────────────────────────────────────────────────────────────

function AppearanceTab({
  userTheme,
  onThemeChange,
}: {
  userTheme: UserTheme | null
  onThemeChange: (theme: UserTheme | null) => void
}) {
  // Local working copy — we don't fire the API on every keystroke. The user
  // either clicks "Save theme" (commit), "Reset" (DELETE on backend), or
  // closes the panel without saving (we revert on next open via prop).
  const initial = useMemo<UserTheme>(() => userTheme ?? DEFAULT_THEME, [userTheme])
  const [draft, setDraft] = useState<UserTheme>(initial)
  const [primaryInput, setPrimaryInput] = useState(initial.primary)
  const [accentInput, setAccentInput] = useState(initial.accent)
  const [glowInput, setGlowInput] = useState(initial.glowStrength.toFixed(2))
  const [primaryError, setPrimaryError] = useState<string | null>(null)
  const [accentError, setAccentError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Re-sync the draft if the parent's userTheme changes (e.g. after a fresh
  // fetch when the panel re-opens). We deliberately key on JSON so reopening
  // the panel with the same theme doesn't clobber the user's in-progress edit.
  const themeKey = JSON.stringify(userTheme)
  useEffect(() => {
    setDraft(initial)
    setPrimaryInput(initial.primary)
    setAccentInput(initial.accent)
    setGlowInput(initial.glowStrength.toFixed(2))
    setPrimaryError(null)
    setAccentError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey])

  const dirty = useMemo(() => {
    if (!userTheme) {
      // No theme on backend yet — anything different from the default counts.
      return JSON.stringify(draft) !== JSON.stringify(DEFAULT_THEME)
    }
    return JSON.stringify(draft) !== JSON.stringify(userTheme)
  }, [draft, userTheme])

  const updateDraft = useCallback((patch: Partial<UserTheme>) => {
    setDraft((d) => ({ ...d, ...patch }))
  }, [])

  const updateApplyTo = useCallback((key: keyof UserTheme['applyTo'], value: boolean) => {
    setDraft((d) => ({ ...d, applyTo: { ...d.applyTo, [key]: value } }))
  }, [])

  const handlePrimaryCommit = (raw: string) => {
    const normalized = normalizeHex(raw)
    if (!normalized) {
      setPrimaryError('Use a 3- or 6-digit HEX')
      return
    }
    setPrimaryError(null)
    setPrimaryInput(normalized)
    updateDraft({ primary: normalized })
  }

  const handleAccentCommit = (raw: string) => {
    const normalized = normalizeHex(raw)
    if (!normalized) {
      setAccentError('Use a 3- or 6-digit HEX')
      return
    }
    setAccentError(null)
    setAccentInput(normalized)
    updateDraft({ accent: normalized })
  }

  const handleGlowCommit = (raw: string) => {
    const v = Number(raw)
    if (Number.isNaN(v)) return
    const clamped = Math.max(0, Math.min(1, v))
    setGlowInput(clamped.toFixed(2))
    updateDraft({ glowStrength: clamped })
  }

  const handlePresetClick = (preset: Preset) => {
    setPrimaryInput(preset.primary)
    setAccentInput(preset.accent)
    setPrimaryError(null)
    setAccentError(null)
    updateDraft({ primary: preset.primary, accent: preset.accent })
  }

  const handleSave = async () => {
    if (primaryError || accentError) return
    const patch: UserThemePatch = {
      primary: draft.primary,
      accent: draft.accent,
      glowStrength: draft.glowStrength,
      applyTo: draft.applyTo,
    }
    setSaving(true)
    setSaveError(null)
    try {
      const saved = await api.setUserTheme(patch)
      onThemeChange(saved)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const reset = await api.resetUserTheme()
      onThemeChange(reset)
    } catch (e) {
      // Backend missing or DELETE failed — fall back to the bundled default
      // and clear local state so the UI still shows the Hardwave palette.
      onThemeChange(null)
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const activePresetName = useMemo(() => {
    return PRESETS.find(
      (p) => p.primary.toUpperCase() === draft.primary.toUpperCase()
        && p.accent.toUpperCase() === draft.accent.toUpperCase(),
    )?.name ?? null
  }, [draft.primary, draft.accent])

  return (
    <div role="tabpanel" id="tabpanel-appearance" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Appearance</h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Make Hardwave look the way you want it. The colours you pick here apply across every plug-in webview, not just the Suite.
        </p>
      </div>

      {/* Custom colours */}
      <SettingCard>
        <div className="mb-3">
          <div className="text-sm font-semibold text-white mb-1">Custom colours</div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Pick any HEX value for the primary and accent colours. Surfaces stay dark — we don't ship a light mode (yet).
          </p>
        </div>

        <ColorRow
          label="Primary"
          color={draft.primary}
          textValue={primaryInput}
          error={primaryError}
          onTextChange={setPrimaryInput}
          onCommit={handlePrimaryCommit}
          onPickerChange={(hex) => {
            setPrimaryInput(hex.toUpperCase())
            setPrimaryError(null)
            updateDraft({ primary: hex.toUpperCase() })
          }}
          onUseDefault={() => {
            setPrimaryInput(DEFAULT_THEME.primary)
            setPrimaryError(null)
            updateDraft({ primary: DEFAULT_THEME.primary })
          }}
        />

        <ColorRow
          label="Accent"
          color={draft.accent}
          textValue={accentInput}
          error={accentError}
          onTextChange={setAccentInput}
          onCommit={handleAccentCommit}
          onPickerChange={(hex) => {
            setAccentInput(hex.toUpperCase())
            setAccentError(null)
            updateDraft({ accent: hex.toUpperCase() })
          }}
          onUseDefault={() => {
            setAccentInput(DEFAULT_THEME.accent)
            setAccentError(null)
            updateDraft({ accent: DEFAULT_THEME.accent })
          }}
        />

        <GlowRow
          glow={draft.glowStrength}
          textValue={glowInput}
          color={draft.primary}
          onTextChange={setGlowInput}
          onCommit={handleGlowCommit}
          onUseDefault={() => {
            setGlowInput(DEFAULT_THEME.glowStrength.toFixed(2))
            updateDraft({ glowStrength: DEFAULT_THEME.glowStrength })
          }}
        />
      </SettingCard>

      {/* Quick presets */}
      <SettingCard>
        <div className="mb-3">
          <div className="text-sm font-semibold text-white mb-1">Quick presets</div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Jump-off points if you don't want to start from scratch. Click one, then fine-tune above.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <PresetTile
              key={p.name}
              preset={p}
              active={p.name === activePresetName}
              onClick={() => handlePresetClick(p)}
            />
          ))}
        </div>
      </SettingCard>

      {/* Where it applies */}
      <SettingCard>
        <div className="mb-3">
          <div className="text-sm font-semibold text-white mb-1">Where it applies</div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Toggle which surfaces use your custom palette. Defaults: Suite + plug-ins on, splash off.
          </p>
        </div>
        <ApplyToggleRow
          label="Suite UI"
          help="Sidebar accent, buttons, cards, badges in this window."
          on={draft.applyTo.suite}
          onClick={() => updateApplyTo('suite', !draft.applyTo.suite)}
        />
        <ApplyToggleRow
          label="Plug-in webviews"
          help="Analyser spectrum, LoudLab meters, KickForge — every plug-in inherits via /api/user/theme on load."
          on={draft.applyTo.plugins}
          onClick={() => updateApplyTo('plugins', !draft.applyTo.plugins)}
        />
        <ApplyToggleRow
          label="Splash + login screens"
          help="First-paint screens before your account is loaded. Off = always uses the Hardwave default red."
          on={draft.applyTo.splash}
          onClick={() => updateApplyTo('splash', !draft.applyTo.splash)}
        />
      </SettingCard>

      {/* Live preview */}
      <SettingCard>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-white">Live preview</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.10em] text-zinc-500">
            Same data, your colours
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <PreviewCard primary={draft.primary} accent={draft.accent} pill="UPDATE" status="update" />
          <PreviewCard primary={draft.accent} accent={draft.primary} pill="INSTALLED" status="ok" />
        </div>
      </SettingCard>

      {/* Sync note */}
      <div className="flex gap-2.5 px-3 py-2.5 rounded-lg bg-violet-500/[0.06] border border-violet-500/20">
        <div className="text-violet-300 mt-0.5 flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <p className="text-[11.5px] text-zinc-300 leading-relaxed">
          <strong className="text-violet-300 font-semibold">Your theme syncs across machines.</strong>{' '}
          Pick once on your laptop, sign in on the studio PC — the same colours load. Plug-in webviews fetch the theme on auth, so a fresh install of Analyser already comes up in your colours.
        </p>
      </div>

      {/* Save error surface */}
      {saveError && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{saveError}</span>
        </div>
      )}

      {/* Action row */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={saving}
          className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-zinc-300 hover:text-white transition-all disabled:opacity-50"
        >
          Reset to Hardwave default
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty || !!primaryError || !!accentError}
          className="px-3 py-2 rounded-lg bg-[var(--brand)] hover:bg-[var(--brand-hover)] border border-[var(--brand)] text-xs text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {savedFlash ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Saved
            </>
          ) : saving ? (
            'Saving…'
          ) : (
            'Save theme'
          )}
        </button>
      </div>
    </div>
  )
}

function ColorRow({
  label,
  color,
  textValue,
  error,
  onTextChange,
  onCommit,
  onPickerChange,
  onUseDefault,
}: {
  label: string
  color: string
  textValue: string
  error: string | null
  onTextChange: (v: string) => void
  onCommit: (v: string) => void
  onPickerChange: (hex: string) => void
  onUseDefault: () => void
}) {
  return (
    <div className="grid grid-cols-[88px_44px_1fr_auto] gap-2.5 items-center py-2 border-b border-dashed border-white/[0.05] last:border-b-0">
      <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-zinc-500">
        {label}
      </div>
      <label className="block w-11 h-11 rounded-lg border border-white/[0.10] cursor-pointer relative overflow-hidden" style={{ background: color }}>
        <input
          type="color"
          value={color.toLowerCase()}
          onChange={(e) => onPickerChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label={`${label} colour picker`}
        />
      </label>
      <div className="flex flex-col gap-1 min-w-0">
        <input
          type="text"
          value={textValue}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit((e.target as HTMLInputElement).value) }}
          className={`font-mono text-xs px-2.5 py-2 bg-[var(--bg)] border rounded-md text-white outline-none transition-colors ${
            error ? 'border-red-500/60 focus:border-red-500' : 'border-white/[0.09] focus:border-[var(--brand)]'
          }`}
          spellCheck={false}
        />
        {error && (
          <span className="text-[10px] text-red-400">{error}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onUseDefault}
        className="px-2.5 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.09] text-[11px] text-zinc-400 hover:text-white whitespace-nowrap transition-colors"
      >
        Use default
      </button>
    </div>
  )
}

function GlowRow({
  glow,
  textValue,
  color,
  onTextChange,
  onCommit,
  onUseDefault,
}: {
  glow: number
  textValue: string
  color: string
  onTextChange: (v: string) => void
  onCommit: (v: string) => void
  onUseDefault: () => void
}) {
  // Render the glow swatch using the current primary colour with the chosen
  // alpha — gives an immediate visual sense of how strong the bloom is.
  const swatchBg = useMemo(() => {
    const cleaned = color.replace('#', '')
    const expanded = cleaned.length === 3
      ? cleaned.split('').map((c) => c + c).join('')
      : cleaned
    if (expanded.length !== 6) return color
    const m = expanded.match(/.{2}/g)!
    const [r, g, b] = m.map((s) => parseInt(s, 16))
    return `rgba(${r}, ${g}, ${b}, ${glow})`
  }, [color, glow])

  return (
    <div className="grid grid-cols-[88px_44px_1fr_auto] gap-2.5 items-center py-2 border-b border-dashed border-white/[0.05] last:border-b-0">
      <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-zinc-500">
        Glow strength
      </div>
      <div className="w-11 h-11 rounded-lg border border-white/[0.10]" style={{ background: swatchBg }} />
      <input
        type="text"
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onCommit((e.target as HTMLInputElement).value) }}
        className="font-mono text-xs px-2.5 py-2 bg-[var(--bg)] border border-white/[0.09] rounded-md text-white outline-none focus:border-[var(--brand)] transition-colors"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={onUseDefault}
        className="px-2.5 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.09] text-[11px] text-zinc-400 hover:text-white whitespace-nowrap transition-colors"
      >
        Use default
      </button>
    </div>
  )
}

function PresetTile({ preset, active, onClick }: { preset: Preset; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded-md border bg-white/[0.02] hover:bg-white/[0.04] transition-all ${
        active
          ? 'border-[var(--brand)] ring-1 ring-[var(--brand)]/40'
          : 'border-white/[0.09] hover:border-white/[0.20]'
      }`}
      aria-pressed={active}
      aria-label={`Apply preset ${preset.name}`}
    >
      <div className="flex gap-1 mb-1.5">
        <div className="flex-1 h-5 rounded" style={{ background: preset.primary }} />
        <div className="flex-1 h-5 rounded" style={{ background: preset.accent }} />
      </div>
      <div className="font-mono text-[9px] tracking-[0.10em] uppercase text-zinc-300 text-center">
        {preset.name}
      </div>
    </button>
  )
}

function ApplyToggleRow({
  label,
  help,
  on,
  onClick,
}: {
  label: string
  help: string
  on: boolean
  onClick: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-dashed border-white/[0.05] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] text-white font-medium">{label}</div>
        <div className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{help}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Toggle ${label}`}
        onClick={onClick}
        className={`relative w-[40px] h-[22px] rounded-full border transition-colors flex-shrink-0 ${
          on
            ? 'bg-[var(--brand)]/[0.30] border-[var(--brand)]/[0.50]'
            : 'bg-[#1c1c22] border-white/[0.12]'
        }`}
      >
        <span
          className={`absolute top-[2px] w-[16px] h-[16px] rounded-full transition-all ${
            on ? 'left-[20px] bg-[var(--brand-hover)]' : 'left-[2px] bg-zinc-500'
          }`}
        />
      </button>
    </div>
  )
}

function PreviewCard({
  primary,
  accent,
  pill,
  status,
}: {
  primary: string
  accent: string
  pill: string
  status: 'update' | 'ok'
}) {
  return (
    <div className="rounded-lg border border-white/[0.09] overflow-hidden bg-gradient-to-b from-white/[0.02] to-transparent">
      <div
        className="h-12 relative"
        style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}
      >
        <span className="absolute top-1 right-1 font-mono text-[8px] font-bold tracking-[0.10em] px-1.5 py-0.5 rounded-full bg-black/50 text-white">
          {pill}
        </span>
      </div>
      <div className="p-2.5">
        <div className="font-mono text-[8.5px] tracking-[0.10em] uppercase text-zinc-500 mb-0.5">
          Spectrum analyser
        </div>
        <div className="font-bold text-[11px] text-white mb-1.5">
          Hardwave <span style={{ color: primary }}>Analyser</span>
        </div>
        <button
          type="button"
          className="text-[10px] font-medium px-2 py-1 rounded text-white"
          style={{ background: primary, borderColor: primary }}
        >
          {status === 'update' ? 'Update' : 'Up to date'}
        </button>
      </div>
    </div>
  )
}

function ChannelTab({
  loading,
  error,
  channel,
  betaEligible,
  autoAttachLogs,
  onToggleBeta,
  onToggleAutoAttach,
  onSubscribe,
}: {
  loading: boolean
  error: string | null
  channel: api.UpdateChannel
  betaEligible: boolean
  autoAttachLogs: boolean
  onToggleBeta: () => void
  onToggleAutoAttach: () => void
  onSubscribe: () => void
}) {
  return (
    <div role="tabpanel" id="tabpanel-channel" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Update channel</h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Choose which builds the Suite installs. Beta builds are unstable by definition and should never be used for a paid client session.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading channel info...</div>
      ) : (
        <>
          {/* Stable channel — always on */}
          <SettingCard>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white mb-1">Stable channel</div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Production-ready releases. This is what every Hardwave user gets by default. Auto-updated, fully tested.
                </p>
              </div>
              <Toggle on={true} disabled={true} accent="green" ariaLabel="Stable channel always on" />
            </div>
          </SettingCard>

          {/* Beta channel — gated by subscription */}
          <SettingCard tinted={betaEligible}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-white">Beta channel</span>
                  <BetaPill text={betaEligible ? 'PRO' : 'LOCKED · PRO'} locked={!betaEligible} />
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Pre-release builds of upcoming plug-ins. Available to Hardwave Pro subscribers. Installs to a separate folder so your stable plug-ins are untouched. New builds drop every 2–3 weeks.
                </p>
              </div>
              {betaEligible ? (
                <Toggle
                  on={channel === 'beta'}
                  onClick={onToggleBeta}
                  accent="beta"
                  ariaLabel="Toggle beta channel"
                />
              ) : (
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Toggle on={false} disabled={true} accent="beta" ariaLabel="Beta channel locked" />
                  <Lock className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
                </div>
              )}
            </div>

            {betaEligible && channel === 'beta' && (
              <div className="mt-3 flex gap-3 px-3 py-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/30">
                <div className="w-4 h-4 rounded-full bg-amber-500 text-black text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  !
                </div>
                <p className="text-[11.5px] text-zinc-300 leading-relaxed">
                  <strong className="text-amber-400">Beta builds may crash.</strong> Don't load these in a paid session. Bug reports go to <code className="font-mono text-[11px] text-amber-300/90">#beta-testers</code> on Discord — crash logs auto-attached.
                </p>
              </div>
            )}

            {!betaEligible && (
              <div className="mt-3 flex flex-col gap-2">
                <p className="text-[11.5px] text-zinc-500 leading-relaxed">
                  Subscribe to Hardwave Pro for early access to upcoming plug-ins before public launch.
                </p>
                <button
                  onClick={onSubscribe}
                  className="self-start flex items-center gap-1.5 px-3 py-2 rounded-lg border border-beta/40 hover:border-beta hover:bg-beta/10 text-beta text-xs font-semibold transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Subscribe to Pro
                </button>
              </div>
            )}
          </SettingCard>

          {/* Auto-attach crash logs */}
          <SettingCard>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white mb-1">Auto-attach crash logs</div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  When a beta build crashes, Suite zips the log and DAW host info and offers to attach it to a Discord post in one click.
                </p>
              </div>
              <Toggle
                on={autoAttachLogs}
                onClick={onToggleAutoAttach}
                accent="beta"
                ariaLabel="Toggle auto-attach crash logs"
              />
            </div>
          </SettingCard>
        </>
      )}
    </div>
  )
}

function SettingCard({
  children,
  tinted,
}: {
  children: React.ReactNode
  tinted?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tinted
          ? 'bg-gradient-to-b from-beta/[0.06] to-white/[0.02] border-beta/30'
          : 'bg-white/[0.02] border-white/[0.06]'
      }`}
    >
      {children}
    </div>
  )
}

function Toggle({
  on,
  onClick,
  disabled,
  accent,
  ariaLabel,
}: {
  on: boolean
  onClick?: () => void
  disabled?: boolean
  accent: 'green' | 'beta'
  ariaLabel: string
}) {
  const onColor = accent === 'green' ? 'bg-emerald-500 border-emerald-500' : 'bg-beta border-beta'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`relative w-[46px] h-[26px] rounded-full border transition-colors flex-shrink-0 ${
        on ? onColor : 'bg-[#1c1c22] border-white/[0.12]'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
    >
      <span
        className={`absolute top-[2px] w-[20px] h-[20px] rounded-full bg-white transition-all ${
          on ? 'left-[22px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}

function BetaPill({ text, locked }: { text: string; locked?: boolean }) {
  return (
    <span
      className={`text-[9.5px] font-bold tracking-[1.5px] uppercase font-mono px-1.5 py-0.5 rounded border ${
        locked
          ? 'text-zinc-500 bg-white/[0.04] border-white/[0.12]'
          : 'text-beta bg-beta/10 border-beta/40'
      }`}
    >
      {text}
    </span>
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
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 transition-colors"
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
