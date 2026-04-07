import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

export interface SpiritGeneratePayload {
  name: string
  scientificName?: string
  keywords: string[]
  autoRoute?: boolean
  identifyTypeLabel?: string
  identifyRiskLevel?: string
  presetId?: string
  workflowId?: string
  prompt?: string
  negativePrompt?: string
  checkpoint?: string
  width?: number
  height?: number
  steps?: number
  cfgScale?: number
  denoise?: number
  samplerName?: string
  scheduler?: string
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

export interface SpiritPersonaDesign {
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

export interface SpiritGenerateResult {
  promptId: string
  imageUrl: string
  imageUrlDirect?: string
  imageUrlProxy?: string
  checkpoint?: string
  prompt?: string
  negativePrompt?: string
  samplerName?: string
  scheduler?: string
  seed?: number
  filenamePrefix?: string
  workflowMode?: string
  workflowPath?: string
  workflowFallbackReason?: string
  presetId?: string
  workflowId?: string
  routingRuleId?: string
  routingRuleLabel?: string
  routingMatchedKeywords?: string[]
  comfyPromptPayloadHash?: string
  extractedPersonaTags?: string[]
  personaDesignJson?: SpiritPersonaDesign
  promptStages?: {
    visualMapping?: string
    promptGeneration?: string
  }
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

const toStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []

const normalizeResult = (input: unknown): SpiritGenerateResult => {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const routingMatchedKeywordsSource = record.routingMatchedKeywords ?? record.routing_matched_keywords
  const routingMatchedKeywordsRaw: unknown[] = Array.isArray(routingMatchedKeywordsSource) ? routingMatchedKeywordsSource : []
  const extractedPersonaTagsSource = record.extractedPersonaTags ?? record.extracted_persona_tags
  const extractedPersonaTagsRaw: unknown[] = Array.isArray(extractedPersonaTagsSource) ? extractedPersonaTagsSource : []
  const personaSource = record.personaDesignJson ?? record.persona_design_json
  const personaRecord = personaSource && typeof personaSource === 'object' ? (personaSource as Record<string, unknown>) : {}
  const promptStagesSource = record.promptStages ?? record.prompt_stages
  const promptStagesRecord =
    promptStagesSource && typeof promptStagesSource === 'object' ? (promptStagesSource as Record<string, unknown>) : {}

  return {
    promptId: String(record.promptId ?? record.prompt_id ?? '').trim(),
    imageUrl: String(record.imageUrl ?? record.image_url ?? '').trim(),
    imageUrlDirect: String(record.imageUrlDirect ?? record.image_url_direct ?? '').trim(),
    imageUrlProxy: String(record.imageUrlProxy ?? record.image_url_proxy ?? '').trim(),
    checkpoint: String(record.checkpoint ?? '').trim(),
    prompt: String(record.prompt ?? '').trim(),
    negativePrompt: String(record.negativePrompt ?? record.negative_prompt ?? '').trim(),
    samplerName: String(record.samplerName ?? record.sampler_name ?? '').trim(),
    scheduler: String(record.scheduler ?? '').trim(),
    seed: Number.isFinite(Number(record.seed)) ? Number(record.seed) : undefined,
    filenamePrefix: String(record.filenamePrefix ?? record.filename_prefix ?? '').trim(),
    workflowMode: String(record.workflowMode ?? record.workflow_mode ?? '').trim(),
    workflowPath: String(record.workflowPath ?? record.workflow_path ?? '').trim(),
    workflowFallbackReason: String(record.workflowFallbackReason ?? record.workflow_fallback_reason ?? '').trim(),
    presetId: String(record.presetId ?? record.preset_id ?? '').trim(),
    workflowId: String(record.workflowId ?? record.workflow_id ?? '').trim(),
    routingRuleId: String(record.routingRuleId ?? record.routing_rule_id ?? '').trim(),
    routingRuleLabel: String(record.routingRuleLabel ?? record.routing_rule_label ?? '').trim(),
    routingMatchedKeywords: routingMatchedKeywordsRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
    comfyPromptPayloadHash: String(record.comfyPromptPayloadHash ?? record.comfy_prompt_payload_hash ?? '').trim(),
    extractedPersonaTags: extractedPersonaTagsRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
    personaDesignJson: {
      coreConcept: String(personaRecord.coreConcept ?? personaRecord.core_concept ?? '').trim(),
      designDirection: String(personaRecord.designDirection ?? personaRecord.design_direction ?? '').trim(),
      colorPalette: toStringList(personaRecord.colorPalette ?? personaRecord.color_palette),
      silhouette: toStringList(personaRecord.silhouette),
      hairDesign: toStringList(personaRecord.hairDesign ?? personaRecord.hair_design),
      outfitElements: toStringList(personaRecord.outfitElements ?? personaRecord.outfit_elements),
      accessoryElements: toStringList(personaRecord.accessoryElements ?? personaRecord.accessory_elements),
      textureMaterials: toStringList(personaRecord.textureMaterials ?? personaRecord.texture_materials),
      symbolicMotifs: toStringList(personaRecord.symbolicMotifs ?? personaRecord.symbolic_motifs),
      temperament: toStringList(personaRecord.temperament),
      pose: toStringList(personaRecord.pose),
      forbiddenElements: toStringList(personaRecord.forbiddenElements ?? personaRecord.forbidden_elements),
    },
    promptStages: {
      visualMapping: String(promptStagesRecord.visualMapping ?? promptStagesRecord.visual_mapping ?? '').trim(),
      promptGeneration: String(promptStagesRecord.promptGeneration ?? promptStagesRecord.prompt_generation ?? '').trim(),
    },
  }
}

export async function generateSpiritPortraitOnServer(payload: SpiritGeneratePayload): Promise<RemoteResult<SpiritGenerateResult>> {
  if (!apiClient) {
    return {
      ok: false,
      data: normalizeResult({}),
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，当前使用默认立绘。',
    }
  }

  try {
    const response = await apiClient.post<{ data?: unknown; imageUrl?: string; promptId?: string }>('/spirit/generate', {
      body: payload,
      requestKey: 'spirit-generate',
      cancelPrevious: true,
      timeoutMessage: '灵化生图请求超时，请稍后重试。',
    })

    const normalized = normalizeResult(response.data ?? response)
    if (!normalized.imageUrl) {
      return {
        ok: false,
        data: normalized,
        reason: 'request_failed',
        message: '生图返回为空，已切换默认立绘。',
      }
    }

    return {
      ok: true,
      data: normalized,
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: normalizeResult({}),
      reason: 'request_failed',
      message,
    }
  }
}
