import type { EncyclopediaItem } from '../types/models'
import { normalizeEncyclopediaRecord } from './modelGuards'
import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

const toText = (value: unknown, fallback = '') => {
  const normalized = String(value ?? fallback).trim()
  return normalized || fallback
}

const toStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => toText(item))
    .filter(Boolean)
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

export interface SourceIndexItem {
  id: string
  sourceType: string
  title: string
  url: string
  snippet: string
  confidenceScore: number
  confidenceLabel: '高' | '中' | '低'
}

export interface TreatmentTemplate {
  entryId: string
  immediateActions: string[]
  environmentAdjustments: string[]
  followUpSchedule: string[]
  cautionNotes: string[]
}

export interface EncyclopediaDetailResult {
  id: string
  entry: EncyclopediaItem
  sourceIndex: SourceIndexItem[]
  treatmentTemplate: TreatmentTemplate
  relatedEntries: EncyclopediaItem[]
}

export const isBackendApiConfigured = Boolean(apiClient)

const normalizeSourceIndexItem = (source: unknown, index = 0): SourceIndexItem => {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {}
  const rawScore = Number(record.confidenceScore ?? record.confidence_score)
  const confidenceScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 60
  const confidenceLabelText = toText(record.confidenceLabel ?? record.confidence_label)
  const confidenceLabel: '高' | '中' | '低' =
    confidenceLabelText === '高' || confidenceLabelText === '低'
      ? confidenceLabelText
      : confidenceScore >= 80
        ? '高'
        : confidenceScore < 55
          ? '低'
          : '中'

  return {
    id: toText(record.id, `src-${index + 1}`),
    sourceType: toText(record.sourceType ?? record.source_type, 'reference'),
    title: toText(record.title ?? record.source_title, '资料来源'),
    url: toText(record.url ?? record.source_url),
    snippet: toText(record.snippet),
    confidenceScore,
    confidenceLabel,
  }
}

const normalizeTreatmentTemplate = (source: unknown, entryId = ''): TreatmentTemplate => {
  const record = source && typeof source === 'object' ? (source as Record<string, unknown>) : {}
  return {
    entryId: toText(record.entryId ?? record.entry_id, entryId),
    immediateActions: toStringList(record.immediateActions ?? record.immediate_actions),
    environmentAdjustments: toStringList(record.environmentAdjustments ?? record.environment_adjustments),
    followUpSchedule: toStringList(record.followUpSchedule ?? record.follow_up_schedule),
    cautionNotes: toStringList(record.cautionNotes ?? record.caution_notes),
  }
}

export async function fetchEncyclopediaSearchFromServer(input?: {
  q?: string
  type?: 'all' | 'insect' | 'disease'
  risk?: 'all' | '高' | '中' | '低'
  category?: string
  limit?: number
}): Promise<RemoteResult<EncyclopediaItem[]>> {
  if (!apiClient) {
    return {
      ok: false,
      data: [],
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前使用本地数据。',
    }
  }

  try {
    const queryType = input?.type && input.type !== 'all' ? input.type : undefined
    const queryRisk = input?.risk && input.risk !== 'all' ? input.risk : undefined
    const queryCategory = input?.category && input.category !== 'all' ? input.category.trim() : undefined
    const queryLimit = Number.isFinite(Number(input?.limit)) ? Math.max(1, Math.min(200, Number(input?.limit))) : undefined

    const payload = await apiClient.get<{ items?: unknown[]; data?: unknown[] }>('/encyclopedia/search', {
      query: {
        q: input?.q?.trim() || undefined,
        type: queryType,
        risk: queryRisk,
        category: queryCategory,
        limit: queryLimit,
      },
      retries: 1,
      requestKey: 'encyclopedia-search-v2',
      timeoutMessage: '图鉴检索超时，请稍后重试。',
    })

    const rawItems = payload.items ?? payload.data ?? []
    const normalizedItems = Array.isArray(rawItems)
      ? rawItems
          .map((record, index) => normalizeEncyclopediaRecord(record, index))
          .filter((item): item is EncyclopediaItem => Boolean(item))
      : []

    return {
      ok: true,
      data: normalizedItems,
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: [],
      reason: 'request_failed',
      message,
    }
  }
}

export async function fetchEncyclopediaFromServer(query?: string): Promise<RemoteResult<EncyclopediaItem[]>> {
  return fetchEncyclopediaSearchFromServer({
    q: query,
  })
}

export async function fetchEncyclopediaDetailFromServer(entryId: string): Promise<RemoteResult<EncyclopediaDetailResult | null>> {
  if (!apiClient) {
    return {
      ok: false,
      data: null,
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前使用本地图鉴详情。',
    }
  }

  try {
    const payload = await apiClient.get<{ data?: unknown }>(`/encyclopedia/${encodeURIComponent(entryId)}`, {
      requestKey: `encyclopedia-detail-${entryId}`,
      timeoutMessage: '图鉴详情请求超时，请稍后重试。',
    })

    const source = payload.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>) : {}
    const normalizedEntry = normalizeEncyclopediaRecord(source.entry ?? source, 0)
    if (!normalizedEntry) {
      return {
        ok: false,
        data: null,
        reason: 'request_failed',
        message: '图鉴详情数据格式异常。',
      }
    }

    const sourceIndexRaw = Array.isArray(source.sourceIndex) ? source.sourceIndex : []
    const relatedRaw = Array.isArray(source.relatedEntries) ? source.relatedEntries : []

    return {
      ok: true,
      data: {
        id: toText(source.id, normalizedEntry.id),
        entry: normalizedEntry,
        sourceIndex: sourceIndexRaw.map((item, index) => normalizeSourceIndexItem(item, index)),
        treatmentTemplate: normalizeTreatmentTemplate(source.treatmentTemplate, normalizedEntry.id),
        relatedEntries: relatedRaw
          .map((item, index) => normalizeEncyclopediaRecord(item, index))
          .filter((item): item is EncyclopediaItem => Boolean(item)),
      },
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: null,
      reason: 'request_failed',
      message,
    }
  }
}
