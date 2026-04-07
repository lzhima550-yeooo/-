import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

const safeText = (value: unknown) => String(value ?? '').trim()

const toCount = (value: unknown) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const normalized = toCount(value)
  if (normalized <= 0) {
    return fallback
  }
  return Math.max(min, Math.min(max, normalized))
}

export interface AnalyticsEventSummaryNameItem {
  name: string
  count: number
}

export interface AnalyticsEventSummarySourceItem {
  source: string
  count: number
}

export interface AnalyticsEventSummaryData {
  days: number
  total: number
  byName: AnalyticsEventSummaryNameItem[]
  bySource: AnalyticsEventSummarySourceItem[]
  generatedAt: string
}

export interface AnalyticsTaskLogItem {
  id: string
  taskType: string
  taskId: string
  status: string
  attempt: number
  durationMs: number
  error: string
  createdAt: string
}

export interface AnalyticsTaskLogPageMeta {
  limit: number
  offset: number
  hasMore: boolean
  nextOffset: number | null
}

export interface AnalyticsTaskLogPageData {
  items: AnalyticsTaskLogItem[]
  page: AnalyticsTaskLogPageMeta
}

export interface AnalyticsSummaryQuery {
  days?: number
  limit?: number
  source?: string
  eventName?: string
}

export interface AnalyticsTaskLogQuery {
  limit?: number
  offset?: number
  taskType?: string
  status?: string
  taskId?: string
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

const emptySummary = (): AnalyticsEventSummaryData => ({
  days: 7,
  total: 0,
  byName: [],
  bySource: [],
  generatedAt: '',
})

const emptyTaskLogPage = (limit: number, offset: number): AnalyticsTaskLogPageData => ({
  items: [],
  page: {
    limit,
    offset,
    hasMore: false,
    nextOffset: null,
  },
})

const normalizeSummaryNameItem = (value: unknown): AnalyticsEventSummaryNameItem | null => {
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

const normalizeSummarySourceItem = (value: unknown): AnalyticsEventSummarySourceItem | null => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const source = safeText(record.source)
  if (!source) {
    return null
  }

  return {
    source,
    count: toCount(record.count),
  }
}

const normalizeSummary = (value: unknown): AnalyticsEventSummaryData => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const byName = Array.isArray(record.byName)
    ? record.byName
        .map((item) => normalizeSummaryNameItem(item))
        .filter((item): item is AnalyticsEventSummaryNameItem => Boolean(item))
    : []
  const bySource = Array.isArray(record.bySource)
    ? record.bySource
        .map((item) => normalizeSummarySourceItem(item))
        .filter((item): item is AnalyticsEventSummarySourceItem => Boolean(item))
    : []

  return {
    days: clamp(record.days, 1, 90, 7),
    total: toCount(record.total),
    byName,
    bySource,
    generatedAt: safeText(record.generatedAt ?? record.generated_at),
  }
}

const normalizeTaskLogItem = (value: unknown): AnalyticsTaskLogItem | null => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const id = safeText(record.id)
  if (!id) {
    return null
  }

  return {
    id,
    taskType: safeText(record.taskType ?? record.task_type),
    taskId: safeText(record.taskId ?? record.task_id),
    status: safeText(record.status),
    attempt: toCount(record.attempt),
    durationMs: toCount(record.durationMs ?? record.duration_ms),
    error: safeText(record.error),
    createdAt: safeText(record.createdAt ?? record.created_at),
  }
}

const normalizeTaskLogs = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as AnalyticsTaskLogItem[]
  }

  return value.map((item) => normalizeTaskLogItem(item)).filter((item): item is AnalyticsTaskLogItem => Boolean(item))
}

const normalizeTaskLogPageMeta = (value: unknown, fallbackLimit: number, fallbackOffset: number): AnalyticsTaskLogPageMeta => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const resolvedOffset = Number.isFinite(Number(record.offset)) ? Math.max(0, Number(record.offset)) : fallbackOffset
  return {
    limit: clamp(record.limit, 1, 200, fallbackLimit),
    offset: resolvedOffset,
    hasMore: Boolean(record.hasMore),
    nextOffset: Number.isFinite(Number(record.nextOffset))
      ? Math.max(0, Number(record.nextOffset))
      : null,
  }
}

const normalizeTaskLogPageData = (
  value: unknown,
  fallbackLimit: number,
  fallbackOffset: number,
): AnalyticsTaskLogPageData => {
  if (Array.isArray(value)) {
    return {
      items: normalizeTaskLogs(value),
      page: {
        limit: fallbackLimit,
        offset: fallbackOffset,
        hasMore: false,
        nextOffset: null,
      },
    }
  }

  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    items: normalizeTaskLogs(record.items ?? record.data ?? []),
    page: normalizeTaskLogPageMeta(record.page, fallbackLimit, fallbackOffset),
  }
}

export async function fetchAnalyticsEventSummaryFromServer(
  query: AnalyticsSummaryQuery = {},
): Promise<RemoteResult<AnalyticsEventSummaryData>> {
  if (!apiClient) {
    return {
      ok: false,
      data: emptySummary(),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前无法加载服务端事件摘要。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>('/analytics/events/summary', {
      query: {
        days: clamp(query.days, 1, 90, 7),
        limit: clamp(query.limit, 1, 5000, 200),
        source: safeText(query.source) || undefined,
        eventName: safeText(query.eventName) || undefined,
      },
      requestKey: 'analytics-events-summary',
      timeoutMessage: '服务端事件摘要加载超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeSummary(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptySummary(),
      reason: 'request_failed',
      message,
    }
  }
}

export async function fetchAnalyticsTaskLogsFromServer(
  query: AnalyticsTaskLogQuery = {},
): Promise<RemoteResult<AnalyticsTaskLogPageData>> {
  const limit = clamp(query.limit, 1, 200, 20)
  const offset = Math.max(0, toCount(query.offset))

  if (!apiClient) {
    return {
      ok: false,
      data: emptyTaskLogPage(limit, offset),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前无法加载任务日志。',
    }
  }

  try {
    const response = await apiClient.get<{ items?: unknown; page?: unknown }>('/analytics/task-logs', {
      query: {
        limit,
        offset,
        taskType: safeText(query.taskType) || undefined,
        status: safeText(query.status) || undefined,
        taskId: safeText(query.taskId) || undefined,
      },
      requestKey: 'analytics-task-logs',
      timeoutMessage: '任务日志加载超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeTaskLogPageData(response, limit, offset),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyTaskLogPage(limit, offset),
      reason: 'request_failed',
      message,
    }
  }
}
