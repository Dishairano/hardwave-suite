import { Wifi, WifiOff, Loader2, Music2 } from 'lucide-react'
import type { ParticipantInfo, PresenceUpdate } from '../lib/collabs'

interface CollabStatusProps {
  connected: boolean
  connecting: boolean
  participants: ParticipantInfo[]
  presence: Record<string, PresenceUpdate>
  currentUserId: string
}

export function CollabStatus({ connected, connecting, participants, presence, currentUserId }: CollabStatusProps) {
  const partner = participants.find((p) => p.user_id !== currentUserId)
  const partnerPresence = partner ? presence[partner.user_id] : null

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        {connecting ? (
          <>
            <Loader2 size={14} className="text-yellow-500 animate-spin" />
            <span className="text-xs text-yellow-400">Connecting...</span>
          </>
        ) : connected ? (
          <>
            <Wifi size={14} className="text-emerald-500" />
            <span className="text-xs text-emerald-400">Connected</span>
          </>
        ) : (
          <>
            <WifiOff size={14} className="text-zinc-500" />
            <span className="text-xs text-zinc-500">Disconnected</span>
          </>
        )}
      </div>

      {/* Partner */}
      {partner && (
        <div className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-white">{partner.display_name}</span>
            <span className="text-[10px] text-zinc-600 uppercase">{partner.role}</span>
          </div>
          {partnerPresence && (
            <div className="flex items-center gap-1.5 ml-4">
              <Music2 size={10} className="text-zinc-500" />
              <span className="text-[10px] text-zinc-500">
                {partnerPresence.active_window || 'FL Studio'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Participants list */}
      <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1.5">In Session</div>
        {participants.map((p) => (
          <div key={p.user_id} className="flex items-center gap-2 py-1">
            <div className={`w-1.5 h-1.5 rounded-full ${p.user_id === currentUserId ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <span className="text-xs text-zinc-300">
              {p.display_name}
              {p.user_id === currentUserId && <span className="text-zinc-600 ml-1">(you)</span>}
            </span>
          </div>
        ))}
        {participants.length === 1 && (
          <div className="text-[10px] text-zinc-600 mt-1">Waiting for partner to join...</div>
        )}
      </div>
    </div>
  )
}
