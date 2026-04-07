import type { ReactNode } from 'react'

interface MobileFrameProps {
  children: ReactNode
  withTabs?: boolean
}

export function MobileFrame({ children, withTabs = false }: MobileFrameProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] px-2 sm:px-4 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[-80px] h-72 w-72 rounded-full bg-[color:var(--accent)/0.22] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-[-100px] h-72 w-72 rounded-full bg-[color:var(--accent-deep)/0.16] blur-3xl" />

      <div className="relative mx-auto w-full max-w-[430px] py-0 md:max-w-[960px] md:py-6 lg:max-w-[1260px]">
        <div className="min-h-screen overflow-hidden bg-[var(--panel)] shadow-[0_8px_30px_rgba(16,24,40,0.08)] md:rounded-[28px] md:border md:border-[var(--line)]">
          <div className={`relative min-h-screen ${withTabs ? 'pb-[86px] lg:pb-0' : ''}`}>{children}</div>
        </div>
      </div>
    </div>
  )
}
