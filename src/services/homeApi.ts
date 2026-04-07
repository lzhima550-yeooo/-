import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

const safeText = (value: unknown) => String(value ?? '').trim()

const toCount = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
}

export interface HomeFeedAlert {
  id: string
  name: string
  risk: string
  summary: string
  image: string
  season: string
}

export interface HomeFeedPick {
  id: string
  title: string
  author: string
  image: string
  likes: number
  status: string
  createdAt: string
}

export interface HomeFeedReminder {
  id: string
  type: string
  title: string
  status: string
  sessionId: string
  updatedAt: string
  publishedPostId: string
}

export interface HomeFeedData {
  alerts: HomeFeedAlert[]
  picks: HomeFeedPick[]
  reminders: HomeFeedReminder[]
  generatedAt: string
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

const emptyHomeFeed = (): HomeFeedData => ({
  alerts: [],
  picks: [],
  reminders: [],
  generatedAt: '',
})

const normalizeAlert = (value: unknown): HomeFeedAlert | null => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const id = safeText(record.id)
  if (!id) {
    return null
  }

  return {
    id,
    name: safeText(record.name),
    risk: safeText(record.risk),
    summary: safeText(record.summary),
    image: safeText(record.image ?? record.image_url),
    season: safeText(record.season),
  }
}

const normalizePick = (value: unknown): HomeFeedPick | null => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const id = safeText(record.id)
  if (!id) {
    return null
  }

  return {
    id,
    title: safeText(record.title),
    author: safeText(record.author ?? record.author_name),
    image: safeText(record.image ?? record.image_url),
    likes: toCount(record.likes),
    status: safeText(record.status),
    createdAt: safeText(record.createdAt ?? record.created_at),
  }
}

const normalizeReminder = (value: unknown): HomeFeedReminder | null => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const id = safeText(record.id)
  if (!id) {
    return null
  }

  return {
    id,
    type: safeText(record.type),
    title: safeText(record.title),
    status: safeText(record.status),
    sessionId: safeText(record.sessionId ?? record.session_id),
    updatedAt: safeText(record.updatedAt ?? record.updated_at),
    publishedPostId: safeText(record.publishedPostId ?? record.published_post_id),
  }
}

const normalizeHomeFeed = (value: unknown): HomeFeedData => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const alerts = Array.isArray(record.alerts)
    ? record.alerts.map((item) => normalizeAlert(item)).filter((item): item is HomeFeedAlert => Boolean(item))
    : []
  const picks = Array.isArray(record.picks)
    ? record.picks.map((item) => normalizePick(item)).filter((item): item is HomeFeedPick => Boolean(item))
    : []
  const reminders = Array.isArray(record.reminders)
    ? record.reminders
        .map((item) => normalizeReminder(item))
        .filter((item): item is HomeFeedReminder => Boolean(item))
    : []

  return {
    alerts,
    picks,
    reminders,
    generatedAt: safeText(record.generatedAt ?? record.generated_at),
  }
}

export async function fetchHomeFeedFromServer(): Promise<RemoteResult<HomeFeedData>> {
  if (!apiClient) {
    return {
      ok: false,
      data: emptyHomeFeed(),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前使用本地首页数据。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>('/home/feed', {
      requestKey: 'home-feed',
      timeoutMessage: '首页聚合数据加载超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeHomeFeed(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyHomeFeed(),
      reason: 'request_failed',
      message,
    }
  }
}

