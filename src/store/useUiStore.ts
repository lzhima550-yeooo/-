import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ToastLevel = 'success' | 'info' | 'warning' | 'error'

export interface ToastMessage {
  id: string
  level: ToastLevel
  title?: string
  message: string
  createdAt: number
}

export type NotificationType = 'reply' | 'mention' | 'like' | 'system'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  createdAt: number
  read: boolean
}

interface UiState {
  toasts: ToastMessage[]
  notifications: NotificationItem[]
  isNotificationDrawerOpen: boolean
  pushToast: (toast: Omit<ToastMessage, 'id' | 'createdAt'>) => string
  removeToast: (toastId: string) => void
  clearToasts: () => void
  pushNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => string
  markAllNotificationsRead: () => void
  setNotificationDrawerOpen: (open: boolean) => void
}

const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      toasts: [],
      notifications: [],
      isNotificationDrawerOpen: false,
      pushToast: (toast) => {
        const id = uid('toast')
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id, createdAt: Date.now() }].slice(-6),
        }))
        return id
      },
      removeToast: (toastId) => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== toastId),
        }))
      },
      clearToasts: () => set({ toasts: [] }),
      pushNotification: (notification) => {
        const id = uid('noti')
        set((state) => ({
          notifications: [{ ...notification, id, createdAt: Date.now(), read: false }, ...state.notifications].slice(0, 80),
        }))
        return id
      },
      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((item) => ({ ...item, read: true })),
        }))
      },
      setNotificationDrawerOpen: (open) => set({ isNotificationDrawerOpen: open }),
    }),
    {
      name: 'summer-wood-ui-store',
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    },
  ),
)
