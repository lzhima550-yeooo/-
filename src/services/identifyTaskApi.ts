import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiMode = (import.meta.env.VITE_IDENTIFY_TASK_MODE ?? 'backend').trim().toLowerCase()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null
const isRemoteEnabled = apiMode !== 'mock' && Boolean(apiClient)

const toText = (value: unknown) => String(value ?? '').trim()
const toStringList = (value: unknown, max = 20) =>
  Array.isArray(value)
    ? value
        .map((item) => toText(item))
        .filter(Boolean)
        .slice(0, max)
    : []

const toConfidence = (value: unknown) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return 0
  }
  return Math.max(0, Math.min(1, number))
}

const toStatus = (value: unknown): IdentifyTaskStatus => {
  const status = toText(value)
  if (status === 'pending' || status === 'queued' || status === 'running' || status === 'succeeded' || status === 'failed') {
    return status
  }
  return 'pending'
}

export type IdentifyTaskStatus = 'pending' | 'queued' | 'running' | 'succeeded' | 'failed'
export type IdentifyRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type IdentifyCategory = '虫害' | '病害' | '生理异常'

export interface IdentifyActionCard {
  id: string
  type: 'immediate' | 'observe' | 'encyclopedia' | 'community' | 'track'
  title: string
  description: string
  ctaLabel: string
  ctaRoute: string
  priority: number
}

export interface IdentifyTask {
  id: string
  type: string
  status: IdentifyTaskStatus
  createdAt: string
  updatedAt: string
  startedAt: string
  finishedAt: string
  durationMs: number
  error: string
  riskLevel: IdentifyRiskLevel
  topResult: {
    name: string
    category: IdentifyCategory
    confidence: number
    evidenceTags: string[]
  }
  identify: {
    name: string
    scientificName: string
    confidence: number
    typeLabel: '昆虫' | '病害'
    keywords: string[]
    summary: string
    controlTips: string[]
    cover: string
    spiritPreview: string
    encyclopediaId: string
    provider: string
    model: string
  }
  actionCards: IdentifyActionCard[]
  encyclopediaRefs: string[]
  sourceRefs: string[]
}

export interface IdentifyTaskCreatePayload {
  image: string
  prompt?: string
  hostPlant?: string
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed' | 'timeout'
  message?: string
}

const normalizeActionCard = (value: unknown): IdentifyActionCard => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const typeText = toText(record.type)
  const cardType: IdentifyActionCard['type'] =
    typeText === 'immediate' || typeText === 'observe' || typeText === 'encyclopedia' || typeText === 'community' || typeText === 'track'
      ? typeText
      : 'observe'

  return {
    id: toText(record.id),
    type: cardType,
    title: toText(record.title),
    description: toText(record.description),
    ctaLabel: toText(record.ctaLabel),
    ctaRoute: toText(record.ctaRoute),
    priority: Number.isFinite(Number(record.priority)) ? Number(record.priority) : 0,
  }
}

const emptyTask = (): IdentifyTask => ({
  id: '',
  type: 'diagnosis_identify',
  status: 'pending',
  createdAt: '',
  updatedAt: '',
  startedAt: '',
  finishedAt: '',
  durationMs: 0,
  error: '',
  riskLevel: 'medium',
  topResult: {
    name: '',
    category: '虫害',
    confidence: 0,
    evidenceTags: [],
  },
  identify: {
    name: '',
    scientificName: '',
    confidence: 0,
    typeLabel: '昆虫',
    keywords: [],
    summary: '',
    controlTips: [],
    cover: '',
    spiritPreview: '',
    encyclopediaId: '',
    provider: '',
    model: '',
  },
  actionCards: [],
  encyclopediaRefs: [],
  sourceRefs: [],
})

const normalizeTask = (value: unknown): IdentifyTask => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const topResultSource = record.topResult && typeof record.topResult === 'object' ? (record.topResult as Record<string, unknown>) : {}
  const identifySource = record.identify && typeof record.identify === 'object' ? (record.identify as Record<string, unknown>) : {}
  const categoryText = toText(topResultSource.category)
  const riskText = toText(record.riskLevel)

  const category: IdentifyCategory = categoryText === '病害' || categoryText === '生理异常' ? categoryText : '虫害'
  const riskLevel: IdentifyRiskLevel = riskText === 'low' || riskText === 'high' || riskText === 'critical' ? riskText : 'medium'

  return {
    id: toText(record.id),
    type: toText(record.type) || 'diagnosis_identify',
    status: toStatus(record.status),
    createdAt: toText(record.createdAt ?? record.created_at),
    updatedAt: toText(record.updatedAt ?? record.updated_at),
    startedAt: toText(record.startedAt ?? record.started_at),
    finishedAt: toText(record.finishedAt ?? record.finished_at),
    durationMs: Number.isFinite(Number(record.durationMs ?? record.duration_ms)) ? Number(record.durationMs ?? record.duration_ms) : 0,
    error: toText(record.error),
    riskLevel,
    topResult: {
      name: toText(topResultSource.name),
      category,
      confidence: toConfidence(topResultSource.confidence),
      evidenceTags: toStringList(topResultSource.evidenceTags, 8),
    },
    identify: {
      name: toText(identifySource.name),
      scientificName: toText(identifySource.scientificName),
      confidence: toConfidence(identifySource.confidence),
      typeLabel: toText(identifySource.typeLabel) === '病害' ? '病害' : '昆虫',
      keywords: toStringList(identifySource.keywords, 16),
      summary: toText(identifySource.summary),
      controlTips: toStringList(identifySource.controlTips, 4),
      cover: toText(identifySource.cover),
      spiritPreview: toText(identifySource.spiritPreview),
      encyclopediaId: toText(identifySource.encyclopediaId),
      provider: toText(identifySource.provider),
      model: toText(identifySource.model),
    },
    actionCards: Array.isArray(record.actionCards) ? record.actionCards.map((item) => normalizeActionCard(item)) : [],
    encyclopediaRefs: toStringList(record.encyclopediaRefs, 12),
    sourceRefs: toStringList(record.sourceRefs, 20),
  }
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })

export async function createIdentifyTaskOnServer(payload: IdentifyTaskCreatePayload): Promise<RemoteResult<IdentifyTask>> {
  if (!isRemoteEnabled || !apiClient) {
    return {
      ok: false,
      data: emptyTask(),
      reason: 'not_configured',
      message: '未配置识别任务后端，当前处于离线模式。',
    }
  }

  try {
    const response = await apiClient.post<{ data?: unknown }>('/identify/tasks', {
      body: payload,
      requestKey: 'identify-task-create',
      timeoutMessage: '识别任务创建超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeTask(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyTask(),
      reason: 'request_failed',
      message,
    }
  }
}

export async function fetchIdentifyTaskFromServer(taskId: string): Promise<RemoteResult<IdentifyTask>> {
  if (!isRemoteEnabled || !apiClient) {
    return {
      ok: false,
      data: emptyTask(),
      reason: 'not_configured',
      message: '未配置识别任务后端，无法查询识别任务。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>(`/identify/tasks/${encodeURIComponent(taskId)}`, {
      requestKey: `identify-task-${taskId}`,
      cancelPrevious: false,
      timeoutMessage: '识别任务查询超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeTask(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyTask(),
      reason: 'request_failed',
      message,
    }
  }
}

export async function waitForIdentifyTask(
  taskId: string,
  options?: {
    timeoutMs?: number
    intervalMs?: number
    onProgress?: (task: IdentifyTask) => void
  },
): Promise<RemoteResult<IdentifyTask>> {
  const timeoutMs = Math.max(2_000, options?.timeoutMs ?? 90_000)
  const intervalMs = Math.max(300, options?.intervalMs ?? 1_000)
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    const task = await fetchIdentifyTaskFromServer(taskId)
    if (!task.ok) {
      return task
    }

    if (typeof options?.onProgress === 'function') {
      options.onProgress(task.data)
    }

    if (task.data.status === 'succeeded' || task.data.status === 'failed') {
      return task
    }

    await delay(intervalMs)
  }

  return {
    ok: false,
    data: {
      ...emptyTask(),
      id: taskId,
      status: 'failed',
      error: 'poll timeout',
    },
    reason: 'timeout',
    message: '识别任务超时，请稍后重试。',
  }
}
