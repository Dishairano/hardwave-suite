import { useState, useEffect, useRef } from 'react'
import { Users, Plus, LogIn, Copy, Check, X, Loader2, Download, CheckCircle2 } from 'lucide-react'
import { CollabChat } from '../components/CollabChat'
import { CollabStatus } from '../components/CollabStatus'
import * as collabs from '../lib/collabs'
import type { User } from '../lib/api'

interface CollabsViewProps {
  user: User
}

type ViewMode = 'lobby' | 'session'

export function CollabsView({ user }: CollabsViewProps) {
  const [mode, setMode] = useState<ViewMode>('lobby')
  const [joinCode, setJoinCode] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [participants, setParticipants] = useState<collabs.ParticipantInfo[]>([])
  const [messages, setMessages] = useState<collabs.ChatMessage[]>([])
  const [presence, setPresence] = useState<Record<string, collabs.PresenceUpdate>>({})
  const [error, setError] = useState<string | null>(null)
  const [flScriptInstalled, setFlScriptInstalled] = useState<boolean | null>(null)
  const [flFound, setFlFound] = useState(false)
  const [installing, setInstalling] = useState(false)
  const unlistenRef = useRef<(() => void) | null>(null)

  // Check FL Script status on mount
  useEffect(() => {
    collabs.getFlScriptStatus().then((status) => {
      setFlFound(status.fl_found as boolean)
      setFlScriptInstalled(status.installed as boolean)
    }).catch(() => {})
  }, [])

  const handleInstallScript = async () => {
    setInstalling(true)
    try {
      await collabs.installFlScript()
      setFlScriptInstalled(true)
    } catch (e) {
      setError(String(e))
    }
    setInstalling(false)
  }

  // Set up event listener
  useEffect(() => {
    let mounted = true
    collabs.onCollabEvent((event) => {
      if (!mounted) return

      switch (event.type) {
        case 'room_created':
          setRoomCode(event.code)
          setMode('session')
          setConnecting(false)
          setConnected(true)
          setParticipants([{
            user_id: String(user.id),
            display_name: user.displayName || user.email,
            role: 'host',
          }])
          break

        case 'room_joined':
          setRoomCode(event.code)
          setMode('session')
          setConnecting(false)
          setConnected(true)
          setParticipants(event.participants)
          break

        case 'participant_joined':
          setParticipants((prev) => [...prev.filter(p => p.user_id !== event.user.user_id), event.user])
          break

        case 'participant_left':
          setParticipants((prev) => prev.filter((p) => p.user_id !== event.user_id))
          break

        case 'chat':
          setMessages((prev) => [...prev, {
            from: event.from,
            from_name: event.from_name,
            text: event.text,
            timestamp: event.timestamp,
          }])
          break

        case 'presence':
          setPresence((prev) => ({
            ...prev,
            [event.from]: event as collabs.PresenceUpdate,
          }))
          break

        case 'connected':
          setConnected(true)
          setConnecting(false)
          break

        case 'disconnected':
          setConnected(false)
          setConnecting(false)
          break

        case 'error':
          setError(event.message)
          setConnecting(false)
          break
      }
    }).then((unlisten) => {
      unlistenRef.current = unlisten
    })

    return () => {
      mounted = false
      unlistenRef.current?.()
    }
  }, [user])

  const handleCreate = async () => {
    setError(null)
    setConnecting(true)
    try {
      await collabs.createSession()
    } catch (e) {
      setError(String(e))
      setConnecting(false)
    }
  }

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setError(null)
    setConnecting(true)
    try {
      await collabs.joinSession(code)
    } catch (e) {
      setError(String(e))
      setConnecting(false)
    }
  }

  const handleLeave = async () => {
    try {
      await collabs.leaveSession()
    } catch { /* ignore */ }
    setMode('lobby')
    setRoomCode('')
    setConnected(false)
    setParticipants([])
    setMessages([])
    setPresence({})
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendChat = (text: string) => {
    collabs.sendChat(text)
    // Optimistic: add own message immediately
    setMessages((prev) => [...prev, {
      from: String(user.id),
      from_name: user.displayName || user.email,
      text,
      timestamp: Date.now(),
    }])
  }

  // ── Lobby ──
  if (mode === 'lobby') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Users size={24} className="text-red-500" />
              <h2 className="text-xl font-bold text-white">Collabs</h2>
            </div>
            <p className="text-sm text-zinc-500">
              Collaborate on FL Studio projects in real-time
            </p>
          </div>

          {/* FL Script Status */}
          {flScriptInstalled !== null && (
            <div className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {flScriptInstalled ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <div>
                        <div className="text-xs font-medium text-white">FL Studio Script Installed</div>
                        <div className="text-[10px] text-zinc-500">Restart FL Studio to activate</div>
                      </div>
                    </>
                  ) : flFound ? (
                    <>
                      <Download size={16} className="text-yellow-500" />
                      <div>
                        <div className="text-xs font-medium text-white">FL Studio Detected</div>
                        <div className="text-[10px] text-zinc-500">Install the collab script to enable sync</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <X size={16} className="text-zinc-500" />
                      <div>
                        <div className="text-xs font-medium text-zinc-400">FL Studio Not Found</div>
                        <div className="text-[10px] text-zinc-600">Install FL Studio to use Collabs</div>
                      </div>
                    </>
                  )}
                </div>
                {flFound && !flScriptInstalled && (
                  <button
                    onClick={handleInstallScript}
                    disabled={installing}
                    className="px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-600/30 text-xs text-red-400 hover:bg-red-600/30 transition-all disabled:opacity-50"
                  >
                    {installing ? 'Installing...' : 'Install'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Create Session */}
          <button
            onClick={handleCreate}
            disabled={connecting}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-xl bg-red-600/10 border border-red-600/20 hover:bg-red-600/15 hover:border-red-600/30 transition-all group"
          >
            {connecting ? (
              <Loader2 size={20} className="text-red-500 animate-spin" />
            ) : (
              <Plus size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
            )}
            <div className="text-left">
              <div className="text-sm font-semibold text-white">Create Session</div>
              <div className="text-xs text-zinc-500">Start a new collab room and share the code</div>
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* Join Session */}
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter room code (e.g. HW-X9K2)"
                maxLength={7}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-zinc-600 outline-none focus:border-red-600/40 tracking-wider text-center transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
              <button
                onClick={handleJoin}
                disabled={connecting || !joinCode.trim()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] disabled:opacity-30 transition-all text-sm text-white"
              >
                <LogIn size={14} />
                Join
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-600/10 border border-red-600/20 text-xs text-red-400">
              <X size={14} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Active Session ──
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar: status + participants */}
      <div className="w-64 border-r border-white/[0.06] flex flex-col">
        {/* Room header */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Room Code</span>
            <button
              onClick={handleLeave}
              className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
            >
              Leave
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono text-white tracking-wider">{roomCode}</span>
            <button
              onClick={handleCopyCode}
              className="p-1 rounded hover:bg-white/[0.06] transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-zinc-500" />}
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="flex-1 overflow-y-auto p-3">
          <CollabStatus
            connected={connected}
            connecting={connecting}
            participants={participants}
            presence={presence}
            currentUserId={String(user.id)}
          />
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2.5 border-b border-white/[0.06]">
          <span className="text-xs font-medium text-zinc-400">Chat</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CollabChat
            messages={messages}
            currentUserId={String(user.id)}
            onSend={handleSendChat}
          />
        </div>
      </div>
    </div>
  )
}
