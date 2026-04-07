import { SpiritAvatar } from './SpiritAvatar'

interface SpiritMessageBubbleProps {
  role: 'user' | 'spirit'
  text: string
  spiritAvatarUrl: string
  spiritName: string
  isStreaming?: boolean
}

export function SpiritMessageBubble({ role, text, spiritAvatarUrl, spiritName, isStreaming = false }: SpiritMessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[84%] rounded-[20px] bg-[linear-gradient(145deg,#eef9f1,#def3e4)] px-3.5 py-2.5 text-[13px] leading-6 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.12)]">
          {text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2.5">
      <SpiritAvatar src={spiritAvatarUrl} alt={`${spiritName}头像`} />
      <div className="max-w-[84%] rounded-[20px] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(235,248,238,0.92))] px-3.5 py-2.5 text-[13px] leading-6 text-[color:#1f3f33] shadow-[0_10px_20px_rgba(6,78,59,0.08)]">
        {isStreaming ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-700/85">
            <span>正在输入</span>
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/80" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/60 [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/50 [animation-delay:220ms]" />
            </span>
          </span>
        ) : (
          text
        )}
      </div>
    </div>
  )
}
