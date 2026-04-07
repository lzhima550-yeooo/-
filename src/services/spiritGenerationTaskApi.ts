import { createHttpClient, HttpError } from './httpClient'
import type { SpiritGeneratePayload, SpiritGenerateResult } from './spiritGenerateApi'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

export type SpiritGenerationTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface SpiritGenerationTaskPayload {
  name?: string
  scientificName?: string
  keywords?: string[]
  autoRoute?: boolean
  identifyTypeLabel?: string
  identifyRiskLevel?: string
  presetId?: string
  workflowId?: string
  workflowPath?: string
  prompt?: string
  negativePrompt?: string
  width?: number
  height?: number
  steps?: number
  cfgScale?: number
  denoise?: number
  samplerName?: string
  scheduler?: string
  routingRuleId?: string
  routingRuleLabel?: string
  routingMatchedKeywords?: string[]
  diagnosisResult?: {
    diagnosis?: {
      name?: string
      category?: string
      symptom_tags?: string[]
      evidence_tags?: string[]
      host_plant?: string
      risk_level?: string
      confidence?: number
    }
    rolePack?: {
      id?: string
      name?: string
      style?: string
      persona?: string
      guardrails?: string[]
      visualKeywords?: string[]
      negativeKeywords?: string[]
    }
    styleMode?: string
  }
  rolePack?: {
    id?: string
    name?: string
    style?: string
    persona?: string
    guardrails?: string[]
    visualKeywords?: string[]
    negativeKeywords?: string[]
  }
  styleMode?: string
}

export interface SpiritGenerationTask {
  id: string
  type: string
  status: SpiritGenerationTaskStatus
  createdAt: string
  updatedAt: string
  startedAt: string
  finishedAt: string
  durationMs: number
  payload: SpiritGenerationTaskPayload
  result: SpiritGenerateResult | null
  error: string
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed' | 'timeout'
  message?: string
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })

const normalizeTaskPayload = (value: unknown): SpiritGenerationTaskPayload => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const routingMatchedKeywordsSource = record.routingMatchedKeywords ?? record.routing_matched_keywords
  const routingMatchedKeywordsRaw: unknown[] = Array.isArray(routingMatchedKeywordsSource) ? routingMatchedKeywordsSource : []

  return {
    name: String(record.name ?? '').trim(),
    scientificName: String(record.scientificName ?? record.scientific_name ?? '').trim(),
    keywords: Array.isArray(record.keywords) ? record.keywords.map((item) => String(item ?? '').trim()).filter(Boolean) : [],
    autoRoute: Boolean(record.autoRoute ?? record.auto_route),
    identifyTypeLabel: String(record.identifyTypeLabel ?? record.identify_type_label ?? '').trim(),
    identifyRiskLevel: String(record.identifyRiskLevel ?? record.identify_risk_level ?? '').trim(),
    presetId: String(record.presetId ?? record.preset_id ?? '').trim(),
    workflowId: String(record.workflowId ?? record.workflow_id ?? '').trim(),
    workflowPath: String(record.workflowPath ?? record.workflow_path ?? '').trim(),
    prompt: String(record.prompt ?? '').trim(),
    negativePrompt: String(record.negativePrompt ?? record.negative_prompt ?? '').trim(),
    width: Number.isFinite(Number(record.width)) ? Number(record.width) : undefined,
    height: Number.isFinite(Number(record.height)) ? Number(record.height) : undefined,
    steps: Number.isFinite(Number(record.steps)) ? Number(record.steps) : undefined,
    cfgScale: Number.isFinite(Number(record.cfgScale ?? record.cfg_scale)) ? Number(record.cfgScale ?? record.cfg_scale) : undefined,
    denoise: Number.isFinite(Number(record.denoise)) ? Number(record.denoise) : undefined,
    samplerName: String(record.samplerName ?? record.sampler_name ?? '').trim(),
    scheduler: String(record.scheduler ?? '').trim(),
    routingRuleId: String(record.routingRuleId ?? record.routing_rule_id ?? '').trim(),
    routingRuleLabel: String(record.routingRuleLabel ?? record.routing_rule_label ?? '').trim(),
    routingMatchedKeywords: routingMatchedKeywordsRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
    diagnosisResult:
      record.diagnosisResult && typeof record.diagnosisResult === 'object'
        ? (record.diagnosisResult as SpiritGenerationTaskPayload['diagnosisResult'])
        : undefined,
    rolePack: record.rolePack && typeof record.rolePack === 'object' ? (record.rolePack as SpiritGenerationTaskPayload['rolePack']) : undefined,
    styleMode: String(record.styleMode ?? record.style_mode ?? '').trim(),
  }
}

const normalizeTask = (value: unknown): SpiritGenerationTask => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const resultSource = record.result && typeof record.result === 'object' ? (record.result as Record<string, unknown>) : null
  const resultRoutingMatchedKeywordsSource = resultSource
    ? resultSource.routingMatchedKeywords ?? resultSource.routing_matched_keywords
    : []
  const resultRoutingMatchedKeywordsRaw: unknown[] = Array.isArray(resultRoutingMatchedKeywordsSource)
    ? resultRoutingMatchedKeywordsSource
    : []
  const resultExtractedPersonaTagsSource = resultSource
    ? resultSource.extractedPersonaTags ?? resultSource.extracted_persona_tags
    : []
  const resultExtractedPersonaTagsRaw: unknown[] = Array.isArray(resultExtractedPersonaTagsSource) ? resultExtractedPersonaTagsSource : []
  const personaSource = resultSource ? resultSource.personaDesignJson ?? resultSource.persona_design_json : {}
  const personaRecord = personaSource && typeof personaSource === 'object' ? (personaSource as Record<string, unknown>) : {}
  const promptStagesSource = resultSource ? resultSource.promptStages ?? resultSource.prompt_stages : {}
  const promptStagesRecord =
    promptStagesSource && typeof promptStagesSource === 'object' ? (promptStagesSource as Record<string, unknown>) : {}

  const result: SpiritGenerateResult | null = resultSource
    ? {
        promptId: String(resultSource.promptId ?? resultSource.prompt_id ?? '').trim(),
        imageUrl: String(resultSource.imageUrl ?? resultSource.image_url ?? '').trim(),
        imageUrlDirect: String(resultSource.imageUrlDirect ?? resultSource.image_url_direct ?? '').trim(),
        imageUrlProxy: String(resultSource.imageUrlProxy ?? resultSource.image_url_proxy ?? '').trim(),
        checkpoint: String(resultSource.checkpoint ?? '').trim(),
        prompt: String(resultSource.prompt ?? '').trim(),
        negativePrompt: String(resultSource.negativePrompt ?? resultSource.negative_prompt ?? '').trim(),
        samplerName: String(resultSource.samplerName ?? resultSource.sampler_name ?? '').trim(),
        scheduler: String(resultSource.scheduler ?? '').trim(),
        seed: Number.isFinite(Number(resultSource.seed)) ? Number(resultSource.seed) : undefined,
        filenamePrefix: String(resultSource.filenamePrefix ?? resultSource.filename_prefix ?? '').trim(),
        workflowMode: String(resultSource.workflowMode ?? resultSource.workflow_mode ?? '').trim(),
        workflowPath: String(resultSource.workflowPath ?? resultSource.workflow_path ?? '').trim(),
        workflowFallbackReason: String(resultSource.workflowFallbackReason ?? resultSource.workflow_fallback_reason ?? '').trim(),
        presetId: String(resultSource.presetId ?? resultSource.preset_id ?? '').trim(),
        workflowId: String(resultSource.workflowId ?? resultSource.workflow_id ?? '').trim(),
        routingRuleId: String(resultSource.routingRuleId ?? resultSource.routing_rule_id ?? '').trim(),
        routingRuleLabel: String(resultSource.routingRuleLabel ?? resultSource.routing_rule_label ?? '').trim(),
        routingMatchedKeywords: resultRoutingMatchedKeywordsRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
        comfyPromptPayloadHash: String(resultSource.comfyPromptPayloadHash ?? resultSource.comfy_prompt_payload_hash ?? '').trim(),
        extractedPersonaTags: resultExtractedPersonaTagsRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
        personaDesignJson: {
          coreConcept: String(personaRecord.coreConcept ?? personaRecord.core_concept ?? '').trim(),
          designDirection: String(personaRecord.designDirection ?? personaRecord.design_direction ?? '').trim(),
          colorPalette: Array.isArray(personaRecord.colorPalette ?? personaRecord.color_palette)
            ? ((personaRecord.colorPalette ?? personaRecord.color_palette) as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          silhouette: Array.isArray(personaRecord.silhouette)
            ? (personaRecord.silhouette as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          hairDesign: Array.isArray(personaRecord.hairDesign ?? personaRecord.hair_design)
            ? ((personaRecord.hairDesign ?? personaRecord.hair_design) as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          outfitElements: Array.isArray(personaRecord.outfitElements ?? personaRecord.outfit_elements)
            ? ((personaRecord.outfitElements ?? personaRecord.outfit_elements) as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          accessoryElements: Array.isArray(personaRecord.accessoryElements ?? personaRecord.accessory_elements)
            ? ((personaRecord.accessoryElements ?? personaRecord.accessory_elements) as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          textureMaterials: Array.isArray(personaRecord.textureMaterials ?? personaRecord.texture_materials)
            ? ((personaRecord.textureMaterials ?? personaRecord.texture_materials) as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          symbolicMotifs: Array.isArray(personaRecord.symbolicMotifs ?? personaRecord.symbolic_motifs)
            ? ((personaRecord.symbolicMotifs ?? personaRecord.symbolic_motifs) as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          temperament: Array.isArray(personaRecord.temperament)
            ? (personaRecord.temperament as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
          pose: Array.isArray(personaRecord.pose) ? (personaRecord.pose as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean) : [],
          forbiddenElements: Array.isArray(personaRecord.forbiddenElements ?? personaRecord.forbidden_elements)
            ? ((personaRecord.forbiddenElements ?? personaRecord.forbidden_elements) as unknown[]).map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : [],
        },
        promptStages: {
          visualMapping: String(promptStagesRecord.visualMapping ?? promptStagesRecord.visual_mapping ?? '').trim(),
          promptGeneration: String(promptStagesRecord.promptGeneration ?? promptStagesRecord.prompt_generation ?? '').trim(),
        },
      }
    : null

  const rawStatus = String(record.status ?? '').trim()
  const status: SpiritGenerationTaskStatus =
    rawStatus === 'running' || rawStatus === 'succeeded' || rawStatus === 'failed' ? rawStatus : 'queued'

  return {
    id: String(record.id ?? '').trim(),
    type: String(record.type ?? '').trim(),
    status,
    createdAt: String(record.createdAt ?? record.created_at ?? '').trim(),
    updatedAt: String(record.updatedAt ?? record.updated_at ?? '').trim(),
    startedAt: String(record.startedAt ?? record.started_at ?? '').trim(),
    finishedAt: String(record.finishedAt ?? record.finished_at ?? '').trim(),
    durationMs: Number.isFinite(Number(record.durationMs ?? record.duration_ms)) ? Number(record.durationMs ?? record.duration_ms) : 0,
    payload: normalizeTaskPayload(record.payload),
    result,
    error: String(record.error ?? '').trim(),
  }
}

export async function createSpiritGenerationTaskOnServer(payload: SpiritGeneratePayload): Promise<RemoteResult<SpiritGenerationTask>> {
  if (!apiClient) {
    return {
      ok: false,
      data: normalizeTask({}),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法创建生图任务。',
    }
  }

  try {
    const response = await apiClient.post<{ data?: unknown }>('/spirit/generate/tasks', {
      body: payload,
      requestKey: 'spirit-generate-task-create',
      timeoutMessage: '生图任务创建超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeTask(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: normalizeTask({}),
      reason: 'request_failed',
      message,
    }
  }
}

export async function fetchSpiritGenerationTaskFromServer(taskId: string): Promise<RemoteResult<SpiritGenerationTask>> {
  if (!apiClient) {
    return {
      ok: false,
      data: normalizeTask({}),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法查询生图任务。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>(`/spirit/generate/tasks/${encodeURIComponent(taskId)}`, {
      requestKey: `spirit-generate-task-${taskId}`,
      cancelPrevious: false,
      timeoutMessage: '生图任务查询超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeTask(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: normalizeTask({}),
      reason: 'request_failed',
      message,
    }
  }
}

export async function waitForSpiritGenerationTask(
  taskId: string,
  options?: {
    timeoutMs?: number
    intervalMs?: number
    onProgress?: (task: SpiritGenerationTask) => void
  },
): Promise<RemoteResult<SpiritGenerationTask>> {
  const timeoutMs = Math.max(2_000, options?.timeoutMs ?? 90_000)
  const intervalMs = Math.max(300, options?.intervalMs ?? 1_200)
  const startedAt = Date.now()

  while (Date.now() - startedAt <= timeoutMs) {
    const task = await fetchSpiritGenerationTaskFromServer(taskId)
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
    data: normalizeTask({
      id: taskId,
      status: 'failed',
      error: 'poll timeout',
    }),
    reason: 'timeout',
    message: '生图任务超时，请稍后重试。',
  }
}
