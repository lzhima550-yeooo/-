import { useEffect, useRef } from 'react'
import { SpiritMessageBubble } from './SpiritMessageBubble'

export interface SpiritChatMessage {
  id: string
  role: 'user' | 'spirit'
  text: string
}

interface SpiritMessageListProps {
  messages: SpiritChatMessage[]
  spiritAvatarUrl: string
  spiritName: string
  streamingState: boolean
}

export function SpiritMessageList({ messages, spiritAvatarUrl, spiritName, streamingState }: SpiritMessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const lastMessage = messages[messages.length - 1]
  const typing = streamingState && lastMessage?.role === 'spirit' && !lastMessage.text.trim()

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      return
    }
    el.scrollTop = el.scrollHeight
  }, [messages, streamingState])

  return (
    <div ref={scrollRef} className="relative z-[1] flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
      {messages.map((message) => (
        <SpiritMessageBubble
          key={message.id}
          role={message.role}
          text={message.text}
          spiritAvatarUrl={spiritAvatarUrl}
          spiritName={spiritName}
          isStreaming={typing && message.id === lastMessage.id}
        />
      ))}
    </div>
  )
}
