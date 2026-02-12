import { useState } from 'react'
import { Button } from '../components/Button'

interface Layer {
  id: string
  name: string
  enabled: boolean
  volume: number
  pitch: number
  attack: number
  decay: number
  waveform: 'sine' | 'triangle' | 'square' | 'saw'
}

const defaultLayers: Layer[] = [
  { id: 'punch', name: 'Punch', enabled: true, volume: 80, pitch: 150, attack: 0, decay: 50, waveform: 'sine' },
  { id: 'body', name: 'Body', enabled: true, volume: 70, pitch: 60, attack: 10, decay: 200, waveform: 'sine' },
  { id: 'tail', name: 'Tail', enabled: true, volume: 50, pitch: 40, attack: 50, decay: 400, waveform: 'sine' },
]

export function KickforgeView() {
  const [layers, setLayers] = useState<Layer[]>(defaultLayers)
  const [masterVolume, setMasterVolume] = useState(80)
  const [distortion, setDistortion] = useState(30)
  const [distortionType, setDistortionType] = useState<'soft' | 'hard' | 'raw' | 'foldback'>('hard')

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(layers.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="p-6 border-b border-bg-hover">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Kickforge</h1>
        <p className="text-text-secondary">Design custom hardstyle kicks with 3-layer synthesis</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Waveform Display */}
          <div className="bg-bg-secondary rounded-xl p-6 border border-bg-hover">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Waveform</h2>
            <div className="h-32 bg-bg-primary rounded-lg flex items-center justify-center border border-bg-hover">
              <div className="flex items-end gap-0.5 h-20">
                {Array.from({ length: 100 }).map((_, i) => {
                  const height = Math.sin(i * 0.2) * Math.exp(-i * 0.03) * 100
                  return (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-accent-primary to-accent-tertiary rounded-full"
                      style={{ height: `${Math.abs(height)}%`, opacity: 0.5 + Math.abs(height) / 200 }}
                    />
                  )
                })}
              </div>
            </div>
          </div>

          {/* Layers */}
          <div className="bg-bg-secondary rounded-xl p-6 border border-bg-hover">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Layers</h2>
            <div className="space-y-4">
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`p-4 rounded-lg border transition-all ${
                    layer.enabled ? 'bg-bg-primary border-bg-hover' : 'bg-bg-hover/50 border-transparent opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateLayer(layer.id, { enabled: !layer.enabled })}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          layer.enabled
                            ? 'bg-accent-primary border-accent-primary'
                            : 'border-text-tertiary'
                        }`}
                      >
                        {layer.enabled && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </button>
                      <span className="font-semibold text-text-primary">{layer.name}</span>
                    </div>
                    <select
                      value={layer.waveform}
                      onChange={(e) => updateLayer(layer.id, { waveform: e.target.value as Layer['waveform'] })}
                      className="bg-bg-hover text-text-primary text-sm px-3 py-1.5 rounded-lg border border-bg-hover focus:outline-none focus:border-accent-primary"
                    >
                      <option value="sine">Sine</option>
                      <option value="triangle">Triangle</option>
                      <option value="square">Square</option>
                      <option value="saw">Saw</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <Slider label="Volume" value={layer.volume} onChange={(v) => updateLayer(layer.id, { volume: v })} />
                    <Slider label="Pitch" value={layer.pitch} max={500} onChange={(v) => updateLayer(layer.id, { pitch: v })} suffix=" Hz" />
                    <Slider label="Attack" value={layer.attack} max={100} onChange={(v) => updateLayer(layer.id, { attack: v })} suffix=" ms" />
                    <Slider label="Decay" value={layer.decay} max={1000} onChange={(v) => updateLayer(layer.id, { decay: v })} suffix=" ms" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Distortion */}
          <div className="bg-bg-secondary rounded-xl p-6 border border-bg-hover">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Distortion</h2>
            <div className="flex gap-4 mb-4">
              {(['soft', 'hard', 'raw', 'foldback'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setDistortionType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    distortionType === type
                      ? 'bg-accent-primary text-white'
                      : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            <Slider label="Amount" value={distortion} onChange={setDistortion} />
          </div>

          {/* Master */}
          <div className="bg-bg-secondary rounded-xl p-6 border border-bg-hover">
            <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-4">Master</h2>
            <Slider label="Volume" value={masterVolume} onChange={setMasterVolume} />
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-4 bg-bg-secondary border-t border-bg-hover flex items-center justify-between">
        <div className="flex gap-3">
          <Button variant="secondary">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Preview
          </Button>
          <Button variant="secondary">
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Randomize
          </Button>
        </div>
        <Button variant="primary">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export WAV
        </Button>
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = '%',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-tertiary">{label}</span>
        <span className="text-text-secondary">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-bg-hover rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  )
}
