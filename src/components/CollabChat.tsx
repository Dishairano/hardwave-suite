import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import type { ChatMessage } from '../lib/collabs'

interface CollabChatProps {
  messages: ChatMessage[]
  currentUserId: string
  onSend: (text: string) => void
}

export function CollabChat({ messages, currentUserId, onSend }: CollabChatProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-zinc-600 text-xs text-center mt-8">
            No messages yet. Say something!
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.from === currentUserId
          return (
            <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-baseline gap-1.5 mb-0.5">
                <span className="text-[10px] font-medium text-zinc-500">
                  {isMe ? 'You' : msg.from_name}
                </span>
                <span className="text-[9px] text-zinc-600">{formatTime(msg.timestamp)}</span>
              </div>
              <div
                className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs leading-relaxed ${
                  isMe
                    ? 'bg-red-600/20 text-red-100 rounded-br-sm'
                    : 'bg-white/[0.06] text-zinc-300 rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2 border-t border-white/[0.06]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-red-600/40 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-1.5 rounded-md bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-30 disabled:hover:bg-red-600/20 transition-colors"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
