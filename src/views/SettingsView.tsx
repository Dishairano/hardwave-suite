import { useState } from 'react'
import { Button } from '../components/Button'

interface SettingsViewProps {
  user: {
    email: string
    displayName: string | null
  } | null
  onLogout: () => void
  onCheckUpdates: () => void
}

export function SettingsView({ user, onLogout, onCheckUpdates }: SettingsViewProps) {
  const [audioOutput, setAudioOutput] = useState('default')
  const [sampleRate, setSampleRate] = useState('44100')
  const [theme, setTheme] = useState('dark')
  const [autoUpdate, setAutoUpdate] = useState(true)
  const [scanOnStartup, setScanOnStartup] = useState(false)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="p-6 border-b border-bg-hover">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Settings</h1>
        <p className="text-text-secondary">Configure your Hardwave Studios experience</p>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Account */}
          <Section title="Account">
            <div className="flex items-center justify-between p-4 bg-bg-primary rounded-lg border border-bg-hover">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center text-white text-lg font-bold">
                  {user?.email?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-semibold text-text-primary">
                    {user?.displayName || user?.email || 'Unknown'}
                  </div>
                  <div className="text-sm text-text-tertiary">{user?.email}</div>
                </div>
              </div>
              <Button variant="secondary" onClick={onLogout}>
                Sign Out
              </Button>
            </div>
          </Section>

          {/* Audio */}
          <Section title="Audio">
            <SettingRow label="Output Device" description="Select your audio output">
              <select
                value={audioOutput}
                onChange={(e) => setAudioOutput(e.target.value)}
                className="bg-bg-primary text-text-primary px-4 py-2 rounded-lg border border-bg-hover focus:outline-none focus:border-accent-primary"
              >
                <option value="default">System Default</option>
                <option value="speakers">Speakers</option>
                <option value="headphones">Headphones</option>
              </select>
            </SettingRow>

            <SettingRow label="Sample Rate" description="Audio playback quality">
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(e.target.value)}
                className="bg-bg-primary text-text-primary px-4 py-2 rounded-lg border border-bg-hover focus:outline-none focus:border-accent-primary"
              >
                <option value="44100">44.1 kHz</option>
                <option value="48000">48 kHz</option>
                <option value="96000">96 kHz</option>
              </select>
            </SettingRow>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <SettingRow label="Theme" description="Choose your preferred theme">
              <div className="flex gap-2">
                {['dark', 'light', 'system'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      theme === t
                        ? 'bg-accent-primary text-white'
                        : 'bg-bg-primary text-text-secondary hover:text-text-primary border border-bg-hover'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </SettingRow>
          </Section>

          {/* Library */}
          <Section title="Library">
            <SettingRow
              label="Scan on Startup"
              description="Automatically scan watch folders when the app starts"
            >
              <Toggle checked={scanOnStartup} onChange={setScanOnStartup} />
            </SettingRow>
          </Section>

          {/* Updates */}
          <Section title="Updates">
            <SettingRow
              label="Automatic Updates"
              description="Download and install updates automatically"
            >
              <Toggle checked={autoUpdate} onChange={setAutoUpdate} />
            </SettingRow>

            <div className="flex items-center justify-between p-4 bg-bg-primary rounded-lg border border-bg-hover">
              <div>
                <div className="font-medium text-text-primary">Current Version</div>
                <div className="text-sm text-text-tertiary">v0.2.0</div>
              </div>
              <Button variant="secondary" onClick={onCheckUpdates}>
                Check for Updates
              </Button>
            </div>
          </Section>

          {/* About */}
          <Section title="About">
            <div className="p-4 bg-bg-primary rounded-lg border border-bg-hover text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center">
                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1">Hardwave Studios</h3>
              <p className="text-sm text-text-secondary mb-4">
                The ultimate suite for hardstyle, rawstyle & hardcore producers
              </p>
              <div className="flex justify-center gap-4 text-xs text-text-tertiary">
                <a href="#" className="hover:text-accent-primary transition-colors">Website</a>
                <a href="#" className="hover:text-accent-primary transition-colors">Discord</a>
                <a href="#" className="hover:text-accent-primary transition-colors">Support</a>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-secondary rounded-xl p-6 border border-bg-hover">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-bg-primary rounded-lg border border-bg-hover">
      <div>
        <div className="font-medium text-text-primary">{label}</div>
        <div className="text-sm text-text-tertiary">{description}</div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        checked ? 'bg-accent-primary' : 'bg-bg-hover'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  )
}
