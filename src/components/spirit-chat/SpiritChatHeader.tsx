import { SpiritAvatar } from './SpiritAvatar'

interface SpiritChatHeaderProps {
  portraitUrl: string
  name: string
  statusText: string
}

export function SpiritChatHeader({ portraitUrl, name, statusText }: SpiritChatHeaderProps) {
  return (
    <header className="relative z-[1] flex items-center gap-3 border-b border-emerald-100/90 bg-white/78 px-3 py-2.5 backdrop-blur-md">
      <SpiritAvatar src={portraitUrl} alt={`${name}头像`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-emerald-950">{name}</p>
        <p className="truncate text-[11px] text-emerald-700/85">{statusText}</p>
      </div>
      <span className="rounded-full bg-emerald-100/70 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">夏木在线</span>
    </header>
  )
}
