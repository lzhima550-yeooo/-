import { useEffect } from 'react'
import { useUiStore } from '../store/useUiStore'

const levelStyles: Record<string, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
}

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts)
  const pushToast = useUiStore((state) => state.pushToast)
  const removeToast = useUiStore((state) => state.removeToast)

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        removeToast(toast.id)
      }, 3200),
    )

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [removeToast, toasts])

  useEffect(() => {
    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ type?: 'success' | 'info' | 'warning' | 'error'; message?: string }>
      const message = customEvent.detail?.message?.trim()
      if (!message) {
        return
      }

      pushToast({
        level: customEvent.detail?.type ?? 'info',
        message,
      })
    }

    window.addEventListener('app:toast', onToast as EventListener)
    return () => window.removeEventListener('app:toast', onToast as EventListener)
  }, [pushToast])

  if (toasts.length === 0) {
    return null
  }

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-sm ${levelStyles[toast.level] ?? levelStyles.info}`}
        >
          {toast.title ? <p className="font-semibold">{toast.title}</p> : null}
          <p>{toast.message}</p>
        </article>
      ))}
    </div>
  )
}
