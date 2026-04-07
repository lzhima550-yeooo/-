import { ApiError } from './lib/errors.js'
import { createComfyuiService, resolveDefaultComfyuiWorkflowPath } from './lib/comfyuiService.js'
import { createFeedService } from './lib/feedService.js'
import { createIdentifyTaskService } from './lib/identifyTaskService.js'
import { createKnowledgeBackflowService } from './lib/knowledgeBackflowService.js'
import { createRateLimiter } from './lib/rateLimiter.js'
import { createSiliconflowService } from './lib/siliconflowService.js'
import { createSpiritGenerationConfig } from './lib/spiritGenerationConfig.js'
import { createSpiritSessionService } from './lib/spiritSessionService.js'
import { createSpiritTaskService } from './lib/spiritTaskService.js'
import { createStatsService } from './lib/statsService.js'
import {
  validateCreatePostPayload,
  validateCreateReplyPayload,
  validateIdentifyTaskPayload,
  validateKnowledgeBackflowApprovePayload,
  validateKnowledgeBackflowExtractPayload,
  validateKnowledgeBackflowRejectPayload,
  validateKnowledgeBackflowRollbackPayload,
  validateSpiritChatPayload,
  validateSpiritDraftPayload,
  validateSpiritDraftUpdatePayload,
  validateSpiritGeneratePayload,
  validateSpiritIdentifyPayload,
  validateSpiritSessionPayload,
} from './lib/validators.js'

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key, Idempotency-Key')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
}

const sendJson = (res, status, payload) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const readBody = async (req, maxBodyBytes = 8 * 1024 * 1024) => {
  const chunks = []
  let totalSize = 0

  for await (const chunk of req) {
    const bufferChunk = Buffer.from(chunk)
    totalSize += bufferChunk.length
    if (totalSize > maxBodyBytes) {
      throw new ApiError(413, 'payload too large')
    }
    chunks.push(bufferChunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'invalid json payload')
  }
}

const toNonNegativeCount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
}

const toPlainRecord = (value) => (value && typeof value === 'object' ? value : {})

const incrementCounter = (counterMap, key) => {
  const normalized = String(key ?? '').trim()
  if (!normalized) {
    return
  }

  counterMap.set(normalized, (counterMap.get(normalized) ?? 0) + 1)
}

const toCounterList = (counterMap, keyName) =>
  Array.from(counterMap.entries())
    .map(([key, count]) => ({
      [keyName]: key,
      count,
    }))
    .sort((left, right) => right.count - left.count)

const withObservabilityDimensions = (payload, dimensions) => {
  const basePayload = toPlainRecord(payload)
  return {
    ...basePayload,
    channel: String(dimensions?.channel ?? basePayload.channel ?? '').trim(),
    taskType: String(dimensions?.taskType ?? basePayload.taskType ?? '').trim(),
    status: String(dimensions?.status ?? basePayload.status ?? '').trim(),
    provider: String(dimensions?.provider ?? basePayload.provider ?? '').trim(),
    model: String(dimensions?.model ?? basePayload.model ?? '').trim(),
    latencyMs: toNonNegativeCount(dimensions?.latencyMs ?? basePayload.latencyMs),
    errorCode: String(dimensions?.errorCode ?? basePayload.errorCode ?? '').trim(),
  }
}

const buildObservabilityDimensions = (analyticsEvents, taskLogs) => {
  const channelMap = new Map()
  const providerMap = new Map()
  const modelMap = new Map()
  const taskTypeMap = new Map()
  const statusMap = new Map()
  const errorCodeMap = new Map()

  let latencyTotalMs = 0
  let latencySamples = 0
  let latencyMaxMs = 0

  const eventList = Array.isArray(analyticsEvents) ? analyticsEvents : []
  eventList.forEach((event) => {
    const payload = toPlainRecord(event?.payload)

    const channel = String(payload.channel ?? '').trim()
    const provider = String(payload.provider ?? '').trim()
    const model = String(payload.model ?? '').trim()
    const taskType = String(payload.taskType ?? '').trim()
    const status = String(payload.status ?? '').trim()
    const errorCode = String(payload.errorCode ?? '').trim()
    const latencyMs = Number(payload.latencyMs)

    incrementCounter(channelMap, channel)
    incrementCounter(providerMap, provider)
    incrementCounter(modelMap, model)
    incrementCounter(taskTypeMap, taskType)
    incrementCounter(statusMap, status)
    incrementCounter(errorCodeMap, errorCode)

    if (Number.isFinite(latencyMs) && latencyMs > 0) {
      latencyTotalMs += latencyMs
      latencySamples += 1
      if (latencyMs > latencyMaxMs) {
        latencyMaxMs = latencyMs
      }
    }
  })

  const taskLogList = Array.isArray(taskLogs) ? taskLogs : []
  taskLogList.forEach((log) => {
    incrementCounter(taskTypeMap, String(log?.taskType ?? '').trim())
    incrementCounter(statusMap, String(log?.status ?? '').trim())
  })

  return {
    channels: toCounterList(channelMap, 'channel'),
    providers: toCounterList(providerMap, 'provider'),
    models: toCounterList(modelMap, 'model'),
    taskTypes: toCounterList(taskTypeMap, 'taskType'),
    statuses: toCounterList(statusMap, 'status'),
    errorCodes: toCounterList(errorCodeMap, 'errorCode'),
    latency: {
      samples: latencySamples,
      averageMs: latencySamples > 0 ? Math.round(latencyTotalMs / latencySamples) : 0,
      maxMs: latencyMaxMs,
    },
  }
}

const resolveHeaderText = (value) => {
  if (Array.isArray(value)) {
    return String(value[0] ?? '').trim()
  }

  return String(value ?? '').trim()
}

const resolveClientId = (req) => {
  const forwardedFor = resolveHeaderText(req.headers['x-forwarded-for'])
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((item) => item.trim()).filter(Boolean)
    if (parts.length > 0) {
      return parts[0]
    }
  }

  const realIp = resolveHeaderText(req.headers['x-real-ip'])
  if (realIp) {
    return realIp
  }

  return String(req.socket?.remoteAddress ?? '').trim() || 'anonymous'
}

const resolveTraceId = (req) => {
  const traceId = resolveHeaderText(req.headers['x-trace-id'])
  if (traceId) {
    return traceId
  }

  return resolveHeaderText(req.headers['trace-id'])
}

const normalizeRatePath = (pathname) => {
  if (/^\/api\/community\/posts\/[^/]+\/replies$/.test(pathname)) {
    return '/api/community/posts/:id/replies'
  }

  if (/^\/api\/community\/backflow\/candidates\/[^/]+\/approve$/.test(pathname)) {
    return '/api/community/backflow/candidates/:id/approve'
  }

  if (/^\/api\/community\/backflow\/candidates\/[^/]+\/reject$/.test(pathname)) {
    return '/api/community/backflow/candidates/:id/reject'
  }

  if (/^\/api\/community\/backflow\/candidates\/[^/]+\/rollback$/.test(pathname)) {
    return '/api/community/backflow/candidates/:id/rollback'
  }

  if (/^\/api\/community\/backflow\/candidates\/[^/]+\/reviews$/.test(pathname)) {
    return '/api/community/backflow/candidates/:id/reviews'
  }

  if (/^\/api\/spirit\/generate\/tasks\/[^/]+$/.test(pathname)) {
    return '/api/spirit/generate/tasks/:id'
  }

  if (/^\/api\/spirit\/sessions\/[^/]+$/.test(pathname)) {
    return '/api/spirit/sessions/:id'
  }

  if (/^\/api\/identify\/tasks\/[^/]+$/.test(pathname)) {
    return '/api/identify/tasks/:id'
  }

  if (/^\/api\/spirit\/community-drafts\/[^/]+$/.test(pathname)) {
    return '/api/spirit/community-drafts/:id'
  }

  if (/^\/api\/spirit\/community-drafts\/[^/]+\/publish$/.test(pathname)) {
    return '/api/spirit/community-drafts/:id/publish'
  }

  return pathname
}

const routeNotFound = (res) => sendJson(res, 404, { error: 'not found' })

export function createApp(service, options = {}) {
  if (!service) {
    throw new Error('service is required')
  }

  const spiritService = options.spiritService ?? createComfyuiService()
  const spiritGenerationConfig =
    options.spiritGenerationConfig ??
    createSpiritGenerationConfig({
      defaultWorkflowPath: resolveDefaultComfyuiWorkflowPath(),
    })

  const siliconflowService = options.siliconflowService ?? createSiliconflowService()
  const spiritTaskService =
    options.spiritTaskService ??
    createSpiritTaskService({
      spiritService,
      onTaskChange(task) {
        if (typeof service.upsertSpiritGenerationJob !== 'function') {
          return
        }

        return service.upsertSpiritGenerationJob(task)
      },
    })
  const identifyTaskService =
    options.identifyTaskService ??
    createIdentifyTaskService({
      identifyService: siliconflowService,
      onTaskChange(task) {
        if (typeof service.upsertDiagnosisTask !== 'function') {
          return
        }

        return service.upsertDiagnosisTask(task)
      },
    })
  const spiritSessionService = options.spiritSessionService ?? createSpiritSessionService()
  const knowledgeBackflowService =
    options.knowledgeBackflowService ??
    createKnowledgeBackflowService({
      dataService: service,
    })
  const feedService = options.feedService ?? createFeedService(service)
  const statsService = options.statsService ?? createStatsService(service)
  const maxRequestBodyBytes = Math.max(
    1024 * 256,
    Number(options.maxRequestBodyBytes ?? process.env.API_MAX_BODY_BYTES ?? 8 * 1024 * 1024) || 8 * 1024 * 1024,
  )

  const defaultRateRules = {
    'POST /api/spirit/generate': { limit: 40, windowMs: 60_000 },
    'POST /api/spirit/generate/tasks': { limit: 40, windowMs: 60_000 },
    'POST /api/identify/tasks': { limit: 40, windowMs: 60_000 },
    'POST /api/spirit/identify': { limit: 40, windowMs: 60_000 },
    'POST /api/spirit/chat': { limit: 80, windowMs: 60_000 },
    'POST /api/spirit/chat/stream': { limit: 80, windowMs: 60_000 },
    'POST /api/chat/stream': { limit: 80, windowMs: 60_000 },
    'POST /api/spirit/sessions': { limit: 60, windowMs: 60_000 },
    'POST /api/spirit/community-drafts': { limit: 60, windowMs: 60_000 },
    'POST /api/spirit/community-drafts/:id/publish': { limit: 30, windowMs: 60_000 },
    'POST /api/community/posts': { limit: 30, windowMs: 60_000 },
    'POST /api/community/posts/:id/replies': { limit: 60, windowMs: 60_000 },
    'POST /api/community/backflow/extract': { limit: 20, windowMs: 60_000 },
    'POST /api/community/backflow/candidates/:id/approve': { limit: 30, windowMs: 60_000 },
    'POST /api/community/backflow/candidates/:id/reject': { limit: 30, windowMs: 60_000 },
    'POST /api/community/backflow/candidates/:id/rollback': { limit: 20, windowMs: 60_000 },
  }

  const rateLimiter = options.rateLimiter ?? createRateLimiter({ rules: options.rateLimitRules ?? defaultRateRules })

  const trackAnalyticsEvent = (eventPayload) => {
    if (typeof service.appendAnalyticsEvent !== 'function') {
      return
    }

    queueMicrotask(() => {
      Promise.resolve(service.appendAnalyticsEvent(eventPayload)).catch(() => {
        // Ignore analytics write failures to keep primary API flows available.
      })
    })
  }

  const handleChatStreamRequest = async (req, res, payload) => {
    let closed = false
    req.on('close', () => {
      closed = true
    })

    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    const writeEvent = (eventPayload) => {
      if (closed || res.writableEnded) {
        return
      }
      res.write(`data: ${JSON.stringify(eventPayload)}\n\n`)
    }

    try {
      const donePayload = await siliconflowService.chatStream(payload, {
        onDelta(deltaText) {
          writeEvent({
            type: 'delta',
            text: deltaText,
          })
        },
      })

      let persisted = null
      if (typeof service.persistChatConversation === 'function') {
        try {
          persisted = await service.persistChatConversation({
            payload,
            result: donePayload,
          })
        } catch {
          persisted = null
        }
      }

      const memoryHitsRaw = Number(persisted?.memoryHits)
      const memoryHits = Number.isFinite(memoryHitsRaw) ? Math.max(0, Math.floor(memoryHitsRaw)) : 0
      const rolePackId = String(persisted?.rolePackId ?? '').trim()
      const rolePackName = String(persisted?.rolePackName ?? '').trim()

      writeEvent({
        type: 'done',
        provider: donePayload?.provider ?? '',
        model: donePayload?.model ?? '',
        conversationSessionId: String(persisted?.conversationSessionId ?? '').trim(),
        memorySummaryId: String(persisted?.memorySummaryId ?? '').trim(),
        rolePackId,
        rolePackName,
        memoryHits,
        debug: {
          rolePackId,
          rolePackName,
          memoryHits,
        },
      })

      trackAnalyticsEvent({
        eventName: 'chat_stream_done',
        eventSource: 'api',
        userAccount: String(payload?.orchestration?.userAccount ?? '').trim(),
        sessionId: String(persisted?.conversationSessionId ?? persisted?.legacySpiritSessionId ?? '').trim(),
        traceId: resolveTraceId(req),
        payload: withObservabilityDimensions(
          {
            rolePackId,
            memoryHits,
          },
          {
            channel: 'chat',
            taskType: 'spirit_chat',
            status: 'done',
            provider: donePayload?.provider ?? '',
            model: donePayload?.model ?? '',
            latencyMs: donePayload?.latencyMs,
            errorCode: '',
          },
        ),
      })

      if (!closed && !res.writableEnded) {
        res.write('data: [DONE]\n\n')
        res.end()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'chat stream failed'
      writeEvent({
        type: 'error',
        message,
      })
      if (!closed && !res.writableEnded) {
        res.end()
      }
    }
  }

  return async (req, res) => {
    setCors(res)

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = url.pathname
      const ratePath = normalizeRatePath(pathname)
      const rate = rateLimiter.check({
        method: req.method,
        path: ratePath,
        clientId: resolveClientId(req),
      })
      if (!rate.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil(rate.retryAfterMs / 1000))
        res.setHeader('Retry-After', String(retryAfterSeconds))
        sendJson(res, 429, {
          error: 'rate limit exceeded',
          details: {
            path: ratePath,
            limit: rate.limit,
            retryAfterSeconds,
          },
        })
        return
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        const health = await service.checkHealth()
        sendJson(res, 200, health)
        return
      }

      if (req.method === 'GET' && pathname === '/api/encyclopedia') {
        const query = url.searchParams.get('q') ?? ''
        const items =
          typeof service.searchEncyclopedia === 'function'
            ? await service.searchEncyclopedia({ q: query })
            : await service.listEncyclopedia(query)
        sendJson(res, 200, { items })
        return
      }

      if (req.method === 'GET' && pathname === '/api/encyclopedia/search') {
        const q = String(url.searchParams.get('q') ?? '').trim()
        const type = String(url.searchParams.get('type') ?? '').trim()
        const risk = String(url.searchParams.get('risk') ?? '').trim()
        const category = String(url.searchParams.get('category') ?? '').trim()
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 80) || 80))

        const items =
          typeof service.searchEncyclopedia === 'function'
            ? await service.searchEncyclopedia({ q, type, risk, category, limit })
            : await service.listEncyclopedia(q)
        sendJson(res, 200, { items })
        return
      }

      const encyclopediaDetailMatch = pathname.match(/^\/api\/encyclopedia\/([^/]+)$/)
      if (req.method === 'GET' && encyclopediaDetailMatch) {
        const entryId = decodeURIComponent(encyclopediaDetailMatch[1])
        const result =
          typeof service.getEncyclopediaDetail === 'function' ? await service.getEncyclopediaDetail(entryId) : null

        if (!result) {
          throw new ApiError(404, 'encyclopedia entry not found')
        }

        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/community/posts') {
        const query = url.searchParams.get('q') ?? ''
        const items = await service.listCommunityPosts(query)
        sendJson(res, 200, { items })
        return
      }

      if (req.method === 'GET' && pathname === '/api/home/feed') {
        const result =
          typeof service.getHomeFeed === 'function' ? await service.getHomeFeed() : await feedService.getHomeFeed()
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/me/stats') {
        const account = String(url.searchParams.get('account') ?? '').trim()
        const profileName = String(url.searchParams.get('profileName') ?? '').trim()
        const favoriteCount = toNonNegativeCount(url.searchParams.get('favoriteCount'))
        const identifyCount = toNonNegativeCount(url.searchParams.get('identifyCount'))
        const result =
          typeof service.getMeStats === 'function'
            ? await service.getMeStats({ account, profileName, favoriteCount, identifyCount })
            : await statsService.getMeStats({ account, profileName, favoriteCount, identifyCount })
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/analytics/events/summary') {
        if (typeof service.getAnalyticsEventSummary !== 'function') {
          throw new ApiError(501, 'analytics summary is not implemented')
        }

        const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 7) || 7))
        const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit') ?? 2000) || 2000))
        const source = String(url.searchParams.get('source') ?? '').trim()
        const eventName = String(url.searchParams.get('eventName') ?? '').trim()
        const result = await service.getAnalyticsEventSummary({
          days,
          limit,
          source,
          eventName,
        })
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/analytics/export') {
        if (typeof service.getAnalyticsEventSummary !== 'function') {
          throw new ApiError(501, 'analytics summary is not implemented')
        }

        if (typeof service.listTaskLogs !== 'function') {
          throw new ApiError(501, 'task logs is not implemented')
        }

        const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 7) || 7))
        const limit = Math.max(1, Math.min(5000, Number(url.searchParams.get('limit') ?? 2000) || 2000))
        const source = String(url.searchParams.get('source') ?? '').trim()
        const eventName = String(url.searchParams.get('eventName') ?? '').trim()

        const taskLimit = Math.max(1, Math.min(200, Number(url.searchParams.get('taskLimit') ?? 50) || 50))
        const taskOffset = Math.max(0, Number(url.searchParams.get('taskOffset') ?? 0) || 0)
        const taskType = String(url.searchParams.get('taskType') ?? '').trim()
        const status = String(url.searchParams.get('status') ?? '').trim()
        const taskId = String(url.searchParams.get('taskId') ?? '').trim()

        const [eventsSummary, analyticsEventsRaw, taskRows] = await Promise.all([
          service.getAnalyticsEventSummary({
            days,
            limit,
            source,
            eventName,
          }),
          typeof service.listAnalyticsEvents === 'function'
            ? service.listAnalyticsEvents({
                days,
                limit,
                source,
                eventName,
              })
            : Promise.resolve([]),
          service.listTaskLogs({
            limit: taskLimit + 1,
            offset: taskOffset,
            taskType,
            status,
            taskId,
          }),
        ])

        const hasMore = taskRows.length > taskLimit
        const taskItems = hasMore ? taskRows.slice(0, taskLimit) : taskRows
        const observability = buildObservabilityDimensions(analyticsEventsRaw, taskItems)

        sendJson(res, 200, {
          data: {
            generatedAt: new Date().toISOString(),
            query: {
              days,
              limit,
              source,
              eventName,
              taskLimit,
              taskOffset,
              taskType,
              status,
              taskId,
            },
            eventsSummary,
            taskLogs: {
              items: taskItems,
              page: {
                limit: taskLimit,
                offset: taskOffset,
                hasMore,
                nextOffset: hasMore ? taskOffset + taskLimit : null,
              },
            },
            observability,
          },
        })
        return
      }

      if (req.method === 'GET' && pathname === '/api/analytics/task-logs') {
        if (typeof service.listTaskLogs !== 'function') {
          throw new ApiError(501, 'task logs is not implemented')
        }

        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50))
        const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0)
        const taskType = String(url.searchParams.get('taskType') ?? '').trim()
        const status = String(url.searchParams.get('status') ?? '').trim()
        const taskId = String(url.searchParams.get('taskId') ?? '').trim()
        const rows = await service.listTaskLogs({
          limit: limit + 1,
          offset,
          taskType,
          status,
          taskId,
        })
        const hasMore = rows.length > limit
        const items = hasMore ? rows.slice(0, limit) : rows
        sendJson(res, 200, {
          items,
          page: {
            limit,
            offset,
            hasMore,
            nextOffset: hasMore ? offset + limit : null,
          },
        })
        return
      }

      if (req.method === 'POST' && pathname === '/api/community/posts') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateCreatePostPayload(body)
        const result = await service.createCommunityPost(payload)
        trackAnalyticsEvent({
          eventName: 'community_post_publish',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          payload: {
            postId: result?.id,
            topicCount: Array.isArray(payload?.topics) ? payload.topics.length : 0,
          },
        })
        sendJson(res, 201, result)
        return
      }

      if (req.method === 'POST' && pathname === '/api/community/backflow/extract') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateKnowledgeBackflowExtractPayload(body)
        const result =
          typeof service.generateKnowledgeBackflowCandidates === 'function'
            ? await service.generateKnowledgeBackflowCandidates(payload)
            : await knowledgeBackflowService.generateCandidates(payload)
        trackAnalyticsEvent({
          eventName: 'community_backflow_extract',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          payload: {
            q: payload.q,
            minQualityScore: payload.minQualityScore,
            limit: payload.limit,
            generatedCount: Number(result?.generatedCount ?? 0) || 0,
            insertedCount: Number(result?.insertedCount ?? 0) || 0,
          },
        })
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/community/backflow/candidates') {
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50))
        const status = String(url.searchParams.get('status') ?? '').trim()
        const candidateType = String(url.searchParams.get('candidateType') ?? '').trim()
        const lifecycleState = String(url.searchParams.get('lifecycleState') ?? '').trim()
        const items =
          typeof service.listKnowledgeBackflowCandidates === 'function'
            ? await service.listKnowledgeBackflowCandidates({ limit, status, candidateType, lifecycleState })
            : await knowledgeBackflowService.listCandidates({ limit, status, candidateType, lifecycleState })
        sendJson(res, 200, { items })
        return
      }

      const backflowApproveMatch = pathname.match(/^\/api\/community\/backflow\/candidates\/([^/]+)\/approve$/)
      if (req.method === 'POST' && backflowApproveMatch) {
        const candidateId = decodeURIComponent(backflowApproveMatch[1])
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateKnowledgeBackflowApprovePayload(body)
        const result =
          typeof service.approveKnowledgeBackflowCandidate === 'function'
            ? await service.approveKnowledgeBackflowCandidate(candidateId, payload)
            : await knowledgeBackflowService.approveCandidate(candidateId, payload)
        trackAnalyticsEvent({
          eventName: 'community_backflow_approve',
          eventSource: 'api',
          userAccount: payload.approvedBy,
          traceId: resolveTraceId(req),
          payload: {
            candidateId,
            entryId: payload.entryId,
            reused: Boolean(result?.reused),
          },
        })
        sendJson(res, 200, { data: result })
        return
      }

      const backflowRejectMatch = pathname.match(/^\/api\/community\/backflow\/candidates\/([^/]+)\/reject$/)
      if (req.method === 'POST' && backflowRejectMatch) {
        const candidateId = decodeURIComponent(backflowRejectMatch[1])
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateKnowledgeBackflowRejectPayload(body)
        const result =
          typeof service.rejectKnowledgeBackflowCandidate === 'function'
            ? await service.rejectKnowledgeBackflowCandidate(candidateId, payload)
            : await knowledgeBackflowService.rejectCandidate(candidateId, payload)
        trackAnalyticsEvent({
          eventName: 'community_backflow_reject',
          eventSource: 'api',
          userAccount: payload.rejectedBy,
          traceId: resolveTraceId(req),
          payload: {
            candidateId,
          },
        })
        sendJson(res, 200, { data: result })
        return
      }

      const backflowRollbackMatch = pathname.match(/^\/api\/community\/backflow\/candidates\/([^/]+)\/rollback$/)
      if (req.method === 'POST' && backflowRollbackMatch) {
        const candidateId = decodeURIComponent(backflowRollbackMatch[1])
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateKnowledgeBackflowRollbackPayload(body)
        const result =
          typeof service.rollbackKnowledgeBackflowCandidate === 'function'
            ? await service.rollbackKnowledgeBackflowCandidate(candidateId, payload)
            : await knowledgeBackflowService.rollbackCandidate(candidateId, payload)
        trackAnalyticsEvent({
          eventName: 'community_backflow_rollback',
          eventSource: 'api',
          userAccount: payload.rolledBackBy,
          traceId: resolveTraceId(req),
          payload: {
            candidateId,
            rollbackToReviewId: payload.rollbackToReviewId,
          },
        })
        sendJson(res, 200, { data: result })
        return
      }

      const backflowReviewsMatch = pathname.match(/^\/api\/community\/backflow\/candidates\/([^/]+)\/reviews$/)
      if (req.method === 'GET' && backflowReviewsMatch) {
        const candidateId = decodeURIComponent(backflowReviewsMatch[1])
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 20) || 20))
        const items =
          typeof service.listKnowledgeBackflowReviews === 'function'
            ? await service.listKnowledgeBackflowReviews({ candidateId, limit })
            : await knowledgeBackflowService.listReviews({ candidateId, limit })
        sendJson(res, 200, { items })
        return
      }

      const replyMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/replies$/)
      if (req.method === 'POST' && replyMatch) {
        const postId = decodeURIComponent(replyMatch[1])
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateCreateReplyPayload(body)
        const result = await service.createCommunityReply(postId, payload)
        trackAnalyticsEvent({
          eventName: 'community_reply_publish',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          payload: {
            postId,
            replyId: result?.id,
            role: payload.role,
          },
        })
        sendJson(res, 201, result)
        return
      }

      if (req.method === 'GET' && pathname === '/api/spirit/config') {
        const result = spiritGenerationConfig.listConfig()
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/spirit/workflow/validate') {
        if (typeof spiritService.validateWorkflowProfile !== 'function') {
          throw new ApiError(503, 'workflow validation is not available')
        }

        const config = spiritGenerationConfig.listConfig()
        const workflowId = String(url.searchParams.get('workflowId') ?? '').trim()
        const workflowPath = String(url.searchParams.get('workflowPath') ?? '').trim()
        const payload = {
          name: String(url.searchParams.get('name') ?? '').trim(),
          scientificName: String(url.searchParams.get('scientificName') ?? '').trim(),
          keywords: String(url.searchParams.get('keywords') ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }

        let targets = []
        if (workflowPath) {
          targets = [
            {
              id: workflowId || 'adhoc',
              label: workflowId || 'adhoc',
              path: workflowPath,
            },
          ]
        } else {
          const workflows = Array.isArray(config?.workflows) ? config.workflows : []
          if (workflowId) {
            const matched = workflows.find((item) => String(item?.id ?? '').trim() === workflowId)
            if (!matched) {
              throw new ApiError(404, 'workflow profile not found')
            }
            targets = [matched]
          } else {
            targets = workflows
          }
        }

        const items = await Promise.all(
          targets.map(async (workflow) => {
            const validation = await spiritService.validateWorkflowProfile({
              workflowPath: String(workflow?.path ?? '').trim(),
              payload,
            })

            return {
              id: String(workflow?.id ?? '').trim(),
              label: String(workflow?.label ?? '').trim(),
              path: String(workflow?.path ?? '').trim(),
              ...validation,
            }
          }),
        )

        sendJson(res, 200, {
          data: {
            items,
            validatedAt: new Date().toISOString(),
          },
        })
        return
      }

      if (req.method === 'POST' && pathname === '/api/identify/tasks') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateIdentifyTaskPayload(body)
        const result = identifyTaskService.createIdentifyTask(payload)
        trackAnalyticsEvent({
          eventName: 'identify_submit',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          payload: withObservabilityDimensions(
            {
              taskId: result?.id,
              hasPrompt: Boolean(payload.prompt),
            },
            {
              channel: 'identify',
              taskType: 'diagnosis_identify',
              status: 'submitted',
              provider: '',
              model: '',
              latencyMs: 0,
              errorCode: '',
            },
          ),
        })
        sendJson(res, 202, { data: result })
        return
      }

      const identifyTaskMatch = pathname.match(/^\/api\/identify\/tasks\/([^/]+)$/)
      if (req.method === 'GET' && identifyTaskMatch) {
        const taskId = decodeURIComponent(identifyTaskMatch[1])
        const memoryTask = identifyTaskService.getIdentifyTask(taskId)
        const result =
          memoryTask ||
          (typeof service.getDiagnosisTask === 'function' ? await service.getDiagnosisTask(taskId) : null)

        if (!result) {
          throw new ApiError(404, 'identify task not found')
        }

        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'POST' && pathname === '/api/spirit/identify') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateSpiritIdentifyPayload(body)
        const result = await siliconflowService.identifyImage(payload)
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'POST' && pathname === '/api/spirit/chat') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateSpiritChatPayload(body)
        const result = await siliconflowService.chat(payload)
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'POST' && (pathname === '/api/spirit/chat/stream' || pathname === '/api/chat/stream')) {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateSpiritChatPayload(body)
        await handleChatStreamRequest(req, res, payload)
        return
      }

      if (req.method === 'GET' && pathname === '/api/spirit/comfyui/view') {
        if (typeof spiritService.fetchViewImage !== 'function') {
          throw new ApiError(503, 'comfyui image proxy unavailable')
        }

        const filename = String(url.searchParams.get('filename') ?? '').trim()
        const type = String(url.searchParams.get('type') ?? 'output').trim() || 'output'
        const subfolder = String(url.searchParams.get('subfolder') ?? '').trim()
        const image = await spiritService.fetchViewImage({
          filename,
          type,
          subfolder,
        })

        res.statusCode = 200
        res.setHeader('Content-Type', image.contentType || 'application/octet-stream')
        if (image.cacheControl) {
          res.setHeader('Cache-Control', image.cacheControl)
        }
        if (image.etag) {
          res.setHeader('ETag', image.etag)
        }
        if (image.lastModified) {
          res.setHeader('Last-Modified', image.lastModified)
        }
        res.end(image.bytes)
        return
      }

      if (req.method === 'POST' && pathname === '/api/spirit/generate') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateSpiritGeneratePayload(body)
        const resolvedPayload = spiritGenerationConfig.resolvePayload(payload)
        const result = await spiritService.generateSpiritPortrait(resolvedPayload)
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'POST' && pathname === '/api/spirit/generate/tasks') {
        const body = await readBody(req, maxRequestBodyBytes)
        const idempotencyKey =
          resolveHeaderText(req.headers['x-idempotency-key']) ||
          resolveHeaderText(req.headers['idempotency-key']) ||
          String(body?.idempotencyKey ?? '').trim()
        const payload = validateSpiritGeneratePayload(body)
        const resolvedPayload = spiritGenerationConfig.resolvePayload(payload)
        const result = await spiritTaskService.createGenerationTask(resolvedPayload, { idempotencyKey })
        trackAnalyticsEvent({
          eventName: 'spirit_generate_submit',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          payload: withObservabilityDimensions(
            {
              taskId: result?.id,
              idempotencyKey,
              presetId: resolvedPayload?.presetId ?? '',
              workflowId: resolvedPayload?.workflowId ?? '',
            },
            {
              channel: 'generation',
              taskType: 'spirit_generation',
              status: 'submitted',
              provider: '',
              model: '',
              latencyMs: 0,
              errorCode: '',
            },
          ),
        })
        sendJson(res, 202, { data: result })
        return
      }

      const spiritTaskMatch = pathname.match(/^\/api\/spirit\/generate\/tasks\/([^/]+)$/)
      if (req.method === 'GET' && spiritTaskMatch) {
        const taskId = decodeURIComponent(spiritTaskMatch[1])
        const result = await spiritTaskService.getGenerationTask(taskId)
        if (!result) {
          throw new ApiError(404, 'spirit generation task not found')
        }

        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/spirit/stats') {
        const result =
          typeof service.getSpiritGenerationStats === 'function'
            ? await service.getSpiritGenerationStats()
            : spiritTaskService.getGenerationStats()
        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'POST' && pathname === '/api/spirit/sessions') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateSpiritSessionPayload(body)
        const taskId = payload.generation.taskId
        const task = taskId ? spiritTaskService.getGenerationTask(taskId) : null

        const resolvedGeneration = {
          ...payload.generation,
          taskId: payload.generation.taskId || task?.id || '',
          status: payload.generation.status || task?.status || '',
          imageUrl: payload.generation.imageUrl || task?.result?.imageUrl || '',
          promptId: payload.generation.promptId || task?.result?.promptId || '',
          durationMs:
            payload.generation.durationMs > 0
              ? payload.generation.durationMs
              : Number.isFinite(Number(task?.durationMs))
                ? Number(task.durationMs)
                : 0,
        }

        const result =
          typeof service.createSpiritSession === 'function'
            ? await service.createSpiritSession({
                identify: payload.identify,
                generation: resolvedGeneration,
                messages: payload.messages,
              })
            : spiritSessionService.createSession({
                identify: payload.identify,
                generation: resolvedGeneration,
                messages: payload.messages,
              })
        trackAnalyticsEvent({
          eventName: 'spirit_session_create',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          sessionId: result?.id,
          payload: {
            identifyTaskId: payload.identify.taskId || '',
            generationTaskId: resolvedGeneration.taskId,
            messageCount: Array.isArray(payload.messages) ? payload.messages.length : 0,
            artifacts: {
              identifyTaskId: payload.identify.taskId || '',
              generationTaskId: resolvedGeneration.taskId,
              sessionId: result?.id || '',
            },
          },
        })

        sendJson(res, 201, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/spirit/sessions') {
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 20) || 20))
        const items =
          typeof service.listSpiritSessions === 'function'
            ? await service.listSpiritSessions(limit)
            : spiritSessionService.listSessions(limit)

        sendJson(res, 200, { items })
        return
      }

      const spiritSessionMatch = pathname.match(/^\/api\/spirit\/sessions\/([^/]+)$/)
      if (req.method === 'GET' && spiritSessionMatch) {
        const sessionId = decodeURIComponent(spiritSessionMatch[1])
        const result =
          typeof service.getSpiritSession === 'function'
            ? await service.getSpiritSession(sessionId)
            : spiritSessionService.getSession(sessionId)

        if (!result) {
          throw new ApiError(404, 'spirit session not found')
        }

        sendJson(res, 200, { data: result })
        return
      }

      if (req.method === 'POST' && pathname === '/api/spirit/community-drafts') {
        const body = await readBody(req, maxRequestBodyBytes)
        const payload = validateSpiritDraftPayload(body)
        const result =
          typeof service.createSpiritCommunityDraft === 'function'
            ? await service.createSpiritCommunityDraft(payload)
            : spiritSessionService.createCommunityDraft(payload)

        if (!result) {
          throw new ApiError(404, 'spirit session not found')
        }

        const draftSession =
          typeof service.getSpiritSession === 'function'
            ? await service.getSpiritSession(result?.sessionId)
            : spiritSessionService.getSession(result?.sessionId)
        const identifyTaskId = String(draftSession?.identify?.taskId ?? '').trim()

        trackAnalyticsEvent({
          eventName: 'spirit_draft_create',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          sessionId: result?.sessionId,
          payload: {
            draftId: result?.id,
            topicCount: Array.isArray(result?.topics) ? result.topics.length : 0,
            identifyTaskId,
            artifacts: {
              identifyTaskId,
              draftId: result?.id || '',
              sessionId: result?.sessionId || '',
            },
          },
        })

        sendJson(res, 201, { data: result })
        return
      }

      if (req.method === 'GET' && pathname === '/api/spirit/community-drafts') {
        const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? 50) || 50))
        const status = String(url.searchParams.get('status') ?? '').trim()
        const items =
          typeof service.listSpiritCommunityDrafts === 'function'
            ? await service.listSpiritCommunityDrafts({ limit, status })
            : spiritSessionService.listCommunityDrafts(limit, status)

        sendJson(res, 200, { items })
        return
      }

      const spiritDraftPublishMatch = pathname.match(/^\/api\/spirit\/community-drafts\/([^/]+)\/publish$/)
      if (req.method === 'POST' && spiritDraftPublishMatch) {
        const draftId = decodeURIComponent(spiritDraftPublishMatch[1])

        const result =
          typeof service.publishSpiritCommunityDraft === 'function'
            ? await service.publishSpiritCommunityDraft(draftId)
            : await (async () => {
                const draft = spiritSessionService.getCommunityDraft(draftId)
                if (!draft) {
                  throw new ApiError(404, 'spirit community draft not found')
                }

                if (draft.status === 'published' && draft.publishedPostId) {
                  return {
                    draft,
                    postId: draft.publishedPostId,
                    reused: true,
                  }
                }

                const createdPost = await service.createCommunityPost({
                  title: draft.title,
                  content: draft.content,
                  markdown: draft.markdown || draft.content,
                  image: draft.image || undefined,
                  topics: draft.topics,
                  mentions: draft.mentions,
                })

                const updatedDraft = spiritSessionService.markCommunityDraftPublished(draftId, createdPost.id)
                if (!updatedDraft) {
                  throw new ApiError(500, 'publish spirit community draft failed')
                }

                return {
                  draft: updatedDraft,
                  postId: createdPost.id,
                  reused: false,
                }
              })()

        const publishSession =
          typeof service.getSpiritSession === 'function'
            ? await service.getSpiritSession(result?.draft?.sessionId)
            : spiritSessionService.getSession(result?.draft?.sessionId)
        const identifyTaskId = String(publishSession?.identify?.taskId ?? '').trim()

        trackAnalyticsEvent({
          eventName: 'spirit_draft_publish',
          eventSource: 'api',
          traceId: resolveTraceId(req),
          sessionId: result?.draft?.sessionId,
          payload: {
            draftId,
            postId: result?.postId,
            reused: Boolean(result?.reused),
            identifyTaskId,
            artifacts: {
              identifyTaskId,
              draftId,
              postId: result?.postId || '',
              sessionId: result?.draft?.sessionId || '',
            },
          },
        })

        sendJson(res, 200, { data: result })
        return
      }

      const spiritDraftMatch = pathname.match(/^\/api\/spirit\/community-drafts\/([^/]+)$/)
      if (spiritDraftMatch) {
        const draftId = decodeURIComponent(spiritDraftMatch[1])

        if (req.method === 'GET') {
          const result =
            typeof service.getSpiritCommunityDraft === 'function'
              ? await service.getSpiritCommunityDraft(draftId)
              : spiritSessionService.getCommunityDraft(draftId)

          if (!result) {
            throw new ApiError(404, 'spirit community draft not found')
          }

          sendJson(res, 200, { data: result })
          return
        }

        if (req.method === 'PATCH') {
          const body = await readBody(req, maxRequestBodyBytes)
          const payload = validateSpiritDraftUpdatePayload(body)
          const result =
            typeof service.updateSpiritCommunityDraft === 'function'
              ? await service.updateSpiritCommunityDraft(draftId, payload)
              : spiritSessionService.updateCommunityDraft(draftId, payload)

          if (!result) {
            throw new ApiError(404, 'spirit community draft not found')
          }

          sendJson(res, 200, { data: result })
          return
        }
      }

      if (req.method === 'GET' && pathname === '/api/spirit/runtime') {
        const result = await spiritService.getRuntimeStatus()
        sendJson(res, 200, { data: result })
        return
      }

      routeNotFound(res)
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500
      const message = error instanceof Error ? error.message : 'internal server error'
      const details = error instanceof ApiError ? error.details : null
      sendJson(res, status, { error: message, details })
    }
  }
}
