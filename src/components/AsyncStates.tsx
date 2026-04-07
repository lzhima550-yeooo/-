import type { ReactNode } from 'react'

interface BaseStateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function LoadingState({ title, description, className }: Omit<BaseStateProps, 'action'>) {
  return (
    <section
      aria-live="polite"
      className={`rounded-2xl border border-[var(--line)] bg-white p-5 text-center shadow-sm ${className ?? ''}`.trim()}
    >
      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--accent-deep)/0.24] border-t-[var(--accent-deep)]" />
      <p className="mt-3 text-sm font-semibold text-[var(--text-main)]">{title}</p>
      {description ? <p className="mt-1 text-xs text-[var(--text-soft)]">{description}</p> : null}
    </section>
  )
}

export function EmptyState({ title, description, action, className }: BaseStateProps) {
  return (
    <section
      className={`rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 text-center ${className ?? ''}`.trim()}
    >
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      {description ? <p className="mt-1 text-xs text-[var(--text-soft)]">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </section>
  )
}

export function ErrorState({ title, description, action, className }: BaseStateProps) {
  return (
    <section
      role="alert"
      className={`rounded-2xl border border-red-200 bg-red-50 p-5 text-center ${className ?? ''}`.trim()}
    >
      <p className="text-sm font-semibold text-red-700">{title}</p>
      {description ? <p className="mt-1 text-xs text-red-600">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </section>
  )
}
