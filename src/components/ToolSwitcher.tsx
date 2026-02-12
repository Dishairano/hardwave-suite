import { useState } from 'react'

export type Tool = 'hub' | 'organizer' | 'kickforge' | 'settings'

interface ToolSwitcherProps {
  currentTool: Tool
  onToolChange: (tool: Tool) => void
}

const tools = [
  {
    id: 'hub' as Tool,
    name: 'Hub',
    description: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
  },
  {
    id: 'organizer' as Tool,
    name: 'Organizer',
    description: 'Sample library',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    id: 'kickforge' as Tool,
    name: 'Kickforge',
    description: 'Kick designer',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  },
  {
    id: 'settings' as Tool,
    name: 'Settings',
    description: 'App settings',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
]

export function ToolSwitcher({ currentTool, onToolChange }: ToolSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentToolData = tools.find((t) => t.id === currentTool)

  return (
    <div className="relative">
      {/* Current Tool Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-hover hover:bg-bg-primary border border-bg-hover transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-tertiary flex items-center justify-center text-white">
          {currentToolData?.icon}
        </div>
        <div className="text-left">
          <div className="text-sm font-semibold text-text-primary">{currentToolData?.name}</div>
          <div className="text-xs text-text-tertiary">{currentToolData?.description}</div>
        </div>
        <svg
          className={`w-4 h-4 text-text-tertiary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-bg-secondary border border-bg-hover rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="p-2">
              <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide px-3 py-2">
                Switch Tool
              </div>
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    onToolChange(tool.id)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                    currentTool === tool.id
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'hover:bg-bg-hover text-text-primary'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      currentTool === tool.id
                        ? 'bg-gradient-to-br from-accent-primary to-accent-tertiary text-white'
                        : 'bg-bg-hover text-text-secondary'
                    }`}
                  >
                    {tool.icon}
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-semibold">{tool.name}</div>
                    <div className="text-xs text-text-tertiary">{tool.description}</div>
                  </div>
                  {currentTool === tool.id && (
                    <svg className="w-5 h-5 text-accent-primary" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-bg-hover p-3">
              <p className="text-xs text-text-tertiary text-center">
                Hardwave Suite v0.3.0
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
