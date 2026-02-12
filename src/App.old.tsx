import { useEffect, useState } from 'react'

function App() {
  const [version, setVersion] = useState<string>('')
  const [platform, setPlatform] = useState<string>('')

  useEffect(() => {
    // Test electron IPC communication
    const loadAppInfo = async () => {
      try {
        const v = await window.electron.getVersion()
        const p = await window.electron.getPlatform()
        setVersion(v)
        setPlatform(p)
      } catch (error) {
        console.error('Failed to load app info:', error)
      }
    }
    loadAppInfo()
  }, [])

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Titlebar placeholder */}
      <div className="h-8 bg-bg-secondary border-b border-bg-hover flex items-center px-4">
        <span className="text-sm font-semibold">FL Studio Organizer</span>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100vh-2rem)]">
        {/* Sidebar */}
        <div className="w-60 bg-bg-secondary border-r border-bg-hover p-4">
          <h2 className="text-lg font-semibold mb-4">Library</h2>
          <div className="text-text-secondary text-sm">
            <p>Version: {version || 'Loading...'}</p>
            <p>Platform: {platform || 'Loading...'}</p>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 p-6">
          <div className="max-w-2xl mx-auto mt-20">
            <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
              FL Studio Organizer
            </h1>
            <p className="text-text-secondary mb-8">
              Ultimate sample organization tool for harder-styles producers
            </p>

            <div className="bg-bg-tertiary border border-bg-hover rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-3">🚀 Project Initialized</h3>
              <p className="text-text-secondary mb-4">
                Electron app is running successfully! Next steps:
              </p>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span>
                  Electron + React + TypeScript setup
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-success">✓</span>
                  Tailwind CSS with design tokens
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-warning">⏳</span>
                  SQLite database (next)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-accent-warning">⏳</span>
                  UI components (next)
                </li>
              </ul>
            </div>

            <div className="mt-6 flex gap-3">
              <button className="px-4 py-2 bg-gradient-to-r from-accent-primary to-accent-tertiary rounded-lg font-semibold hover:shadow-glow-magenta transition-all">
                Add Folder
              </button>
              <button className="px-4 py-2 bg-bg-tertiary border border-bg-hover rounded-lg font-medium hover:bg-bg-hover transition-all">
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
