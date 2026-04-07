import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-[var(--line)] bg-[color:var(--panel)/0.95] backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 lg:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-[var(--text-main)] lg:text-xl">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-[var(--text-soft)] lg:text-sm">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  )
}
