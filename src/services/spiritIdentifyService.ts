import { encyclopediaItems } from '../mock/encyclopedia'
import { createHttpClient } from './httpClient'

export interface SpiritIdentifyResult {
  name: string
  scientificName: string
  confidence: number
  typeLabel: '昆虫' | '病害'
  keywords: string[]
  summary: string
  controlTips: string[]
  cover: string
  encyclopediaId: string
  spiritPreview: string
}

interface IdentifyParams {
  file: File
  imagePreview: string
  signal?: AbortSignal
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null
const apiMode = (import.meta.env.VITE_SPIRIT_IDENTIFY_MODE ?? 'backend').trim().toLowerCase()
const apiEndpoint = (import.meta.env.VITE_SPIRIT_IDENTIFY_ENDPOINT ?? '').trim()

const isCustomRemoteConfigured = apiMode === 'remote' && Boolean(apiEndpoint)
const isBackendIdentifyConfigured = apiMode !== 'mock' && apiMode !== 'remote' && Boolean(apiClient)
export const isRemoteSpiritIdentifyConfigured = isCustomRemoteConfigured || isBackendIdentifyConfigured

const encyclopediaFallbackId = encyclopediaItems.find((item) => item.type === 'insect')?.id ?? encyclopediaItems[0]?.id ?? ''

const ladybugPreset = {
  name: '瓢虫',
  scientificName: 'Coccinella septempunctata',
  typeLabel: '昆虫' as const,
  summary: '瓢虫在春夏季常见于校园绿化环境，主要捕食蚜虫等小型软体害虫。',
  controlTips: ['减少广谱杀虫剂使用，优先保护生态平衡。', '保留花带和复层植物，提高瓢虫驻留概率。'],
  cover: '/images/914ec19753ff41c467235a1cc8413f5f.jpg',
  spiritPreview: '/images/914ec19753ff41c467235a1cc8413f5f.jpg',
  encyclopediaId: encyclopediaItems.find((item) => item.name.includes('瓢虫'))?.id ?? encyclopediaFallbackId,
  keywords: ['瓢虫', 'Coccinella', '鞘翅目'],
}

const asText = (value: unknown, fallback = '') => {
  const normalized = String(value ?? fallback).trim()
  return normalized || fallback
}

const asConfidence = (value: unknown, fallback = 0.97) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  if (num > 1) {
    return Math.max(0, Math.min(1, num / 100))
  }

  return Math.max(0, Math.min(1, num))
}

const asKeywords = (value: unknown, fallback: string[]) => {
  const normalizeKeywords = (items: string[]) =>
    items
      .map((item) => asText(item))
      .filter(Boolean)
      .filter((item) => item !== '益虫天敌' && item !== '天敌益虫')

  if (Array.isArray(value)) {
    const next = normalizeKeywords(value.map((item) => String(item)))
    return next.length > 0 ? next : fallback
  }

  if (typeof value === 'string') {
    const next = normalizeKeywords(value.split(/[\s、,，]+/))
    return next.length > 0 ? next : fallback
  }

  return fallback
}

const asTips = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) {
    return fallback
  }

  const next = value
    .map((item) => asText(item))
    .filter(Boolean)

  return next.length > 0 ? next.slice(0, 3) : fallback
}

const resolveEncyclopediaId = (input: {
  encyclopediaId?: unknown
  name?: unknown
  scientificName?: unknown
  typeLabel?: '昆虫' | '病害'
}) => {
  const requestedId = asText(input.encyclopediaId)
  if (requestedId) {
    const byId = encyclopediaItems.find((item) => item.id === requestedId)
    if (byId) {
      return byId.id
    }
  }

  const normalizedName = asText(input.name).toLowerCase()
  const normalizedScientific = asText(input.scientificName).toLowerCase()
  const expectedType = input.typeLabel === '病害' ? 'disease' : 'insect'
  const scoped = encyclopediaItems.filter((item) => item.type === expectedType)

  const byScientific = scoped.find((item) => item.scientificName.toLowerCase() === normalizedScientific)
  if (byScientific) {
    return byScientific.id
  }

  const byNameIncludes = scoped.find((item) => item.name.toLowerCase().includes(normalizedName))
  if (byNameIncludes) {
    return byNameIncludes.id
  }

  const byNameContained = scoped.find((item) => normalizedName.includes(item.name.toLowerCase()))
  if (byNameContained) {
    return byNameContained.id
  }

  return expectedType === 'insect' ? ladybugPreset.encyclopediaId : encyclopediaFallbackId
}

const buildMockResult = (imagePreview: string): SpiritIdentifyResult => {
  return {
    name: ladybugPreset.name,
    scientificName: ladybugPreset.scientificName,
    confidence: 0.97,
    typeLabel: ladybugPreset.typeLabel,
    keywords: [...ladybugPreset.keywords],
    summary: ladybugPreset.summary,
    controlTips: [...ladybugPreset.controlTips],
    cover: imagePreview || ladybugPreset.cover,
    encyclopediaId: ladybugPreset.encyclopediaId,
    spiritPreview: ladybugPreset.spiritPreview,
  }
}

const normalizeRemotePayload = (payload: unknown, imagePreview: string): SpiritIdentifyResult => {
  if (!payload || typeof payload !== 'object') {
    return buildMockResult(imagePreview)
  }

  const record = payload as Record<string, unknown>
  const typeLabel = record.typeLabel === '病害' || record.type === 'disease' ? '病害' : '昆虫'
  const name = asText(record.name, ladybugPreset.name)
  const scientificName = asText(record.scientificName ?? record.scientific_name, ladybugPreset.scientificName)

  return {
    name,
    scientificName,
    confidence: asConfidence(record.confidence),
    typeLabel,
    keywords: asKeywords(record.keywords, ladybugPreset.keywords),
    summary: asText(record.summary, ladybugPreset.summary),
    controlTips: asTips(record.controlTips ?? record.control_tips, ladybugPreset.controlTips),
    cover: asText(record.cover ?? record.image, imagePreview || ladybugPreset.cover),
    encyclopediaId: resolveEncyclopediaId({
      encyclopediaId: record.encyclopediaId ?? record.encyclopedia_id,
      name,
      scientificName,
      typeLabel,
    }),
    spiritPreview: asText(record.spiritPreview ?? record.spirit_preview, ladybugPreset.spiritPreview),
  }
}

const fileToDataUrl = (file: File, signal?: AbortSignal) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    const onAbort = () => {
      reader.abort()
      reject(new Error('identify request aborted'))
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    reader.onerror = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
      reject(new Error('failed to read image file'))
    }

    reader.onload = () => {
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('empty image data'))
        return
      }
      resolve(result)
    }

    reader.readAsDataURL(file)
  })

export async function identifySpiritImage({ file, imagePreview, signal }: IdentifyParams): Promise<SpiritIdentifyResult> {
  if (apiMode === 'mock') {
    return buildMockResult(imagePreview)
  }

  try {
    if (isCustomRemoteConfigured) {
      const formData = new FormData()
      formData.set('image', file, file.name)

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
        signal,
      })

      if (!response.ok) {
        throw new Error(`identify api failed: ${response.status}`)
      }

      const payload = await response.json()
      return normalizeRemotePayload(payload?.data ?? payload, imagePreview)
    }

    if (isBackendIdentifyConfigured && apiClient) {
      const imageDataUrl = await fileToDataUrl(file, signal)
      const payload = await apiClient.post<{ data?: unknown }>('/spirit/identify', {
        body: {
          image: imageDataUrl,
        },
        signal,
        requestKey: 'spirit-identify',
        timeoutMessage: '识图请求超时，请稍后重试。',
      })
      return normalizeRemotePayload(payload?.data ?? payload, imagePreview)
    }

    return buildMockResult(imagePreview)
  } catch {
    return buildMockResult(imagePreview)
  }
}
