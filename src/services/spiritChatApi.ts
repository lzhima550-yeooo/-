import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const chatMode = (import.meta.env.VITE_SPIRIT_CHAT_MODE ?? 'backend').trim().toLowerCase()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null
const isRemoteEnabled = chatMode !== 'mock' && Boolean(apiClient)

const toText = (value: unknown) => String(value ?? '').trim()

export interface SpiritChatMessage {
  role: 'user' | 'spirit'
  text: string
}

export interface SpiritChatRequestPayload {
  question: string
  spirit?: {
    name?: string
    scientificName?: string
    summary?: string
    keywords?: string[]
    typeLabel?: '昆虫' | '病害'
  }
  identify?: {
    name?: string
    scientificName?: string
    summary?: string
    keywords?: string[]
    typeLabel?: '昆虫' | '病害'
  }
  messages?: SpiritChatMessage[]
  orchestration?: {
    sessionId?: string
    legacySpiritSessionId?: string
    userAccount?: string
    systemPolicy?: string
    rolePack?: {
      id?: string
      name?: string
      style?: string
      persona?: string
      guardrails?: string[]
    }
    personaDesign?: {
      coreConcept?: string
      designDirection?: string
      colorPalette?: string[]
      silhouette?: string[]
      hairDesign?: string[]
      outfitElements?: string[]
      accessoryElements?: string[]
      textureMaterials?: string[]
      symbolicMotifs?: string[]
      temperament?: string[]
      pose?: string[]
      forbiddenElements?: string[]
    }
    diagnosisContext?: {
      identifyName?: string
      scientificName?: string
      riskLevel?: string
      summary?: string
      actionCards?: string[]
    }
    retrievalContext?: {
      sourceIndex?: Array<{
        title?: string
        snippet?: string
        url?: string
        confidenceLabel?: string
      }>
      treatmentTemplate?: {
        immediateActions?: string[]
        environmentAdjustments?: string[]
        followUpSchedule?: string[]
        cautionNotes?: string[]
      }
    }
    memoryContext?: {
      sessionSummary?: string
      longTermFacts?: string[]
      userPreferences?: string[]
    }
    currentIntent?: string
  }
}

export interface SpiritChatResponse {
  reply: string
  provider: string
  model: string
  conversationSessionId?: string
  memorySummaryId?: string
  debug?: {
    rolePackId: string
    rolePackName: string
    memoryHits: number
  }
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed' | 'timeout'
  message?: string
}

const emptyReply = (): SpiritChatResponse => ({
  reply: '',
  provider: '',
  model: '',
  conversationSessionId: '',
  memorySummaryId: '',
  debug: {
    rolePackId: '',
    rolePackName: '',
    memoryHits: 0,
  },
})

const normalizeReply = (value: unknown): SpiritChatResponse => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    reply: toText(record.reply),
    provider: toText(record.provider),
    model: toText(record.model),
    conversationSessionId: toText(record.conversationSessionId),
    memorySummaryId: toText(record.memorySummaryId),
    debug: {
      rolePackId: toText(record.rolePackId),
      rolePackName: toText(record.rolePackName),
      memoryHits: Number.isFinite(Number(record.memoryHits)) ? Math.max(0, Math.floor(Number(record.memoryHits))) : 0,
    },
  }
}

export const isSpiritChatRemoteConfigured = isRemoteEnabled

const streamEndpointCandidates = () => {
  const base = apiBaseUrl.replace(/\/+$/, '')
  return [`${base}/chat/stream`, `${base}/spirit/chat/stream`]
}

const openStreamResponse = async (
  payload: SpiritChatRequestPayload,
  signal?: AbortSignal,
) => {
  let latestResponse: Response | null = null

  for (const endpoint of streamEndpointCandidates()) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    })

    latestResponse = response
    if (response.ok && response.body) {
      return response
    }

    if (response.status === 404 || response.status === 405) {
      continue
    }

    return response
  }

  return latestResponse
}

export async function requestSpiritChatOnServer(payload: SpiritChatRequestPayload): Promise<RemoteResult<SpiritChatResponse>> {
  if (!isRemoteEnabled || !apiClient) {
    return {
      ok: false,
      data: emptyReply(),
      reason: 'not_configured',
      message: '未配置远程对话模式，已切换离线回复。',
    }
  }

  try {
    const response = await apiClient.post<{ data?: unknown }>('/spirit/chat', {
      body: payload,
      requestKey: 'spirit-chat',
      timeoutMessage: '灵化对话请求超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeReply(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyReply(),
      reason: 'request_failed',
      message,
    }
  }
}

const consumeSseBlock = (blockText: string) => {
  const lines = blockText.split(/\r?\n/)
  const dataLines: string[] = []

  lines.forEach((line) => {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  })

  return dataLines.join('\n').trim()
}

export async function streamSpiritChatFromServer(
  payload: SpiritChatRequestPayload,
  options?: {
    signal?: AbortSignal
    onDelta?: (chunk: string) => void
  },
): Promise<RemoteResult<SpiritChatResponse>> {
  if (!isRemoteEnabled) {
    return {
      ok: false,
      data: emptyReply(),
      reason: 'not_configured',
      message: '未配置远程流式对话，已切换离线回复。',
    }
  }

  try {
    const response = await openStreamResponse(payload, options?.signal)

    if (!response || !response.ok || !response.body) {
      return {
        ok: false,
        data: emptyReply(),
        reason: 'request_failed',
        message: `请求失败：${response?.status ?? 0}`,
      }
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let replyText = ''
    let provider = ''
    let model = ''
    let conversationSessionId = ''
    let memorySummaryId = ''
    let rolePackId = ''
    let rolePackName = ''
    let memoryHits = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      while (true) {
        const boundary = buffer.indexOf('\n\n')
        if (boundary < 0) {
          break
        }

        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const dataText = consumeSseBlock(block)
        if (!dataText) {
          continue
        }

        if (dataText === '[DONE]') {
          return {
            ok: true,
            data: {
              reply: replyText,
              provider,
              model,
              conversationSessionId,
              memorySummaryId,
              debug: {
                rolePackId,
                rolePackName,
                memoryHits,
              },
            },
          }
        }

        let payloadObject: Record<string, unknown> = {}
        try {
          payloadObject = JSON.parse(dataText) as Record<string, unknown>
        } catch {
          continue
        }

        const type = toText(payloadObject.type)
        if (type === 'delta') {
          const text = toText(payloadObject.text)
          if (text) {
            replyText += text
            options?.onDelta?.(text)
          }
        } else if (type === 'done') {
          provider = toText(payloadObject.provider)
          model = toText(payloadObject.model)
          conversationSessionId = toText(payloadObject.conversationSessionId)
          memorySummaryId = toText(payloadObject.memorySummaryId)

          const debug = payloadObject.debug && typeof payloadObject.debug === 'object' ? (payloadObject.debug as Record<string, unknown>) : {}
          rolePackId = toText(debug.rolePackId ?? payloadObject.rolePackId)
          rolePackName = toText(debug.rolePackName ?? payloadObject.rolePackName)
          const hitsRaw = Number(debug.memoryHits ?? payloadObject.memoryHits)
          memoryHits = Number.isFinite(hitsRaw) ? Math.max(0, Math.floor(hitsRaw)) : 0
        } else if (type === 'error') {
          return {
            ok: false,
            data: emptyReply(),
            reason: 'request_failed',
            message: toText(payloadObject.message) || '流式对话失败。',
          }
        }
      }
    }

    return {
      ok: replyText.length > 0,
      data: {
        reply: replyText,
        provider,
        model,
        conversationSessionId,
        memorySummaryId,
        debug: {
          rolePackId,
          rolePackName,
          memoryHits,
        },
      },
      reason: replyText.length > 0 ? undefined : 'request_failed',
      message: replyText.length > 0 ? undefined : '流式对话未返回有效内容。',
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : ''
    const isAbort = toText(text).toLowerCase().includes('abort')
    return {
      ok: false,
      data: emptyReply(),
      reason: isAbort ? 'timeout' : 'request_failed',
      message: isAbort ? '流式对话已取消。' : '流式对话请求失败，请稍后重试。',
    }
  }
}
