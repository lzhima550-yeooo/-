import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

const safeText = (value: unknown) => String(value ?? '').trim()

export interface SpiritChatMessagePayload {
  id?: string
  role: 'user' | 'spirit'
  text: string
}

export interface SpiritSessionPayload {
  identify: {
    taskId?: string
    name?: string
    scientificName?: string
    sourceRefs?: string[]
    keywords?: string[]
    summary?: string
    cover?: string
    encyclopediaId?: string
    provider?: string
    model?: string
  }
  generation: {
    taskId?: string
    status?: string
    imageUrl?: string
    promptId?: string
    prompt?: string
    negativePrompt?: string
    durationMs?: number
    presetId?: string
    workflowId?: string
    workflowPath?: string
    workflowMode?: string
    workflowFallbackReason?: string
    routingRuleId?: string
    routingRuleLabel?: string
    routingMatchedKeywords?: string[]
  }
  messages: SpiritChatMessagePayload[]
}

export interface SpiritSessionRecord extends SpiritSessionPayload {
  id: string
  createdAt: string
  updatedAt: string
  draftCount: number
  lastDraftAt: string
}

export interface SpiritCommunityDraftPayload {
  sessionId: string
  title?: string
  extraContext?: string
  image?: string
  topics?: string[]
  mentions?: string[]
}

export interface SpiritCommunityDraft {
  id: string
  sessionId: string
  title: string
  content: string
  markdown: string
  image: string
  topics: string[]
  mentions: string[]
  status: 'draft' | 'published'
  publishedPostId: string
  publishedAt: string
  createdAt: string
  updatedAt: string
}

export interface SpiritCommunityDraftUpdatePayload {
  title?: string
  content?: string
  markdown?: string
  image?: string
  topics?: string[]
  mentions?: string[]
}

export interface SpiritDraftPublishResult {
  draft: SpiritCommunityDraft
  postId: string
  reused: boolean
}

export interface SpiritGenerationStats {
  totalTasks: number
  queued: number
  running: number
  succeeded: number
  failed: number
  completed: number
  successRate: number
  averageDurationMs: number
  lastTaskUpdatedAt: string
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

const normalizeMessages = (value: unknown): SpiritChatMessagePayload[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const messages: SpiritChatMessagePayload[] = []

  value.forEach((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const text = safeText(record.text)
    if (!text) {
      return
    }

    messages.push({
      id: safeText(record.id) || undefined,
      role: record.role === 'user' ? 'user' : 'spirit',
      text,
    })
  })

  return messages
}

const normalizeSessionRecord = (value: unknown): SpiritSessionRecord => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const identifySource = record.identify && typeof record.identify === 'object' ? (record.identify as Record<string, unknown>) : {}
  const generationSource =
    record.generation && typeof record.generation === 'object' ? (record.generation as Record<string, unknown>) : {}
  const sourceRefsRaw = identifySource.sourceRefs ?? identifySource.source_refs
  const generationRoutingKeywordsSource = generationSource.routingMatchedKeywords ?? generationSource.routing_matched_keywords
  const generationRoutingKeywordsRaw: unknown[] = Array.isArray(generationRoutingKeywordsSource) ? generationRoutingKeywordsSource : []

  return {
    id: safeText(record.id),
    createdAt: safeText(record.createdAt ?? record.created_at),
    updatedAt: safeText(record.updatedAt ?? record.updated_at),
    identify: {
      taskId: safeText(identifySource.taskId ?? identifySource.task_id),
      name: safeText(identifySource.name),
      scientificName: safeText(identifySource.scientificName ?? identifySource.scientific_name),
      sourceRefs: Array.isArray(sourceRefsRaw)
        ? sourceRefsRaw
            .map((item: unknown) => safeText(item))
            .filter(Boolean)
        : [],
      keywords: Array.isArray(identifySource.keywords)
        ? identifySource.keywords.map((item) => safeText(item)).filter(Boolean)
        : [],
      summary: safeText(identifySource.summary),
      cover: safeText(identifySource.cover),
      encyclopediaId: safeText(identifySource.encyclopediaId ?? identifySource.encyclopedia_id),
      provider: safeText(identifySource.provider),
      model: safeText(identifySource.model),
    },
    generation: {
      taskId: safeText(generationSource.taskId ?? generationSource.task_id),
      status: safeText(generationSource.status),
      imageUrl: safeText(generationSource.imageUrl ?? generationSource.image_url),
      promptId: safeText(generationSource.promptId ?? generationSource.prompt_id),
      prompt: safeText(generationSource.prompt),
      negativePrompt: safeText(generationSource.negativePrompt ?? generationSource.negative_prompt),
      durationMs: Number.isFinite(Number(generationSource.durationMs ?? generationSource.duration_ms))
        ? Number(generationSource.durationMs ?? generationSource.duration_ms)
        : 0,
      presetId: safeText(generationSource.presetId ?? generationSource.preset_id),
      workflowId: safeText(generationSource.workflowId ?? generationSource.workflow_id),
      workflowPath: safeText(generationSource.workflowPath ?? generationSource.workflow_path),
      workflowMode: safeText(generationSource.workflowMode ?? generationSource.workflow_mode),
      workflowFallbackReason: safeText(generationSource.workflowFallbackReason ?? generationSource.workflow_fallback_reason),
      routingRuleId: safeText(generationSource.routingRuleId ?? generationSource.routing_rule_id),
      routingRuleLabel: safeText(generationSource.routingRuleLabel ?? generationSource.routing_rule_label),
      routingMatchedKeywords: generationRoutingKeywordsRaw.map((item: unknown) => safeText(item)).filter(Boolean),
    },
    messages: normalizeMessages(record.messages),
    draftCount: Number.isFinite(Number(record.draftCount ?? record.draft_count)) ? Number(record.draftCount ?? record.draft_count) : 0,
    lastDraftAt: safeText(record.lastDraftAt ?? record.last_draft_at),
  }
}

const normalizeDraft = (value: unknown): SpiritCommunityDraft => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const statusRaw = safeText(record.status)

  return {
    id: safeText(record.id),
    sessionId: safeText(record.sessionId ?? record.session_id),
    title: safeText(record.title),
    content: safeText(record.content),
    markdown: safeText(record.markdown),
    image: safeText(record.image ?? record.image_url),
    topics: Array.isArray(record.topics) ? record.topics.map((item) => safeText(item)).filter(Boolean) : [],
    mentions: Array.isArray(record.mentions) ? record.mentions.map((item) => safeText(item)).filter(Boolean) : [],
    status: statusRaw === 'published' ? 'published' : 'draft',
    publishedPostId: safeText(record.publishedPostId ?? record.published_post_id),
    publishedAt: safeText(record.publishedAt ?? record.published_at),
    createdAt: safeText(record.createdAt ?? record.created_at),
    updatedAt: safeText(record.updatedAt ?? record.updated_at),
  }
}

const normalizeStats = (value: unknown): SpiritGenerationStats => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const asNumber = (input: unknown) => {
    const num = Number(input)
    return Number.isFinite(num) ? num : 0
  }

  return {
    totalTasks: asNumber(record.totalTasks ?? record.total_tasks),
    queued: asNumber(record.queued),
    running: asNumber(record.running),
    succeeded: asNumber(record.succeeded),
    failed: asNumber(record.failed),
    completed: asNumber(record.completed),
    successRate: asNumber(record.successRate ?? record.success_rate),
    averageDurationMs: asNumber(record.averageDurationMs ?? record.average_duration_ms),
    lastTaskUpdatedAt: safeText(record.lastTaskUpdatedAt ?? record.last_task_updated_at),
  }
}

const normalizeDraftPublishResult = (value: unknown): SpiritDraftPublishResult => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  return {
    draft: normalizeDraft(record.draft),
    postId: safeText(record.postId ?? record.post_id),
    reused: Boolean(record.reused),
  }
}

const emptyDraft = (): SpiritCommunityDraft =>
  normalizeDraft({
    id: '',
    sessionId: '',
    title: '',
    content: '',
    markdown: '',
    image: '',
    topics: [],
    mentions: [],
    status: 'draft',
    publishedPostId: '',
    publishedAt: '',
    createdAt: '',
    updatedAt: '',
  })

export function buildLocalSpiritCommunityDraft(input: {
  identifyTaskId?: string
  identifyName: string
  scientificName: string
  sourceRefs?: string[]
  keywords: string[]
  summary: string
  imageUrl?: string
  generationTaskId?: string
  generationPromptId?: string
  generationPrompt?: string
  generationNegativePrompt?: string
  generationPresetId?: string
  generationWorkflowId?: string
  generationWorkflowPath?: string
  generationWorkflowMode?: string
  generationWorkflowFallbackReason?: string
  generationRoutingRuleLabel?: string
  durationMs?: number
  messages: SpiritChatMessagePayload[]
}): SpiritCommunityDraft {
  const identifyName = safeText(input.identifyName) || '未知对象'
  const scientificName = safeText(input.scientificName) || '待确认'
  const keywordText = input.keywords.length > 0 ? input.keywords.join(' / ') : '暂无关键词'
  const summary = safeText(input.summary) || '暂无识别摘要'
  const identifyTaskId = safeText(input.identifyTaskId)
  const sourceRefs = Array.isArray(input.sourceRefs) ? input.sourceRefs.map((item) => safeText(item)).filter(Boolean).slice(0, 8) : []
  const generationTaskId = safeText(input.generationTaskId)
  const generationPromptId = safeText(input.generationPromptId)
  const generationPrompt = safeText(input.generationPrompt)
  const generationNegativePrompt = safeText(input.generationNegativePrompt)
  const generationPresetId = safeText(input.generationPresetId)
  const generationWorkflowId = safeText(input.generationWorkflowId)
  const generationWorkflowPath = safeText(input.generationWorkflowPath)
  const generationWorkflowMode = safeText(input.generationWorkflowMode)
  const generationWorkflowFallbackReason = safeText(input.generationWorkflowFallbackReason)
  const generationRoutingRuleLabel = safeText(input.generationRoutingRuleLabel)
  const durationMs = Number.isFinite(Number(input.durationMs)) ? Math.max(0, Number(input.durationMs)) : 0
  const transcript = input.messages
    .slice(-4)
    .map((message, index) => `${index + 1}. ${message.role === 'user' ? '用户' : '灵化角色'}：${message.text}`)
    .join('\n')

  const content = [
    `识别对象：${identifyName}（${scientificName}）`,
    `识别任务ID：${identifyTaskId || '未关联'}`,
    `识别来源：${sourceRefs.length > 0 ? sourceRefs.join(' | ') : '暂无'}`,
    `关键词：${keywordText}`,
    `识别摘要：${summary}`,
    `生图任务ID：${generationTaskId || '未记录'}`,
    `生图参数：preset=${generationPresetId || '-'} / workflow=${generationWorkflowId || '-'} / promptId=${generationPromptId || '-'}`,
    `工作流画像：${generationRoutingRuleLabel || '默认/手动'} · mode=${generationWorkflowMode || 'unknown'}`,
    generationWorkflowPath ? `工作流路径：${generationWorkflowPath}` : '',
    generationWorkflowFallbackReason ? `工作流说明：${generationWorkflowFallbackReason}` : '',
    generationPrompt ? `正向提示词：${generationPrompt}` : '',
    generationNegativePrompt ? `反向提示词：${generationNegativePrompt}` : '',
    `生图耗时：${durationMs > 0 ? `${durationMs}ms` : '未记录'}`,
    transcript ? `对话摘录：\n${transcript}` : '对话摘录：暂无',
  ].join('\n')

  return {
    ...emptyDraft(),
    title: `【灵化记录】${identifyName}识别与防治建议`,
    content,
    markdown: content,
    image: safeText(input.imageUrl),
    topics: Array.from(new Set(['灵化角色', '校园植保', ...input.keywords.slice(0, 3)])).slice(0, 8),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function createSpiritSessionOnServer(payload: SpiritSessionPayload): Promise<RemoteResult<SpiritSessionRecord>> {
  if (!apiClient) {
    return {
      ok: false,
      data: normalizeSessionRecord({}),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法创建灵化会话。',
    }
  }

  try {
    const response = await apiClient.post<{ data?: unknown }>('/spirit/sessions', {
      body: payload,
      requestKey: 'spirit-session-create',
      timeoutMessage: '灵化会话创建超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeSessionRecord(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: normalizeSessionRecord({}),
      reason: 'request_failed',
      message,
    }
  }
}

export async function createSpiritCommunityDraftOnServer(
  payload: SpiritCommunityDraftPayload,
): Promise<RemoteResult<SpiritCommunityDraft>> {
  if (!apiClient) {
    return {
      ok: false,
      data: emptyDraft(),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法创建社区草稿。',
    }
  }

  try {
    const response = await apiClient.post<{ data?: unknown }>('/spirit/community-drafts', {
      body: payload,
      requestKey: 'spirit-community-draft-create',
      timeoutMessage: '社区草稿生成超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeDraft(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyDraft(),
      reason: 'request_failed',
      message,
    }
  }
}

export async function fetchSpiritCommunityDraftsFromServer(options?: {
  limit?: number
  status?: 'draft' | 'published' | ''
}): Promise<RemoteResult<SpiritCommunityDraft[]>> {
  if (!apiClient) {
    return {
      ok: false,
      data: [],
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法加载社区草稿历史。',
    }
  }

  try {
    const response = await apiClient.get<{ items?: unknown[] }>('/spirit/community-drafts', {
      query: {
        limit: options?.limit,
        status: options?.status || undefined,
      },
      requestKey: 'spirit-community-drafts-list',
      timeoutMessage: '社区草稿列表加载超时，请稍后重试。',
    })

    const items = Array.isArray(response.items)
      ? response.items.map((item) => normalizeDraft(item)).filter((item) => Boolean(item.id))
      : []

    return {
      ok: true,
      data: items,
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

export async function updateSpiritCommunityDraftOnServer(
  draftId: string,
  payload: SpiritCommunityDraftUpdatePayload,
): Promise<RemoteResult<SpiritCommunityDraft>> {
  if (!apiClient) {
    return {
      ok: false,
      data: emptyDraft(),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法更新草稿。',
    }
  }

  try {
    const response = await apiClient.patch<{ data?: unknown }>(`/spirit/community-drafts/${encodeURIComponent(draftId)}`, {
      body: payload,
      requestKey: `spirit-community-draft-update-${draftId}`,
      timeoutMessage: '草稿更新超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeDraft(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyDraft(),
      reason: 'request_failed',
      message,
    }
  }
}

export async function publishSpiritCommunityDraftOnServer(
  draftId: string,
): Promise<RemoteResult<SpiritDraftPublishResult>> {
  if (!apiClient) {
    return {
      ok: false,
      data: {
        draft: emptyDraft(),
        postId: '',
        reused: false,
      },
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法正式发布草稿。',
    }
  }

  try {
    const response = await apiClient.post<{ data?: unknown }>(`/spirit/community-drafts/${encodeURIComponent(draftId)}/publish`, {
      body: {},
      requestKey: `spirit-community-draft-publish-${draftId}`,
      timeoutMessage: '草稿发布超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeDraftPublishResult(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: {
        draft: emptyDraft(),
        postId: '',
        reused: false,
      },
      reason: 'request_failed',
      message,
    }
  }
}

export async function fetchSpiritGenerationStatsFromServer(): Promise<RemoteResult<SpiritGenerationStats>> {
  if (!apiClient) {
    return {
      ok: false,
      data: normalizeStats({}),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法加载生图统计。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>('/spirit/stats', {
      requestKey: 'spirit-stats',
      timeoutMessage: '生图统计加载超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeStats(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: normalizeStats({}),
      reason: 'request_failed',
      message,
    }
  }
}
