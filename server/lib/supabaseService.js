import { ApiError } from './errors.js'
import { buildKnowledgeBackflowCandidates } from './knowledgeBackflowService.js'
import { mapCommunityAnswer, mapCommunityPost, mapEncyclopediaRecord } from './mappers.js'
import { buildSpiritCommunityDraft } from './spiritDraftBuilder.js'

const safeText = (value) => String(value ?? '').trim()

const ensureEnv = (supabaseUrl, serviceRoleKey) => {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new ApiError(500, 'supabase env is not configured')
  }
}

const buildQuery = (query) => {
  const params = new URLSearchParams()

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  })

  return params.toString()
}

const encodeInList = (values) => values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(',')

const toIsoOrEmpty = (value) => {
  const text = safeText(value)
  if (!text) {
    return ''
  }

  const date = new Date(text)
  if (Number.isNaN(date.valueOf())) {
    return text
  }

  return date.toISOString()
}

const toCount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
}

const toRiskLabel = (value) => {
  const normalized = safeText(value).toLowerCase()
  if (normalized === 'high' || value === '高') {
    return '高'
  }

  if (normalized === 'medium' || value === '中') {
    return '中'
  }

  return '低'
}

const toRiskCode = (value) => {
  const normalized = safeText(value).toLowerCase()
  if (normalized === 'high' || value === '高') {
    return 'high'
  }

  if (normalized === 'medium' || value === '中') {
    return 'medium'
  }

  if (normalized === 'low' || value === '低') {
    return 'low'
  }

  return ''
}

const asStringList = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean)
}

const asJsonRecord = (value) => (value && typeof value === 'object' ? value : {})
const mergeStringLists = (...values) => {
  const seen = new Set()
  const output = []
  values.forEach((value) => {
    asStringList(value).forEach((item) => {
      const normalized = safeText(item)
      if (!normalized || seen.has(normalized)) {
        return
      }
      seen.add(normalized)
      output.push(normalized)
    })
  })
  return output
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isUuidText = (value) => uuidPattern.test(safeText(value))

const buildRollingSummary = ({ question, reply, sessionSummary, longTermFacts }) => {
  const normalizedSummary = safeText(sessionSummary)
  if (normalizedSummary) {
    return normalizedSummary
  }

  const facts = asStringList(longTermFacts).slice(0, 3)
  const parts = []
  if (question) {
    parts.push(`用户问题：${question}`)
  }
  if (reply) {
    parts.push(`助手回复：${reply}`)
  }
  if (facts.length > 0) {
    parts.push(`记忆线索：${facts.join('；')}`)
  }

  return parts.join('。') || '本轮对话已记录。'
}

const mapSpiritSession = (row) => {
  const identify = asJsonRecord(row?.identify)
  const generation = asJsonRecord(row?.generation)

  return {
    id: safeText(row?.id),
    identify: {
      taskId: safeText(identify.taskId),
      name: safeText(identify.name),
      scientificName: safeText(identify.scientificName),
      sourceRefs: asStringList(identify.sourceRefs).slice(0, 20),
      keywords: asStringList(identify.keywords).slice(0, 16),
      summary: safeText(identify.summary),
      cover: safeText(identify.cover),
      encyclopediaId: safeText(identify.encyclopediaId),
      provider: safeText(identify.provider),
      model: safeText(identify.model),
    },
    generation: {
      taskId: safeText(generation.taskId),
      status: safeText(generation.status),
      imageUrl: safeText(generation.imageUrl),
      promptId: safeText(generation.promptId),
      prompt: safeText(generation.prompt),
      negativePrompt: safeText(generation.negativePrompt),
      durationMs: Number.isFinite(Number(generation.durationMs)) ? Math.max(0, Number(generation.durationMs)) : 0,
      presetId: safeText(generation.presetId),
      workflowId: safeText(generation.workflowId),
      workflowPath: safeText(generation.workflowPath),
      workflowMode: safeText(generation.workflowMode),
      workflowFallbackReason: safeText(generation.workflowFallbackReason),
      routingRuleId: safeText(generation.routingRuleId),
      routingRuleLabel: safeText(generation.routingRuleLabel),
      routingMatchedKeywords: asStringList(generation.routingMatchedKeywords).slice(0, 12),
    },
    messages: Array.isArray(row?.messages)
      ? row.messages
          .map((item) => {
            const record = asJsonRecord(item)
            const text = safeText(record.text)
            if (!text) {
              return null
            }

            return {
              id: safeText(record.id),
              role: record.role === 'user' ? 'user' : 'spirit',
              text,
            }
          })
          .filter(Boolean)
      : [],
    draftCount: Number.isFinite(Number(row?.draft_count)) ? Number(row.draft_count) : 0,
    lastDraftAt: toIsoOrEmpty(row?.last_draft_at),
    createdAt: toIsoOrEmpty(row?.created_at),
    updatedAt: toIsoOrEmpty(row?.updated_at),
  }
}

const mapSpiritDraft = (row) => {
  return {
    id: safeText(row?.id),
    sessionId: safeText(row?.session_id),
    title: safeText(row?.title),
    content: safeText(row?.content),
    markdown: safeText(row?.markdown),
    image: safeText(row?.image_url),
    mentions: asStringList(row?.mentions),
    topics: asStringList(row?.topics),
    status: safeText(row?.status) || 'draft',
    publishedPostId: safeText(row?.published_post_id),
    publishedAt: toIsoOrEmpty(row?.published_at),
    createdAt: toIsoOrEmpty(row?.created_at),
    updatedAt: toIsoOrEmpty(row?.updated_at),
  }
}

const mapSpiritGenerationJob = (row) => {
  return {
    id: safeText(row?.id),
    status: safeText(row?.status),
    requestPayload: asJsonRecord(row?.request_payload),
    resultPayload: asJsonRecord(row?.result_payload),
    error: safeText(row?.error),
    startedAt: toIsoOrEmpty(row?.started_at),
    finishedAt: toIsoOrEmpty(row?.finished_at),
    durationMs: Number.isFinite(Number(row?.duration_ms)) ? Math.max(0, Number(row.duration_ms)) : 0,
    createdAt: toIsoOrEmpty(row?.created_at),
    updatedAt: toIsoOrEmpty(row?.updated_at),
  }
}

const mapDiagnosisActionCard = (row) => ({
  id: safeText(row?.id),
  type: safeText(row?.card_type),
  title: safeText(row?.title),
  description: safeText(row?.description),
  ctaLabel: safeText(row?.cta_label),
  ctaRoute: safeText(row?.cta_route),
  priority: Number.isFinite(Number(row?.priority)) ? Number(row.priority) : 0,
})

const mapDiagnosisTask = (taskRow, resultRow, actionRows) => {
  const topResult = asJsonRecord(taskRow?.top_result)
  const identify = asJsonRecord(resultRow?.normalized_payload)

  return {
    id: safeText(taskRow?.id),
    type: 'diagnosis_identify',
    status: safeText(taskRow?.status) || 'pending',
    createdAt: toIsoOrEmpty(taskRow?.created_at),
    updatedAt: toIsoOrEmpty(taskRow?.updated_at),
    startedAt: toIsoOrEmpty(taskRow?.started_at),
    finishedAt: toIsoOrEmpty(taskRow?.finished_at),
    durationMs: Number.isFinite(Number(taskRow?.duration_ms)) ? Math.max(0, Number(taskRow.duration_ms)) : 0,
    payload: asJsonRecord(taskRow?.input_payload),
    rawResult: asJsonRecord(resultRow?.raw_payload),
    identify: identify,
    topResult: {
      name: safeText(topResult.name),
      category: safeText(topResult.category) || '虫害',
      confidence: Number.isFinite(Number(topResult.confidence)) ? Number(topResult.confidence) : 0,
      evidenceTags: asStringList(topResult.evidenceTags).slice(0, 8),
    },
    riskLevel: safeText(taskRow?.risk_level) || 'medium',
    actionCards: Array.isArray(actionRows) ? actionRows.map((row) => mapDiagnosisActionCard(row)) : [],
    encyclopediaRefs: asStringList(taskRow?.encyclopedia_refs),
    sourceRefs: asStringList(taskRow?.source_refs),
    error: safeText(taskRow?.error),
    failureReason: safeText(taskRow?.error),
  }
}

const mapSourceIndexItem = (row) => {
  const score = Number(row?.confidence_score)
  let confidenceLabel = '中'
  if (Number.isFinite(score) && score >= 80) {
    confidenceLabel = '高'
  } else if (Number.isFinite(score) && score < 55) {
    confidenceLabel = '低'
  }

  return {
    id: safeText(row?.id),
    sourceType: safeText(row?.source_type) || 'reference',
    title: safeText(row?.source_title) || '资料来源',
    url: safeText(row?.source_url),
    snippet: safeText(row?.snippet),
    confidenceScore: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 60,
    confidenceLabel,
  }
}

const mapTreatmentTemplate = (row, entryId) => {
  return {
    entryId: safeText(row?.entry_id) || safeText(entryId),
    immediateActions: asStringList(row?.immediate_actions),
    environmentAdjustments: asStringList(row?.environment_adjustments),
    followUpSchedule: asStringList(row?.follow_up_schedule),
    cautionNotes: asStringList(row?.caution_notes),
  }
}

const mapKnowledgeBackflowCandidate = (row) => {
  return {
    id: safeText(row?.id),
    candidateType: safeText(row?.candidate_type),
    sourcePostId: safeText(row?.source_post_id),
    sourceAnswerId: safeText(row?.source_answer_id),
    entryHint: safeText(row?.entry_hint),
    entryId: safeText(row?.entry_id),
    title: safeText(row?.title),
    snippet: safeText(row?.snippet),
    qualityScore: Number.isFinite(Number(row?.quality_score)) ? Number(row.quality_score) : 0,
    status: safeText(row?.status) || 'pending',
    lifecycleState: safeText(row?.lifecycle_state),
    proposedPayload: asJsonRecord(row?.proposed_payload),
    conflictDetail: asJsonRecord(row?.conflict_detail),
    approvedBy: safeText(row?.approved_by),
    approvedAt: toIsoOrEmpty(row?.approved_at),
    reviewNote: safeText(row?.review_note),
    lastReviewAt: toIsoOrEmpty(row?.last_review_at),
    createdAt: toIsoOrEmpty(row?.created_at),
    updatedAt: toIsoOrEmpty(row?.updated_at),
  }
}

const mapKnowledgeBackflowReview = (row) => {
  return {
    id: safeText(row?.id),
    candidateId: safeText(row?.candidate_id),
    action: safeText(row?.action),
    reviewer: safeText(row?.reviewer),
    reviewNote: safeText(row?.review_note),
    statusBefore: safeText(row?.status_before),
    statusAfter: safeText(row?.status_after),
    reviewPayload: asJsonRecord(row?.review_payload),
    createdAt: toIsoOrEmpty(row?.created_at),
  }
}

const mapTaskLog = (row) => {
  return {
    id: safeText(row?.id),
    taskType: safeText(row?.task_type),
    taskId: safeText(row?.task_id),
    status: safeText(row?.status),
    attempt: Number.isFinite(Number(row?.attempt)) ? Number(row.attempt) : 0,
    durationMs: Number.isFinite(Number(row?.duration_ms)) ? Number(row.duration_ms) : 0,
    error: safeText(row?.error),
    payload: asJsonRecord(row?.payload),
    createdAt: toIsoOrEmpty(row?.created_at),
  }
}

const mapAnalyticsEvent = (row) => {
  return {
    id: safeText(row?.id),
    eventName: safeText(row?.event_name),
    eventSource: safeText(row?.event_source),
    userAccount: safeText(row?.user_account),
    sessionId: safeText(row?.session_id),
    traceId: safeText(row?.trace_id),
    payload: asJsonRecord(row?.event_payload),
    createdAt: toIsoOrEmpty(row?.created_at),
  }
}

export function createSupabaseService({
  supabaseUrl = process.env.SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetchImpl = fetch,
} = {}) {
  const baseUrl = safeText(supabaseUrl).replace(/\/+$/, '')
  const apiKey = safeText(serviceRoleKey)

  const request = async (table, options = {}) => {
    ensureEnv(baseUrl, apiKey)

    const query = buildQuery(options.query)
    const endpoint = `${baseUrl}/rest/v1/${table}${query ? `?${query}` : ''}`

    const headers = {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...options.headers,
    }

    const response = await fetchImpl(endpoint, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!response.ok) {
      let payload = ''
      try {
        payload = await response.text()
      } catch {
        payload = ''
      }

      throw new ApiError(500, `supabase request failed: ${response.status}`, payload)
    }

    if (response.status === 204) {
      return null
    }

    return response.json()
  }

  const findSpiritSession = async (sessionId) => {
    const rows = await request('spirit_sessions', {
      query: {
        select: 'id,identify,generation,messages,draft_count,last_draft_at,created_at,updated_at',
        id: `eq.${sessionId}`,
        limit: 1,
      },
    })

    const row = Array.isArray(rows) ? rows[0] : null
    return row ? mapSpiritSession(row) : null
  }

  const findSpiritDraft = async (draftId) => {
    const rows = await request('spirit_community_drafts', {
      query: {
        select: 'id,session_id,title,content,markdown,image_url,mentions,topics,status,published_post_id,published_at,created_at,updated_at',
        id: `eq.${draftId}`,
        limit: 1,
      },
    })

    const row = Array.isArray(rows) ? rows[0] : null
    return row ? mapSpiritDraft(row) : null
  }

  const findDiagnosisTask = async (taskId) => {
    const rows = await request('diagnosis_tasks', {
      query: {
        select:
          'id,status,input_payload,top_result,risk_level,encyclopedia_refs,source_refs,error,started_at,finished_at,duration_ms,created_at,updated_at',
        id: `eq.${taskId}`,
        limit: 1,
      },
    })

    const taskRow = Array.isArray(rows) ? rows[0] : null
    if (!taskRow) {
      return null
    }

    const resultRows = await request('diagnosis_results', {
      query: {
        select: 'id,task_id,raw_payload,normalized_payload,provider,model,created_at,updated_at',
        task_id: `eq.${taskId}`,
        limit: 1,
      },
    })
    const resultRow = Array.isArray(resultRows) ? resultRows[0] : null

    const actionRows =
      (await request('action_cards', {
        query: {
          select: 'id,task_id,card_type,title,description,cta_label,cta_route,priority,created_at',
          task_id: `eq.${taskId}`,
          order: 'priority.desc,created_at.asc',
          limit: 30,
        },
      })) ?? []

    return mapDiagnosisTask(taskRow, resultRow, actionRows)
  }

  const findKnowledgeBackflowCandidate = async (candidateId) => {
    const rows = await request('knowledge_backflow_candidates', {
      query: {
        select:
          'id,candidate_type,source_post_id,source_answer_id,entry_hint,entry_id,title,snippet,quality_score,proposed_payload,status,lifecycle_state,conflict_detail,approved_by,approved_at,review_note,last_review_at,created_at,updated_at',
        id: `eq.${candidateId}`,
        limit: 1,
      },
    })

    const row = Array.isArray(rows) ? rows[0] : null
    return row ? mapKnowledgeBackflowCandidate(row) : null
  }

  const findKnowledgeBackflowReview = async (reviewId) => {
    const normalizedReviewId = safeText(reviewId)
    if (!normalizedReviewId) {
      return null
    }

    const rows = await request('knowledge_backflow_reviews', {
      query: {
        select: 'id,candidate_id,action,reviewer,review_note,status_before,status_after,review_payload,created_at',
        id: `eq.${normalizedReviewId}`,
        limit: 1,
      },
    })

    const row = Array.isArray(rows) ? rows[0] : null
    return row ? mapKnowledgeBackflowReview(row) : null
  }

  const listKnowledgeBackflowReviewsByCandidate = async (candidateId, limit = 20) => {
    const normalizedCandidateId = safeText(candidateId)
    if (!normalizedCandidateId) {
      return []
    }

    const rows =
      (await request('knowledge_backflow_reviews', {
        query: {
          select: 'id,candidate_id,action,reviewer,review_note,status_before,status_after,review_payload,created_at',
          candidate_id: `eq.${normalizedCandidateId}`,
          order: 'created_at.desc',
          limit: Math.max(1, Math.min(100, Number(limit) || 20)),
        },
      })) ?? []

    return rows.map((row) => mapKnowledgeBackflowReview(row))
  }

  const appendKnowledgeBackflowReview = async ({
    candidateId,
    action,
    reviewer,
    reviewNote,
    statusBefore,
    statusAfter,
    reviewPayload,
  }) => {
    const normalizedCandidateId = safeText(candidateId)
    const normalizedAction = safeText(action)
    if (!normalizedCandidateId || !normalizedAction) {
      throw new ApiError(400, 'candidateId and action are required for review log')
    }

    const rows = await request('knowledge_backflow_reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: [
        {
          candidate_id: normalizedCandidateId,
          action: normalizedAction,
          reviewer: safeText(reviewer) || 'operator',
          review_note: safeText(reviewNote),
          status_before: safeText(statusBefore),
          status_after: safeText(statusAfter),
          review_payload: asJsonRecord(reviewPayload),
        },
      ],
    })

    const row = Array.isArray(rows) ? rows[0] : null
    return row ? mapKnowledgeBackflowReview(row) : null
  }

  const patchKnowledgeBackflowCandidate = async (candidateId, patch) => {
    const normalizedCandidateId = safeText(candidateId)
    if (!normalizedCandidateId) {
      throw new ApiError(400, 'candidateId is required')
    }

    await request('knowledge_backflow_candidates', {
      method: 'PATCH',
      query: {
        id: `eq.${normalizedCandidateId}`,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        ...asJsonRecord(patch),
        last_review_at: new Date().toISOString(),
      },
    })
  }

  const ensureEncyclopediaEntryExists = async (entryId) => {
    const normalizedEntryId = safeText(entryId)
    if (!normalizedEntryId) {
      throw new ApiError(400, 'entryId is required')
    }

    const entryRows = await request('encyclopedia_entries', {
      query: {
        select: 'id',
        id: `eq.${normalizedEntryId}`,
        limit: 1,
      },
    })

    const entry = Array.isArray(entryRows) ? entryRows[0] : null
    if (!entry?.id) {
      throw new ApiError(404, 'encyclopedia entry not found')
    }

    return normalizedEntryId
  }

  const refreshSessionDraftStats = async (sessionId) => {
    const draftRows =
      (await request('spirit_community_drafts', {
        query: {
          select: 'updated_at',
          session_id: `eq.${sessionId}`,
          order: 'updated_at.desc',
          limit: 200,
        },
      })) ?? []

    const draftCount = draftRows.length
    const lastDraftAt = draftRows[0]?.updated_at ?? null

    await request('spirit_sessions', {
      method: 'PATCH',
      query: {
        id: `eq.${sessionId}`,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        draft_count: draftCount,
        last_draft_at: lastDraftAt,
      },
    })
  }

  const insertAnalyticsEvent = async (input = {}) => {
    const eventName = safeText(input.eventName || input.name)
    if (!eventName) {
      throw new ApiError(400, 'eventName is required')
    }

    const rows = await request('analytics_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: [
        {
          event_name: eventName,
          event_source: safeText(input.eventSource || input.source) || 'api',
          user_account: safeText(input.userAccount),
          session_id: safeText(input.sessionId),
          trace_id: safeText(input.traceId),
          event_payload: asJsonRecord(input.payload),
        },
      ],
    })

    return Array.isArray(rows) ? rows[0] : null
  }

  const insertTaskLog = async (input = {}) => {
    const taskType = safeText(input.taskType)
    const taskId = safeText(input.taskId)
    const status = safeText(input.status)
    if (!taskType || !taskId || !status) {
      throw new ApiError(400, 'taskType, taskId and status are required')
    }

    const rows = await request('task_logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: [
        {
          task_type: taskType,
          task_id: taskId,
          status,
          attempt: Number.isFinite(Number(input.attempt)) ? Math.max(0, Number(input.attempt)) : 0,
          duration_ms: Number.isFinite(Number(input.durationMs)) ? Math.max(0, Number(input.durationMs)) : 0,
          error: safeText(input.error),
          payload: asJsonRecord(input.payload),
        },
      ],
    })

    return Array.isArray(rows) ? rows[0] : null
  }

  return {
    async appendAnalyticsEvent(input = {}) {
      const row = await insertAnalyticsEvent(input)
      return {
        id: safeText(row?.id),
        eventName: safeText(row?.event_name),
        eventSource: safeText(row?.event_source),
        createdAt: toIsoOrEmpty(row?.created_at),
      }
    },

    async getAnalyticsEventSummary(input = {}) {
      const limit = Math.max(1, Math.min(5000, Number(input.limit) || 2000))
      const days = Math.max(1, Math.min(90, Number(input.days) || 7))
      const source = safeText(input.source)
      const eventName = safeText(input.eventName || input.event_name)
      const gteIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const query = {
        select: 'event_name,event_source,created_at',
        created_at: `gte.${gteIso}`,
        order: 'created_at.desc',
        limit,
      }

      if (source) {
        query.event_source = `eq.${source}`
      }

      if (eventName) {
        query.event_name = `eq.${eventName}`
      }

      const rows = (await request('analytics_events', { query })) ?? []
      const byNameMap = new Map()
      const bySourceMap = new Map()
      rows.forEach((row) => {
        const name = safeText(row.event_name) || 'unknown'
        const rowSource = safeText(row.event_source) || 'unknown'
        byNameMap.set(name, (byNameMap.get(name) ?? 0) + 1)
        bySourceMap.set(rowSource, (bySourceMap.get(rowSource) ?? 0) + 1)
      })

      const byName = Array.from(byNameMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((left, right) => right.count - left.count)

      const bySource = Array.from(bySourceMap.entries())
        .map(([sourceName, count]) => ({ source: sourceName, count }))
        .sort((left, right) => right.count - left.count)

      return {
        days,
        total: rows.length,
        byName,
        bySource,
        generatedAt: new Date().toISOString(),
      }
    },

    async listAnalyticsEvents(input = {}) {
      const limit = Math.max(1, Math.min(5000, Number(input.limit) || 2000))
      const days = Math.max(1, Math.min(90, Number(input.days) || 7))
      const source = safeText(input.source)
      const eventName = safeText(input.eventName || input.event_name)
      const gteIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const query = {
        select: 'id,event_name,event_source,user_account,session_id,trace_id,event_payload,created_at',
        created_at: `gte.${gteIso}`,
        order: 'created_at.desc',
        limit,
      }

      if (source) {
        query.event_source = `eq.${source}`
      }

      if (eventName) {
        query.event_name = `eq.${eventName}`
      }

      const rows = (await request('analytics_events', { query })) ?? []
      return rows.map((row) => mapAnalyticsEvent(row))
    },

    async appendTaskLog(input = {}) {
      const row = await insertTaskLog(input)
      return row ? mapTaskLog(row) : null
    },

    async listTaskLogs(input = {}) {
      const limit = Math.max(1, Math.min(200, Number(input.limit) || 50))
      const offset = Math.max(0, Number(input.offset) || 0)
      const taskType = safeText(input.taskType || input.task_type)
      const status = safeText(input.status)
      const taskId = safeText(input.taskId || input.task_id)

      const query = {
        select: 'id,task_type,task_id,status,attempt,duration_ms,error,payload,created_at',
        order: 'created_at.desc',
        limit,
        offset,
      }

      if (taskType) {
        query.task_type = `eq.${taskType}`
      }

      if (status) {
        query.status = `eq.${status}`
      }

      if (taskId) {
        query.task_id = `eq.${taskId}`
      }

      const rows = (await request('task_logs', { query })) ?? []
      return rows.map((row) => mapTaskLog(row))
    },

    async checkHealth() {
      ensureEnv(baseUrl, apiKey)
      await request('encyclopedia_entries', {
        query: {
          select: 'id',
          limit: 1,
        },
      })

      return {
        ok: true,
        provider: 'supabase',
      }
    },

    async listEncyclopedia(rawQuery) {
      return this.searchEncyclopedia({
        q: rawQuery,
        limit: 200,
      })
    },

    async searchEncyclopedia(input = {}) {
      const keyword = safeText(input.q)
      const type = safeText(input.type)
      const category = safeText(input.category)
      const riskCode = toRiskCode(input.risk)
      const limit = Math.max(1, Math.min(300, Number(input.limit) || 120))

      const query = {
        select:
          'id,type,name,scientific_name,genus,category_code,category_name,risk_level,season,host_range,summary,morphology,symptoms,image_url,control_tips,placement_tips,references',
        order: 'name.asc',
        limit,
      }

      if (keyword) {
        query.or = `(${[
          `name.ilike.*${keyword}*`,
          `scientific_name.ilike.*${keyword}*`,
          `category_name.ilike.*${keyword}*`,
          `host_range.ilike.*${keyword}*`,
          `symptoms.ilike.*${keyword}*`,
          `summary.ilike.*${keyword}*`,
        ].join(',')})`
      }

      if (type === 'insect' || type === 'disease') {
        query.type = `eq.${type}`
      }

      if (category) {
        query.category_name = `eq.${category}`
      }

      if (riskCode) {
        query.risk_level = `eq.${riskCode}`
      }

      const rows = (await request('encyclopedia_entries', { query })) ?? []
      return rows.map((row) => mapEncyclopediaRecord(row))
    },

    async getEncyclopediaDetail(entryId) {
      const normalizedEntryId = safeText(entryId)
      if (!normalizedEntryId) {
        return null
      }

      const entryRows = await request('encyclopedia_entries', {
        query: {
          select:
            'id,type,name,scientific_name,genus,category_code,category_name,risk_level,season,host_range,summary,morphology,symptoms,image_url,control_tips,placement_tips,references',
          id: `eq.${normalizedEntryId}`,
          limit: 1,
        },
      })

      const entryRow = Array.isArray(entryRows) ? entryRows[0] : null
      if (!entryRow) {
        return null
      }

      const entry = mapEncyclopediaRecord(entryRow)

      const sourceRows =
        (await request('source_index_items', {
          query: {
            select: 'id,entry_id,source_type,source_title,source_url,snippet,confidence_score',
            entry_id: `eq.${normalizedEntryId}`,
            order: 'confidence_score.desc,created_at.desc',
            limit: 50,
          },
        })) ?? []

      const templateRows =
        (await request('treatment_templates', {
          query: {
            select: 'entry_id,immediate_actions,environment_adjustments,follow_up_schedule,caution_notes',
            entry_id: `eq.${normalizedEntryId}`,
            limit: 1,
          },
        })) ?? []

      const relatedRows =
        (await request('encyclopedia_entries', {
          query: {
            select: 'id,type,name,scientific_name,genus,category_code,category_name,risk_level,season,host_range,summary,morphology,symptoms,image_url,control_tips,placement_tips,references',
            type: `eq.${entry.type}`,
            order: 'risk_level.desc,name.asc',
            limit: 12,
          },
        })) ?? []

      const relatedEntries = relatedRows
        .filter((row) => safeText(row.id) !== normalizedEntryId)
        .slice(0, 4)
        .map((row) => mapEncyclopediaRecord(row))

      const sourceIndex = sourceRows.map((row) => mapSourceIndexItem(row))
      const treatmentTemplate = mapTreatmentTemplate(templateRows[0], normalizedEntryId)

      return {
        id: entry.id,
        entry,
        sourceIndex,
        treatmentTemplate,
        relatedEntries,
      }
    },

    async listCommunityPosts(rawQuery) {
      const keyword = safeText(rawQuery)
      const query = {
        select: 'id,title,content,markdown,image_url,status,author_name,owner_account,likes,mentions,topics,created_at',
        order: 'created_at.desc',
        limit: 100,
      }

      if (keyword) {
        query.or = `(title.ilike.*${keyword}*,content.ilike.*${keyword}*,author_name.ilike.*${keyword}*)`
      }

      const postRows = await request('community_posts', { query })
      const postIds = (postRows ?? []).map((row) => row.id).filter(Boolean)

      if (postIds.length === 0) {
        return []
      }

      const answerRows =
        (await request('community_answers', {
          query: {
            select: 'id,post_id,author_name,content,markdown,image_url,role,reply_to_floor,floor,annotations,created_at',
            post_id: `in.(${encodeInList(postIds)})`,
            order: 'floor.asc',
          },
        })) ?? []

      const answerMap = new Map()
      answerRows.forEach((row) => {
        const postId = safeText(row.post_id)
        const record = mapCommunityAnswer(row)
        const list = answerMap.get(postId) ?? []
        list.push(record)
        answerMap.set(postId, list)
      })

      return postRows.map((postRow) => mapCommunityPost(postRow, answerMap.get(postRow.id) ?? []))
    },

    async generateKnowledgeBackflowCandidates(input = {}) {
      const q = safeText(input.q || input.query)
      const minQualityScore = Math.max(0, Math.min(100, Number(input.minQualityScore) || 60))
      const limit = Math.max(1, Math.min(100, Number(input.limit) || 20))
      const posts = await this.listCommunityPosts(q)
      const candidates = buildKnowledgeBackflowCandidates({
        posts,
        minQualityScore,
        limit,
      })

      let insertedCount = 0
      if (candidates.length > 0) {
        const rows = await request('knowledge_backflow_candidates', {
          method: 'POST',
          query: {
            on_conflict: 'candidate_type,source_post_id,source_answer_id',
          },
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=ignore-duplicates,return=representation',
          },
          body: candidates.map((candidate) => ({
            candidate_type: safeText(candidate?.candidateType),
            source_post_id: safeText(candidate?.sourcePostId) || null,
            source_answer_id: safeText(candidate?.sourceAnswerId) || null,
            entry_hint: safeText(candidate?.entryHint),
            title: safeText(candidate?.title),
            snippet: safeText(candidate?.snippet),
            quality_score: Number.isFinite(Number(candidate?.qualityScore))
              ? Math.max(0, Math.min(100, Math.round(Number(candidate.qualityScore))))
              : 0,
            proposed_payload: asJsonRecord(candidate?.proposedPayload),
            status: 'pending',
          })),
        })

        insertedCount = Array.isArray(rows) ? rows.length : 0
      }

      const items = await this.listKnowledgeBackflowCandidates({
        limit,
        status: safeText(input.status) || 'pending',
      })

      return {
        generatedCount: candidates.length,
        insertedCount,
        items,
      }
    },

    async listKnowledgeBackflowCandidates(input = {}) {
      const limit = Math.max(1, Math.min(200, Number(input.limit) || 50))
      const status = safeText(input.status)
      const candidateType = safeText(input.candidateType || input.candidate_type)
      const lifecycleState = safeText(input.lifecycleState || input.lifecycle_state)

      const query = {
        select:
          'id,candidate_type,source_post_id,source_answer_id,entry_hint,entry_id,title,snippet,quality_score,proposed_payload,status,lifecycle_state,conflict_detail,approved_by,approved_at,review_note,last_review_at,created_at,updated_at',
        order: 'quality_score.desc,created_at.desc',
        limit,
      }

      if (status === 'pending' || status === 'approved' || status === 'rejected') {
        query.status = `eq.${status}`
      }

      if (candidateType === 'source_index' || candidateType === 'treatment_template') {
        query.candidate_type = `eq.${candidateType}`
      }

      if (lifecycleState) {
        query.lifecycle_state = `eq.${lifecycleState}`
      }

      const rows = (await request('knowledge_backflow_candidates', { query })) ?? []
      return rows.map((row) => mapKnowledgeBackflowCandidate(row))
    },

    async approveKnowledgeBackflowCandidate(candidateId, input = {}) {
      const normalizedCandidateId = safeText(candidateId)
      if (!normalizedCandidateId) {
        throw new ApiError(400, 'candidateId is required')
      }

      const force = Boolean(input.force)
      const conflictStrategy = safeText(input.conflictStrategy).toLowerCase()
      const candidate = await findKnowledgeBackflowCandidate(normalizedCandidateId)
      if (!candidate) {
        throw new ApiError(404, 'knowledge backflow candidate not found')
      }

      if (candidate.status === 'approved' && !force) {
        return {
          candidate,
          applied: {
            entryId: safeText(candidate.entryId),
            candidateType: safeText(candidate.candidateType),
          },
          reused: true,
          conflict: false,
        }
      }

      const requestedEntryId = safeText(input.entryId)
      const resolvedEntryId = await ensureEncyclopediaEntryExists(requestedEntryId || candidate.entryId || candidate.entryHint)
      const approvedBy = safeText(input.approvedBy) || 'operator'
      const reviewNote = safeText(input.reviewNote)
      const proposedPayload = asJsonRecord(candidate.proposedPayload)
      const statusBefore = safeText(candidate.status) || 'pending'
      const candidateType = safeText(candidate.candidateType)

      let sourceIndexItemId = ''
      let treatmentTemplateId = ''
      let reused = false
      let conflict = false
      let conflictDetail = {}
      const operation = {
        candidateType,
        entryId: resolvedEntryId,
        conflictStrategy,
      }
      let updatedSourceIndexForReviewId = false
      let updatedTreatmentForReviewId = false

      if (candidateType === 'source_index') {
        const sourceIndex = asJsonRecord(proposedPayload.sourceIndex)
        const sourceType = safeText(sourceIndex.sourceType) || 'community'
        const sourceTitle = safeText(sourceIndex.sourceTitle) || safeText(candidate.title) || '社区经验回流'
        const sourceUrl = safeText(sourceIndex.sourceUrl) || `/community/${candidate.sourcePostId}`
        const snippet = safeText(sourceIndex.snippet) || safeText(candidate.snippet)
        const confidenceScoreRaw = Number(sourceIndex.confidenceScore)
        const confidenceScore = Number.isFinite(confidenceScoreRaw)
          ? Math.max(0, Math.min(100, Math.round(confidenceScoreRaw)))
          : Math.max(0, Math.min(100, Math.round(Number(candidate.qualityScore) || 60)))

        const existingRows = await request('source_index_items', {
          query: {
            select:
              'id,entry_id,source_type,source_title,source_url,snippet,confidence_score,backflow_candidate_id,backflow_review_id,source_post_id,source_answer_id',
            entry_id: `eq.${resolvedEntryId}`,
            source_type: `eq.${sourceType}`,
            source_title: `eq.${sourceTitle}`,
            source_url: `eq.${sourceUrl}`,
            limit: 1,
          },
        })
        const existing = Array.isArray(existingRows) ? existingRows[0] : null
        const existingSnippet = safeText(existing?.snippet)
        const existingConfidence = Number.isFinite(Number(existing?.confidence_score))
          ? Math.max(0, Math.min(100, Math.round(Number(existing.confidence_score))))
          : 0
        const hasConflict = Boolean(existing?.id) && (existingSnippet !== snippet || existingConfidence !== confidenceScore)

        operation.sourceIndex = {
          sourceType,
          sourceTitle,
          sourceUrl,
          snippet,
          confidenceScore,
          existing: existing
            ? {
                id: safeText(existing.id),
                snippet: existingSnippet,
                confidenceScore: existingConfidence,
              }
            : null,
        }

        if (hasConflict && !force && conflictStrategy !== 'overwrite' && conflictStrategy !== 'keep_existing') {
          conflict = true
          conflictDetail = {
            kind: 'source_index_conflict',
            strategyHint: 'set conflictStrategy to overwrite or keep_existing',
            existing: {
              id: safeText(existing?.id),
              snippet: existingSnippet,
              confidenceScore: existingConfidence,
            },
            incoming: {
              snippet,
              confidenceScore,
            },
          }

          await patchKnowledgeBackflowCandidate(normalizedCandidateId, {
            status: 'pending',
            lifecycle_state: 'conflicted',
            conflict_detail: asJsonRecord(conflictDetail),
            review_note: reviewNote,
          })

          await appendKnowledgeBackflowReview({
            candidateId: normalizedCandidateId,
            action: 'conflict',
            reviewer: approvedBy,
            reviewNote,
            statusBefore,
            statusAfter: 'pending',
            reviewPayload: {
              conflictDetail,
              operation,
            },
          })

          const conflictedCandidate = await findKnowledgeBackflowCandidate(normalizedCandidateId)
          if (!conflictedCandidate) {
            throw new ApiError(500, 'update conflict state failed')
          }

          return {
            candidate: conflictedCandidate,
            applied: {
              entryId: resolvedEntryId,
              candidateType,
              sourceIndexItemId: '',
              treatmentTemplateId: '',
            },
            reused: false,
            conflict: true,
            conflictDetail,
          }
        }

        if (existing?.id && !force && (conflictStrategy === 'keep_existing' || !hasConflict)) {
          sourceIndexItemId = safeText(existing.id)
          reused = true
          operation.sourceIndex = {
            ...asJsonRecord(operation.sourceIndex),
            mode: 'reused',
            sourceIndexItemId,
          }
        } else {
          const payload = {
            entry_id: resolvedEntryId,
            source_type: sourceType,
            source_title: sourceTitle,
            source_url: sourceUrl,
            snippet,
            confidence_score: confidenceScore,
            source_post_id: safeText(candidate.sourcePostId) || null,
            source_answer_id: safeText(candidate.sourceAnswerId) || null,
            backflow_candidate_id: normalizedCandidateId,
          }

          if (existing?.id) {
            const updatedRows = await request('source_index_items', {
              method: 'PATCH',
              query: {
                id: `eq.${safeText(existing.id)}`,
              },
              headers: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: payload,
            })
            const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : null
            sourceIndexItemId = safeText(updatedRow?.id) || safeText(existing.id)
            updatedSourceIndexForReviewId = true
            operation.sourceIndex = {
              ...asJsonRecord(operation.sourceIndex),
              mode: 'updated',
              sourceIndexItemId,
            }
          } else {
            const createdRows = await request('source_index_items', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: [payload],
            })
            const created = Array.isArray(createdRows) ? createdRows[0] : null
            sourceIndexItemId = safeText(created?.id)
            updatedSourceIndexForReviewId = true
            operation.sourceIndex = {
              ...asJsonRecord(operation.sourceIndex),
              mode: 'created',
              sourceIndexItemId,
            }
          }
        }
      } else if (candidateType === 'treatment_template') {
        const template = asJsonRecord(proposedPayload.treatmentTemplate)
        const immediateActions = asStringList(template.immediateActions).slice(0, 8)
        const environmentAdjustments = asStringList(template.environmentAdjustments).slice(0, 8)
        const followUpSchedule = asStringList(template.followUpSchedule).slice(0, 8)
        const cautionNotes = asStringList(template.cautionNotes).slice(0, 8)

        const existingRows =
          (await request('treatment_templates', {
            query: {
              select:
                'id,entry_id,immediate_actions,environment_adjustments,follow_up_schedule,caution_notes,backflow_candidate_id,backflow_review_id,source_post_id,source_answer_id',
              entry_id: `eq.${resolvedEntryId}`,
              limit: 1,
            },
          })) ?? []
        const existing = Array.isArray(existingRows) ? existingRows[0] : null

        const incomingTemplate = {
          immediateActions,
          environmentAdjustments,
          followUpSchedule,
          cautionNotes,
        }

        const beforeTemplate = existing
          ? {
              immediateActions: asStringList(existing.immediate_actions).slice(0, 8),
              environmentAdjustments: asStringList(existing.environment_adjustments).slice(0, 8),
              followUpSchedule: asStringList(existing.follow_up_schedule).slice(0, 8),
              cautionNotes: asStringList(existing.caution_notes).slice(0, 8),
            }
          : null

        const hasConflict =
          Boolean(existing?.id) &&
          (JSON.stringify(beforeTemplate?.immediateActions ?? []) !== JSON.stringify(incomingTemplate.immediateActions) ||
            JSON.stringify(beforeTemplate?.environmentAdjustments ?? []) !==
              JSON.stringify(incomingTemplate.environmentAdjustments) ||
            JSON.stringify(beforeTemplate?.followUpSchedule ?? []) !== JSON.stringify(incomingTemplate.followUpSchedule) ||
            JSON.stringify(beforeTemplate?.cautionNotes ?? []) !== JSON.stringify(incomingTemplate.cautionNotes))

        operation.treatmentTemplate = {
          existingId: safeText(existing?.id),
          before: beforeTemplate,
          incoming: incomingTemplate,
        }

        if (hasConflict && !force && !['overwrite', 'merge', 'keep_existing'].includes(conflictStrategy)) {
          conflict = true
          conflictDetail = {
            kind: 'treatment_template_conflict',
            strategyHint: 'set conflictStrategy to merge/overwrite/keep_existing',
            existing: beforeTemplate,
            incoming: incomingTemplate,
          }

          await patchKnowledgeBackflowCandidate(normalizedCandidateId, {
            status: 'pending',
            lifecycle_state: 'conflicted',
            conflict_detail: asJsonRecord(conflictDetail),
            review_note: reviewNote,
          })

          await appendKnowledgeBackflowReview({
            candidateId: normalizedCandidateId,
            action: 'conflict',
            reviewer: approvedBy,
            reviewNote,
            statusBefore,
            statusAfter: 'pending',
            reviewPayload: {
              conflictDetail,
              operation,
            },
          })

          const conflictedCandidate = await findKnowledgeBackflowCandidate(normalizedCandidateId)
          if (!conflictedCandidate) {
            throw new ApiError(500, 'update conflict state failed')
          }

          return {
            candidate: conflictedCandidate,
            applied: {
              entryId: resolvedEntryId,
              candidateType,
              sourceIndexItemId: '',
              treatmentTemplateId: '',
            },
            reused: false,
            conflict: true,
            conflictDetail,
          }
        }

        if (existing?.id && !force && (conflictStrategy === 'keep_existing' || !hasConflict)) {
          treatmentTemplateId = safeText(existing.id)
          reused = true
          operation.treatmentTemplate = {
            ...asJsonRecord(operation.treatmentTemplate),
            mode: 'reused',
            treatmentTemplateId,
            applied: beforeTemplate,
          }
        } else {
          const finalTemplate =
            existing?.id && conflictStrategy === 'merge' && !force
              ? {
                  immediateActions: mergeStringLists(beforeTemplate?.immediateActions, incomingTemplate.immediateActions).slice(0, 8),
                  environmentAdjustments: mergeStringLists(
                    beforeTemplate?.environmentAdjustments,
                    incomingTemplate.environmentAdjustments,
                  ).slice(0, 8),
                  followUpSchedule: mergeStringLists(beforeTemplate?.followUpSchedule, incomingTemplate.followUpSchedule).slice(
                    0,
                    8,
                  ),
                  cautionNotes: mergeStringLists(beforeTemplate?.cautionNotes, incomingTemplate.cautionNotes).slice(0, 8),
                }
              : incomingTemplate

          const payload = {
            entry_id: resolvedEntryId,
            immediate_actions: finalTemplate.immediateActions,
            environment_adjustments: finalTemplate.environmentAdjustments,
            follow_up_schedule: finalTemplate.followUpSchedule,
            caution_notes: finalTemplate.cautionNotes,
            source_post_id: safeText(candidate.sourcePostId) || null,
            source_answer_id: safeText(candidate.sourceAnswerId) || null,
            backflow_candidate_id: normalizedCandidateId,
          }

          if (existing?.id) {
            const updatedRows = await request('treatment_templates', {
              method: 'PATCH',
              query: {
                id: `eq.${safeText(existing.id)}`,
              },
              headers: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: payload,
            })
            const row = Array.isArray(updatedRows) ? updatedRows[0] : null
            treatmentTemplateId = safeText(row?.id) || safeText(existing.id)
            updatedTreatmentForReviewId = true
          } else {
            const rows = await request('treatment_templates', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: [payload],
            })
            const row = Array.isArray(rows) ? rows[0] : null
            treatmentTemplateId = safeText(row?.id)
            updatedTreatmentForReviewId = true
          }

          operation.treatmentTemplate = {
            ...asJsonRecord(operation.treatmentTemplate),
            mode: existing?.id ? (conflictStrategy === 'merge' ? 'merged' : 'updated') : 'created',
            applied: finalTemplate,
            treatmentTemplateId,
          }
        }
      } else {
        throw new ApiError(400, 'unsupported candidate type')
      }

      await patchKnowledgeBackflowCandidate(normalizedCandidateId, {
        status: 'approved',
        lifecycle_state: '',
        conflict_detail: {},
        entry_id: resolvedEntryId,
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        review_note: reviewNote,
      })

      const review = await appendKnowledgeBackflowReview({
        candidateId: normalizedCandidateId,
        action: 'approve',
        reviewer: approvedBy,
        reviewNote,
        statusBefore,
        statusAfter: 'approved',
        reviewPayload: {
          applied: {
            entryId: resolvedEntryId,
            candidateType,
            sourceIndexItemId,
            treatmentTemplateId,
            reused,
          },
          operation,
        },
      })

      if (sourceIndexItemId && updatedSourceIndexForReviewId && review?.id) {
        await request('source_index_items', {
          method: 'PATCH',
          query: {
            id: `eq.${sourceIndexItemId}`,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            backflow_review_id: safeText(review.id),
          },
        })
      }

      if (treatmentTemplateId && updatedTreatmentForReviewId && review?.id) {
        await request('treatment_templates', {
          method: 'PATCH',
          query: {
            id: `eq.${treatmentTemplateId}`,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            backflow_review_id: safeText(review.id),
          },
        })
      }

      const updated = await findKnowledgeBackflowCandidate(normalizedCandidateId)
      if (!updated) {
        throw new ApiError(500, 'approve knowledge backflow candidate failed')
      }

      return {
        candidate: updated,
        applied: {
          entryId: resolvedEntryId,
          candidateType,
          sourceIndexItemId,
          treatmentTemplateId,
        },
        reused,
        conflict,
        conflictDetail: asJsonRecord(conflictDetail),
      }
    },

    async rejectKnowledgeBackflowCandidate(candidateId, input = {}) {
      const normalizedCandidateId = safeText(candidateId)
      if (!normalizedCandidateId) {
        throw new ApiError(400, 'candidateId is required')
      }

      const candidate = await findKnowledgeBackflowCandidate(normalizedCandidateId)
      if (!candidate) {
        throw new ApiError(404, 'knowledge backflow candidate not found')
      }

      const rejectedBy = safeText(input.rejectedBy) || 'operator'
      const reviewNote = safeText(input.reviewNote)
      const statusBefore = safeText(candidate.status) || 'pending'

      await patchKnowledgeBackflowCandidate(normalizedCandidateId, {
        status: 'rejected',
        lifecycle_state: 'rejected',
        conflict_detail: {},
        review_note: reviewNote,
      })

      const review = await appendKnowledgeBackflowReview({
        candidateId: normalizedCandidateId,
        action: 'reject',
        reviewer: rejectedBy,
        reviewNote,
        statusBefore,
        statusAfter: 'rejected',
        reviewPayload: {
          candidateType: safeText(candidate.candidateType),
          entryId: safeText(candidate.entryId),
        },
      })

      const updated = await findKnowledgeBackflowCandidate(normalizedCandidateId)
      if (!updated) {
        throw new ApiError(500, 'reject knowledge backflow candidate failed')
      }

      return {
        candidate: updated,
        review,
      }
    },

    async rollbackKnowledgeBackflowCandidate(candidateId, input = {}) {
      const normalizedCandidateId = safeText(candidateId)
      if (!normalizedCandidateId) {
        throw new ApiError(400, 'candidateId is required')
      }

      const candidate = await findKnowledgeBackflowCandidate(normalizedCandidateId)
      if (!candidate) {
        throw new ApiError(404, 'knowledge backflow candidate not found')
      }

      const rolledBackBy = safeText(input.rolledBackBy) || 'operator'
      const reviewNote = safeText(input.reviewNote)
      const requestedReviewId = safeText(input.rollbackToReviewId)
      const force = Boolean(input.force)
      const statusBefore = safeText(candidate.status) || 'pending'

      const reviews = await listKnowledgeBackflowReviewsByCandidate(normalizedCandidateId, 50)
      let targetReview =
        (requestedReviewId ? reviews.find((item) => safeText(item.id) === requestedReviewId) : null) ??
        reviews.find((item) => safeText(item.action) === 'approve')

      if (!targetReview && requestedReviewId) {
        targetReview = await findKnowledgeBackflowReview(requestedReviewId)
      }

      if (!targetReview && !force) {
        throw new ApiError(409, 'approve review not found for rollback')
      }

      const targetPayload = asJsonRecord(targetReview?.reviewPayload)
      const targetApplied = asJsonRecord(targetPayload.applied)
      const targetOperation = asJsonRecord(targetPayload.operation)
      const targetCandidateType = safeText(targetApplied.candidateType) || safeText(candidate.candidateType)
      const sourceIndexItemId = safeText(targetApplied.sourceIndexItemId)
      const treatmentTemplateId = safeText(targetApplied.treatmentTemplateId)
      let sourceIndexItemDeleted = false
      let treatmentTemplateRestored = false

      if (targetCandidateType === 'source_index' && sourceIndexItemId) {
        await request('source_index_items', {
          method: 'DELETE',
          query: {
            id: `eq.${sourceIndexItemId}`,
          },
          headers: {
            Prefer: 'return=minimal',
          },
        })
        sourceIndexItemDeleted = true
      } else if (targetCandidateType === 'treatment_template' && treatmentTemplateId) {
        const previousTemplate = asJsonRecord(targetOperation.treatmentTemplate)
        const beforeTemplate = asJsonRecord(previousTemplate.before)
        const hasBeforeTemplate =
          asStringList(beforeTemplate.immediateActions).length > 0 ||
          asStringList(beforeTemplate.environmentAdjustments).length > 0 ||
          asStringList(beforeTemplate.followUpSchedule).length > 0 ||
          asStringList(beforeTemplate.cautionNotes).length > 0

        if (hasBeforeTemplate) {
          await request('treatment_templates', {
            method: 'PATCH',
            query: {
              id: `eq.${treatmentTemplateId}`,
            },
            headers: {
              'Content-Type': 'application/json',
            },
            body: {
              immediate_actions: asStringList(beforeTemplate.immediateActions).slice(0, 8),
              environment_adjustments: asStringList(beforeTemplate.environmentAdjustments).slice(0, 8),
              follow_up_schedule: asStringList(beforeTemplate.followUpSchedule).slice(0, 8),
              caution_notes: asStringList(beforeTemplate.cautionNotes).slice(0, 8),
            },
          })
          treatmentTemplateRestored = true
        } else {
          await request('treatment_templates', {
            method: 'DELETE',
            query: {
              id: `eq.${treatmentTemplateId}`,
            },
            headers: {
              Prefer: 'return=minimal',
            },
          })
          treatmentTemplateRestored = true
        }
      }

      await patchKnowledgeBackflowCandidate(normalizedCandidateId, {
        status: 'rejected',
        lifecycle_state: 'rolled_back',
        review_note: reviewNote,
      })

      const rollbackReview = await appendKnowledgeBackflowReview({
        candidateId: normalizedCandidateId,
        action: 'rollback',
        reviewer: rolledBackBy,
        reviewNote,
        statusBefore,
        statusAfter: 'rejected',
        reviewPayload: {
          targetReviewId: safeText(targetReview?.id),
          applied: targetApplied,
          rollback: {
            sourceIndexItemDeleted,
            treatmentTemplateRestored,
          },
        },
      })

      const updated = await findKnowledgeBackflowCandidate(normalizedCandidateId)
      if (!updated) {
        throw new ApiError(500, 'rollback knowledge backflow candidate failed')
      }

      return {
        candidate: updated,
        rollback: {
          reverted: Boolean(targetReview) || force,
          sourceIndexItemDeleted,
          treatmentTemplateRestored,
          targetReviewId: safeText(targetReview?.id),
        },
        review: rollbackReview,
      }
    },

    async listKnowledgeBackflowReviews(input = {}) {
      const candidateId = safeText(input.candidateId || input.candidate_id)
      const limit = Math.max(1, Math.min(100, Number(input.limit) || 20))
      if (!candidateId) {
        throw new ApiError(400, 'candidateId is required')
      }

      return listKnowledgeBackflowReviewsByCandidate(candidateId, limit)
    },

    async getHomeFeed() {
      const alertRows =
        (await request('encyclopedia_entries', {
          query: {
            select: 'id,name,summary,risk_level,image_url,season,updated_at',
            risk_level: 'eq.high',
            order: 'updated_at.desc',
            limit: 6,
          },
        })) ?? []

      const pickRows =
        (await request('community_posts', {
          query: {
            select: 'id,title,author_name,image_url,status,likes,created_at',
            order: 'likes.desc,created_at.desc',
            limit: 8,
          },
        })) ?? []

      const reminderRows =
        (await request('spirit_community_drafts', {
          query: {
            select: 'id,session_id,title,status,updated_at,published_post_id',
            status: 'eq.draft',
            order: 'updated_at.desc',
            limit: 8,
          },
        })) ?? []

      return {
        alerts: alertRows.slice(0, 3).map((row) => ({
          id: safeText(row.id),
          name: safeText(row.name),
          risk: toRiskLabel(row.risk_level),
          summary: safeText(row.summary),
          image: safeText(row.image_url),
          season: safeText(row.season),
        })),
        picks: pickRows.slice(0, 4).map((row) => ({
          id: safeText(row.id),
          title: safeText(row.title),
          author: safeText(row.author_name),
          image: safeText(row.image_url),
          likes: toCount(row.likes),
          status: safeText(row.status) || 'open',
          createdAt: toIsoOrEmpty(row.created_at),
        })),
        reminders: reminderRows.slice(0, 4).map((row) => ({
          id: safeText(row.id),
          type: 'spirit_draft',
          title: safeText(row.title) || '灵化草稿待发布',
          status: safeText(row.status) || 'draft',
          sessionId: safeText(row.session_id),
          updatedAt: toIsoOrEmpty(row.updated_at),
          publishedPostId: safeText(row.published_post_id),
        })),
        generatedAt: new Date().toISOString(),
      }
    },

    async getMeStats(input = {}) {
      const account = safeText(input.account)
      const profileName = safeText(input.profileName)
      const favorite = toCount(input.favoriteCount)
      const identify = toCount(input.identifyCount)

      let publish = 0
      if (account || profileName) {
        const publishQuery = {
          select: 'id',
          limit: 1000,
        }

        if (account && profileName) {
          publishQuery.or = `(owner_account.eq.${account},author_name.eq.${profileName})`
        } else if (account) {
          publishQuery.owner_account = `eq.${account}`
        } else if (profileName) {
          publishQuery.author_name = `eq.${profileName}`
        }

        const rows = (await request('community_posts', { query: publishQuery })) ?? []
        publish = rows.length
      }

      let answer = 0
      const answerAuthor = profileName || account
      if (answerAuthor) {
        const rows =
          (await request('community_answers', {
            query: {
              select: 'id',
              author_name: `eq.${answerAuthor}`,
              limit: 2000,
            },
          })) ?? []
        answer = rows.length
      }

      return {
        publish,
        answer,
        favorite,
        identify,
        eventSummary: [
          { name: 'community_post_publish', count: publish },
          { name: 'community_reply_publish', count: answer },
          { name: 'favorite_toggle', count: favorite },
          { name: 'identify_submit', count: identify },
        ],
        generatedAt: new Date().toISOString(),
      }
    },

    async createCommunityPost(payload) {
      const rows = await request('community_posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: [
          {
            title: payload.title,
            content: payload.content,
            markdown: payload.markdown || payload.content,
            image_url: payload.image || null,
            status: 'open',
            author_name: '我',
            owner_account: null,
            likes: 0,
            mentions: payload.mentions ?? [],
            topics: payload.topics ?? [],
          },
        ],
      })

      const created = Array.isArray(rows) ? rows[0] : null
      if (!created?.id) {
        throw new ApiError(500, 'create community post failed')
      }

      return {
        id: String(created.id),
      }
    },

    async createCommunityReply(postId, payload) {
      const posts = await request('community_posts', {
        query: {
          select: 'id',
          id: `eq.${postId}`,
          limit: 1,
        },
      })

      if (!Array.isArray(posts) || posts.length === 0) {
        throw new ApiError(404, 'community post not found')
      }

      const topFloorRows = await request('community_answers', {
        query: {
          select: 'floor',
          post_id: `eq.${postId}`,
          order: 'floor.desc',
          limit: 1,
        },
      })

      const maxFloor = Number(topFloorRows?.[0]?.floor) || 1
      const nextFloor = Math.max(maxFloor + 1, 2)

      const rows = await request('community_answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: [
          {
            post_id: postId,
            author_name: '我',
            content: payload.content || '补充说明',
            markdown: payload.markdown || payload.content || '补充说明',
            image_url: payload.image || null,
            role: payload.role ?? 'answer',
            reply_to_floor: payload.replyToFloor,
            floor: nextFloor,
            annotations: payload.annotations ?? [],
          },
        ],
      })

      const created = Array.isArray(rows) ? rows[0] : null
      if (!created?.id) {
        throw new ApiError(500, 'create community reply failed')
      }

      return {
        id: String(created.id),
      }
    },

    async upsertDiagnosisTask(task) {
      const taskId = safeText(task?.id)
      if (!taskId) {
        throw new ApiError(400, 'diagnosis task id is required')
      }

      const status = safeText(task?.status) || 'pending'
      const riskLevel = safeText(task?.riskLevel) || 'medium'

      await request('diagnosis_tasks', {
        method: 'POST',
        query: {
          on_conflict: 'id',
        },
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: [
          {
            id: taskId,
            status,
            input_payload: asJsonRecord(task?.payload),
            top_result: asJsonRecord(task?.topResult),
            risk_level: riskLevel,
            encyclopedia_refs: asStringList(task?.encyclopediaRefs),
            source_refs: asStringList(task?.sourceRefs),
            error: safeText(task?.error) || safeText(task?.failureReason),
            started_at: safeText(task?.startedAt) || null,
            finished_at: safeText(task?.finishedAt) || null,
            duration_ms: Number.isFinite(Number(task?.durationMs)) ? Math.max(0, Number(task.durationMs)) : 0,
          },
        ],
      })

      if (task?.identify && typeof task.identify === 'object') {
        await request('diagnosis_results', {
          method: 'POST',
          query: {
            on_conflict: 'task_id',
          },
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: [
            {
              task_id: taskId,
              raw_payload: asJsonRecord(task?.rawResult),
              normalized_payload: asJsonRecord(task?.identify),
              provider: safeText(task?.identify?.provider),
              model: safeText(task?.identify?.model),
            },
          ],
        })
      }

      if (Array.isArray(task?.actionCards)) {
        await request('action_cards', {
          method: 'DELETE',
          query: {
            task_id: `eq.${taskId}`,
          },
        })

        const cards = task.actionCards
          .map((card) => ({
            task_id: taskId,
            card_type: safeText(card?.type) || 'observe',
            title: safeText(card?.title) || '行动建议',
            description: safeText(card?.description),
            cta_label: safeText(card?.ctaLabel),
            cta_route: safeText(card?.ctaRoute),
            priority: Number.isFinite(Number(card?.priority)) ? Number(card.priority) : 0,
          }))
          .filter((card) => card.title)

        if (cards.length > 0) {
          await request('action_cards', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: cards,
          })
        }
      }

      try {
        await insertTaskLog({
          taskType: 'diagnosis_identify',
          taskId,
          status,
          attempt: Number.isFinite(Number(task?.attempt)) ? Number(task.attempt) : 0,
          durationMs: Number.isFinite(Number(task?.durationMs)) ? Number(task.durationMs) : 0,
          error: safeText(task?.error) || safeText(task?.failureReason),
          payload: {
            riskLevel,
            sourceRefs: asStringList(task?.sourceRefs),
          },
        })
      } catch {
        // Ignore task log write failure; main diagnosis persistence should remain available.
      }

      return findDiagnosisTask(taskId)
    },

    async getDiagnosisTask(taskId) {
      const normalizedTaskId = safeText(taskId)
      if (!normalizedTaskId) {
        return null
      }

      return findDiagnosisTask(normalizedTaskId)
    },

    async upsertSpiritGenerationJob(task) {
      const taskId = safeText(task?.id)
      if (!taskId) {
        throw new ApiError(400, 'task id is required')
      }

      const requestPayload =
        task?.payload && typeof task.payload === 'object'
          ? {
              ...task.payload,
              _meta: {
                idempotencyKey: safeText(task?.idempotencyKey),
              },
            }
          : {
              _meta: {
                idempotencyKey: safeText(task?.idempotencyKey),
              },
            }

      const resultPayload =
        task?.result && typeof task.result === 'object'
          ? {
              ...task.result,
              _queue: {
                attempt: Number.isFinite(Number(task?.attempt)) ? Number(task.attempt) : 0,
                maxAttempts: Number.isFinite(Number(task?.maxAttempts)) ? Number(task.maxAttempts) : 0,
                nextRetryAt: safeText(task?.nextRetryAt),
                failureReason: safeText(task?.failureReason),
              },
            }
          : {
              _queue: {
                attempt: Number.isFinite(Number(task?.attempt)) ? Number(task.attempt) : 0,
                maxAttempts: Number.isFinite(Number(task?.maxAttempts)) ? Number(task.maxAttempts) : 0,
                nextRetryAt: safeText(task?.nextRetryAt),
                failureReason: safeText(task?.failureReason),
              },
            }

      const rows = await request('spirit_generation_jobs', {
        method: 'POST',
        query: {
          on_conflict: 'id',
        },
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: [
          {
            id: taskId,
            status: safeText(task?.status) || 'queued',
            request_payload: requestPayload,
            result_payload: resultPayload,
            error: safeText(task?.failureReason) || safeText(task?.error),
            started_at: safeText(task?.startedAt) || null,
            finished_at: safeText(task?.finishedAt) || null,
            duration_ms: Number.isFinite(Number(task?.durationMs)) ? Math.max(0, Number(task.durationMs)) : 0,
          },
        ],
      })

      const row = Array.isArray(rows) ? rows[0] : null

      try {
        await insertTaskLog({
          taskType: 'spirit_generation',
          taskId,
          status: safeText(task?.status) || 'queued',
          attempt: Number.isFinite(Number(task?.attempt)) ? Number(task.attempt) : 0,
          durationMs: Number.isFinite(Number(task?.durationMs)) ? Number(task.durationMs) : 0,
          error: safeText(task?.failureReason) || safeText(task?.error),
          payload: {
            idempotencyKey: safeText(task?.idempotencyKey),
            nextRetryAt: safeText(task?.nextRetryAt),
          },
        })
      } catch {
        // Ignore task log write failure; main generation persistence should remain available.
      }

      return row ? mapSpiritGenerationJob(row) : null
    },

    async getSpiritGenerationStats() {
      const rows =
        (await request('spirit_generation_jobs', {
          query: {
            select: 'id,status,duration_ms,updated_at',
            order: 'updated_at.desc',
            limit: 1000,
          },
        })) ?? []

      const counts = {
        totalTasks: rows.length,
        queued: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
      }

      rows.forEach((row) => {
        const status = safeText(row.status)
        if (status === 'queued') {
          counts.queued += 1
          return
        }

        if (status === 'running') {
          counts.running += 1
          return
        }

        if (status === 'succeeded') {
          counts.succeeded += 1
          return
        }

        if (status === 'failed') {
          counts.failed += 1
        }
      })

      const completed = counts.succeeded + counts.failed
      const durationSource = rows
        .map((row) => Number(row.duration_ms))
        .filter((value) => Number.isFinite(value) && value >= 0)
      const durationTotal = durationSource.reduce((acc, value) => acc + value, 0)
      const averageDurationMs = durationSource.length > 0 ? Math.round(durationTotal / durationSource.length) : 0

      return {
        ...counts,
        completed,
        successRate: completed > 0 ? Number((counts.succeeded / completed).toFixed(4)) : 0,
        averageDurationMs,
        lastTaskUpdatedAt: toIsoOrEmpty(rows[0]?.updated_at),
      }
    },

    async createSpiritSession(payload) {
      const rows = await request('spirit_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: [
          {
            identify: payload?.identify ?? {},
            generation: payload?.generation ?? {},
            messages: payload?.messages ?? [],
            draft_count: 0,
            last_draft_at: null,
          },
        ],
      })

      const created = Array.isArray(rows) ? rows[0] : null
      if (!created?.id) {
        throw new ApiError(500, 'create spirit session failed')
      }

      return mapSpiritSession(created)
    },

    async listSpiritSessions(limit = 20) {
      const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
      const rows =
        (await request('spirit_sessions', {
          query: {
            select: 'id,identify,generation,messages,draft_count,last_draft_at,created_at,updated_at',
            order: 'updated_at.desc',
            limit: safeLimit,
          },
        })) ?? []

      return rows.map((row) => mapSpiritSession(row))
    },

    async getSpiritSession(sessionId) {
      const normalized = safeText(sessionId)
      if (!normalized) {
        return null
      }

      return findSpiritSession(normalized)
    },

    async persistChatConversation(input = {}) {
      const payload = asJsonRecord(input.payload)
      const result = asJsonRecord(input.result)
      const orchestration = asJsonRecord(payload.orchestration)
      const rolePack = asJsonRecord(orchestration.rolePack)
      const diagnosisContext = asJsonRecord(orchestration.diagnosisContext)
      const retrievalContext = asJsonRecord(orchestration.retrievalContext)
      const memoryContext = asJsonRecord(orchestration.memoryContext)

      const question = safeText(payload.question)
      const reply = safeText(result.reply)
      const providedSessionId = safeText(orchestration.sessionId)
      const sessionId = isUuidText(providedSessionId) ? providedSessionId : ''
      const rolePackId = safeText(rolePack.id)
      const rolePackName = safeText(rolePack.name)
      const rolePackStyle = safeText(rolePack.style)
      const rolePackPersona = safeText(rolePack.persona)
      const rolePackGuardrails = asStringList(rolePack.guardrails).slice(0, 20)
      const turnCountBase = Array.isArray(payload.messages) ? payload.messages.length : 0
      const turnCount = Math.max(1, turnCountBase + 2)
      const longTermFacts = asStringList(memoryContext.longTermFacts).slice(0, 12)
      const sessionSummary = safeText(memoryContext.sessionSummary)
      const memoryHits = longTermFacts.length + (sessionSummary ? 1 : 0)
      const identifyName = safeText(diagnosisContext.identifyName) || safeText(payload?.identify?.name)
      const nowIso = new Date().toISOString()

      if (rolePackId) {
        await request('spirit_role_packs', {
          method: 'POST',
          query: {
            on_conflict: 'id',
          },
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: [
            {
              id: rolePackId,
              name: rolePackName || rolePackId,
              version: 1,
              style: rolePackStyle,
              persona: rolePackPersona,
              system_prompt: '',
              guardrails: rolePackGuardrails,
              enabled: true,
            },
          ],
        })
      }

      const sessionRows = await request('conversation_sessions', {
        method: 'POST',
        query: {
          on_conflict: 'id',
        },
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: [
          {
            ...(sessionId ? { id: sessionId } : {}),
            legacy_spirit_session_id: isUuidText(orchestration.legacySpiritSessionId) ? orchestration.legacySpiritSessionId : null,
            role_pack_id: rolePackId || null,
            user_account: safeText(orchestration.userAccount),
            title: identifyName ? `${identifyName} 对话会话` : '灵化对话会话',
            status: 'active',
            diagnosis_context: diagnosisContext,
            retrieval_context: retrievalContext,
            memory_snapshot: {
              sessionSummary,
              longTermFacts,
              currentIntent: safeText(orchestration.currentIntent),
              userQuestion: question,
              assistantReply: reply,
            },
            turn_count: turnCount,
            last_message_at: nowIso,
          },
        ],
      })

      const sessionRow = Array.isArray(sessionRows) ? sessionRows[0] : null
      const conversationSessionId = safeText(sessionRow?.id)
      if (!conversationSessionId) {
        throw new ApiError(500, 'persist conversation session failed')
      }

      const summaryRows = await request('memory_summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: [
          {
            session_id: conversationSessionId,
            summary_type: 'rolling',
            summary: buildRollingSummary({
              question,
              reply,
              sessionSummary,
              longTermFacts,
            }),
            window_from_turn: Math.max(1, turnCount - 1),
            window_to_turn: turnCount,
          },
        ],
      })

      const summaryRow = Array.isArray(summaryRows) ? summaryRows[0] : null

      return {
        conversationSessionId,
        memorySummaryId: safeText(summaryRow?.id),
        rolePackId,
        rolePackName,
        memoryHits,
      }
    },

    async createSpiritCommunityDraft(payload) {
      const sessionId = safeText(payload?.sessionId)
      if (!sessionId) {
        throw new ApiError(400, 'sessionId is required')
      }

      const session = await findSpiritSession(sessionId)
      if (!session) {
        throw new ApiError(404, 'spirit session not found')
      }

      const built = buildSpiritCommunityDraft(session, payload)
      const rows = await request('spirit_community_drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: [
          {
            session_id: sessionId,
            title: built.title,
            content: built.content,
            markdown: built.markdown,
            image_url: built.image || null,
            mentions: built.mentions,
            topics: built.topics,
            status: 'draft',
          },
        ],
      })

      const created = Array.isArray(rows) ? rows[0] : null
      if (!created?.id) {
        throw new ApiError(500, 'create spirit community draft failed')
      }

      await refreshSessionDraftStats(sessionId)
      return mapSpiritDraft(created)
    },

    async listSpiritCommunityDrafts({ limit = 50, status = '' } = {}) {
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50))
      const query = {
        select: 'id,session_id,title,content,markdown,image_url,mentions,topics,status,published_post_id,published_at,created_at,updated_at',
        order: 'updated_at.desc',
        limit: safeLimit,
      }

      const normalizedStatus = safeText(status)
      if (normalizedStatus) {
        query.status = `eq.${normalizedStatus}`
      }

      const rows = (await request('spirit_community_drafts', { query })) ?? []
      return rows.map((row) => mapSpiritDraft(row))
    },

    async getSpiritCommunityDraft(draftId) {
      const normalized = safeText(draftId)
      if (!normalized) {
        return null
      }

      return findSpiritDraft(normalized)
    },

    async updateSpiritCommunityDraft(draftId, payload) {
      const normalized = safeText(draftId)
      if (!normalized) {
        throw new ApiError(400, 'draftId is required')
      }

      const updates = {}
      const title = safeText(payload?.title)
      const content = safeText(payload?.content)
      const markdown = safeText(payload?.markdown)
      const image = safeText(payload?.image)
      const mentions = asStringList(payload?.mentions).slice(0, 8)
      const topics = asStringList(payload?.topics).slice(0, 8)

      if (title) {
        updates.title = title
      }

      if (content) {
        updates.content = content
      }

      if (markdown) {
        updates.markdown = markdown
      }

      if (image) {
        updates.image_url = image
      }

      if (mentions.length > 0) {
        updates.mentions = mentions
      }

      if (topics.length > 0) {
        updates.topics = topics
      }

      if (Object.keys(updates).length === 0) {
        const existing = await findSpiritDraft(normalized)
        if (!existing) {
          throw new ApiError(404, 'spirit community draft not found')
        }

        return existing
      }

      const rows = await request('spirit_community_drafts', {
        method: 'PATCH',
        query: {
          id: `eq.${normalized}`,
        },
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: updates,
      })

      const updated = Array.isArray(rows) ? rows[0] : null
      if (!updated?.id) {
        throw new ApiError(404, 'spirit community draft not found')
      }

      await refreshSessionDraftStats(safeText(updated.session_id))
      return mapSpiritDraft(updated)
    },

    async publishSpiritCommunityDraft(draftId) {
      const normalized = safeText(draftId)
      if (!normalized) {
        throw new ApiError(400, 'draftId is required')
      }

      const existing = await findSpiritDraft(normalized)
      if (!existing) {
        throw new ApiError(404, 'spirit community draft not found')
      }

      if (existing.status === 'published' && existing.publishedPostId) {
        return {
          draft: existing,
          postId: existing.publishedPostId,
          reused: true,
        }
      }

      const createdPost = await this.createCommunityPost({
        title: existing.title,
        content: existing.content,
        markdown: existing.markdown || existing.content,
        image: existing.image || undefined,
        mentions: existing.mentions,
        topics: existing.topics,
      })

      const rows = await request('spirit_community_drafts', {
        method: 'PATCH',
        query: {
          id: `eq.${normalized}`,
        },
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: {
          status: 'published',
          published_post_id: createdPost.id,
          published_at: new Date().toISOString(),
        },
      })

      const updated = Array.isArray(rows) ? rows[0] : null
      if (!updated?.id) {
        throw new ApiError(500, 'publish spirit community draft failed')
      }

      await refreshSessionDraftStats(safeText(updated.session_id))

      return {
        draft: mapSpiritDraft(updated),
        postId: safeText(createdPost.id),
        reused: false,
      }
    },
  }
}
