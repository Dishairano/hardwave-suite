// ── Types ──

export interface ParticipantInfo {
  user_id: string
  display_name: string
  role: 'host' | 'guest'
}

export interface RoomInfo {
  code: string
  participants: ParticipantInfo[]
}

export interface ChatMessage {
  from: string
  from_name: string
  text: string
  timestamp: number
}

export interface CursorInfo {
  screen_x: number
  screen_y: number
  client_x: number
  client_y: number
  window: string
}

export interface PresenceUpdate {
  from: string
  active_window: string
  cursor: CursorInfo | null
}

export interface StateDelta {
  from: string
  domain: string
  ops: unknown[]
}

export type CollabEvent =
  | { type: 'room_created'; code: string }
  | { type: 'room_joined'; code: string; participants: ParticipantInfo[] }
  | { type: 'participant_joined'; user: ParticipantInfo }
  | { type: 'participant_left'; user_id: string }
  | { type: 'chat'; from: string; from_name: string; text: string; timestamp: number }
  | { type: 'state_delta'; from: string; domain: string; ops: unknown[] }
  | { type: 'presence'; from: string; active_window: string; cursor: unknown }
  | { type: 'connected' }
  | { type: 'disconnected'; reason: string }
  | { type: 'error'; message: string }

// ── Tauri invoke wrapper ──

const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) throw new Error('Not running in Tauri')
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(cmd, args)
}

// ── Collab Commands ──

export async function createSession(): Promise<void> {
  return invoke('collab_create')
}

export async function joinSession(code: string): Promise<void> {
  return invoke('collab_join', { code })
}

export async function leaveSession(): Promise<void> {
  return invoke('collab_leave')
}

export async function sendChat(text: string): Promise<void> {
  return invoke('collab_send_chat', { text })
}

export async function sendPresence(activeWindow: string): Promise<void> {
  return invoke('collab_send_presence', { activeWindow })
}

// ── Event Listener ──

export async function onCollabEvent(
  callback: (event: CollabEvent) => void,
): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<CollabEvent>('collab:event', (e) => callback(e.payload))
}
