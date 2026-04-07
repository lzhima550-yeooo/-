import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

const safeText = (value: unknown) => String(value ?? '').trim()

const toCount = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
}

export interface MeEventSummaryItem {
  name: string
  count: number
}

export interface MeStatsData {
  publish: number
  answer: number
  favorite: number
  identify: number
  eventSummary: MeEventSummaryItem[]
  generatedAt: string
}

export interface MeStatsQuery {
  account?: string
  profileName?: string
  favoriteCount?: number
  identifyCount?: number
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

const emptyMeStats = (): MeStatsData => ({
  publish: 0,
  answer: 0,
  favorite: 0,
  identify: 0,
  eventSummary: [],
  generatedAt: '',
})

const normalizeSummary = (value: unknown): MeEventSummaryItem | null => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const name = safeText(record.name)
  if (!name) {
    return null
  }

  return {
    name,
    count: toCount(record.count),
  }
}

const normalizeMeStats = (value: unknown): MeStatsData => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const eventSummary = Array.isArray(record.eventSummary)
    ? record.eventSummary
        .map((item) => normalizeSummary(item))
        .filter((item): item is MeEventSummaryItem => Boolean(item))
    : []

  return {
    publish: toCount(record.publish),
    answer: toCount(record.answer),
    favorite: toCount(record.favorite),
    identify: toCount(record.identify),
    eventSummary,
    generatedAt: safeText(record.generatedAt ?? record.generated_at),
  }
}

export async function fetchMeStatsFromServer(query: MeStatsQuery): Promise<RemoteResult<MeStatsData>> {
  if (!apiClient) {
    return {
      ok: false,
      data: emptyMeStats(),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前使用本地统计数据。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>('/me/stats', {
      query: {
        account: safeText(query.account) || undefined,
        profileName: safeText(query.profileName) || undefined,
        favoriteCount: toCount(query.favoriteCount),
        identifyCount: toCount(query.identifyCount),
      },
      requestKey: 'me-stats',
      timeoutMessage: '个人统计加载超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeMeStats(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyMeStats(),
      reason: 'request_failed',
      message,
    }
  }
}

