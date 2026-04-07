import { useEffect, useMemo, useRef } from 'react'
import { MaterialSymbol } from './MaterialSymbol'
import { useUiStore } from '../store/useUiStore'

const typeLabel = {
  reply: '回复',
  mention: '@提及',
  like: '点赞',
  system: '系统',
} as const

export function NotificationCenter() {
  const notifications = useUiStore((state) => state.notifications)
  const isOpen = useUiStore((state) => state.isNotificationDrawerOpen)
  const setOpen = useUiStore((state) => state.setNotificationDrawerOpen)
  const markAllRead = useUiStore((state) => state.markAllNotificationsRead)

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications])
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        aria-label="打开消息中心"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-20 z-[70] inline-flex h-11 min-w-[44px] items-center justify-center rounded-full border border-[var(--line)] bg-white px-3 text-[var(--text-soft)] shadow-sm"
      >
        <MaterialSymbol name="notifications" className="text-[18px]" />
        {unreadCount > 0 ? (
          <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{Math.min(unreadCount, 99)}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[110]">
          <button
            type="button"
            aria-label="关闭消息面板"
            className="absolute inset-0 bg-black/28"
            onClick={() => setOpen(false)}
          />
          <aside
            role="dialog"
            aria-label="消息中心"
            className="absolute right-0 top-0 h-full w-[min(380px,100vw)] border-l border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[var(--text-main)]">消息中心</h2>
              <button
                ref={closeButtonRef}
                type="button"
                className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs text-[var(--text-soft)]"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-[var(--text-soft)]">未读 {unreadCount} 条</p>
              <button
                type="button"
                className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs text-[var(--accent-deep)]"
                onClick={() => markAllRead()}
              >
                全部已读
              </button>
            </div>

            <ul className="mt-3 max-h-[calc(100vh-140px)] space-y-2 overflow-auto pr-1">
              {notifications.length === 0 ? (
                <li className="rounded-xl border border-dashed border-[var(--line)] bg-white p-4 text-xs text-[var(--text-soft)]">
                  暂无消息。
                </li>
              ) : (
                notifications.map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-xl border bg-white p-3 text-sm ${item.read ? 'border-[var(--line)]' : 'border-[color:var(--accent-deep)/0.4]'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--text-main)]">{item.title}</p>
                      <span className="rounded-full bg-[var(--card-soft)] px-2 py-0.5 text-[11px] text-[var(--text-soft)]">
                        {typeLabel[item.type]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">{item.message}</p>
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      ) : null}
    </>
  )
}
