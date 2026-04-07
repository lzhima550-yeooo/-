export interface AnalyticsEvent {
  id: string
  name: string
  page: string
  payload?: Record<string, string | number | boolean>
  createdAt: number
}

const storageKey = 'summer-wood-analytics-events'
const isTestEnv = import.meta.env.MODE === 'test'

const uid = () => `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const loadEvents = (): AnalyticsEvent[] => {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as AnalyticsEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const saveEvents = (events: AnalyticsEvent[]) => {
  window.localStorage.setItem(storageKey, JSON.stringify(events.slice(-300)))
}

export const analytics = {
  track(name: string, page: string, payload?: Record<string, string | number | boolean>) {
    if (typeof window === 'undefined' || isTestEnv) {
      return
    }

    const events = loadEvents()
    const nextEvent: AnalyticsEvent = {
      id: uid(),
      name,
      page,
      payload,
      createdAt: Date.now(),
    }

    saveEvents([...events, nextEvent])
    window.dispatchEvent(new CustomEvent('app:analytics', { detail: nextEvent }))
  },
  list() {
    if (typeof window === 'undefined') {
      return [] as AnalyticsEvent[]
    }
    return loadEvents().reverse()
  },
  clear() {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.removeItem(storageKey)
    window.dispatchEvent(new CustomEvent('app:analytics:cleared'))
  },
}

