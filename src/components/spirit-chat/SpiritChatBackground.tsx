import type { ReactNode } from 'react'

interface SpiritChatBackgroundProps {
  children: ReactNode
  theme?: string
}

export function SpiritChatBackground({ children, theme = 'spirit_wechat_fresh' }: SpiritChatBackgroundProps) {
  return (
    <section
      data-theme={theme}
      className="relative flex min-h-[540px] flex-col overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[linear-gradient(160deg,#fffdf8_0%,#f2fbf4_45%,#eaf8f5_100%)] shadow-[0_16px_28px_rgba(5,150,105,0.08)]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-65">
        <div className="absolute -left-10 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(167,243,208,0.6),rgba(167,243,208,0))] blur-xl" />
        <div className="absolute right-[-28px] top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(209,250,229,0.8),rgba(209,250,229,0))] blur-xl" />
        <div className="absolute bottom-[-30px] left-[16%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(190,242,100,0.25),rgba(190,242,100,0))] blur-2xl" />
        <div className="absolute left-[12%] top-[28%] h-24 w-14 rotate-[-12deg] rounded-[70%_30%_65%_35%/56%_44%_60%_40%] bg-emerald-100/40 blur-[1px]" />
        <div className="absolute right-[14%] top-[42%] h-20 w-12 rotate-[22deg] rounded-[75%_25%_78%_22%/58%_42%_64%_36%] bg-emerald-100/35 blur-[1px]" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0.5))]" />
      {children}
    </section>
  )
}

