import { createHttpClient, HttpError } from './httpClient'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim()
const apiClient = apiBaseUrl ? createHttpClient({ baseUrl: apiBaseUrl }) : null

export interface SpiritGenerationPreset {
  id: string
  label: string
  description: string
  width: number
  height: number
  steps: number
  cfgScale: number
  denoise: number
  samplerName: string
  scheduler: string
  negativePrompt: string
}

export interface SpiritWorkflowProfile {
  id: string
  label: string
  path: string
}

export interface SpiritWorkflowRoutingRule {
  id: string
  label: string
  description: string
  priority: number
  typeLabels: string[]
  riskLevels: string[]
  matchKeywords: string[]
  presetId: string
  workflowId: string
}

export interface SpiritGenerationConfig {
  defaultPresetId: string
  defaultWorkflowId: string
  presets: SpiritGenerationPreset[]
  workflows: SpiritWorkflowProfile[]
  workflowRoutingRules: SpiritWorkflowRoutingRule[]
  samplerWhitelist: string[]
  schedulerWhitelist: string[]
}

export interface RemoteResult<T> {
  ok: boolean
  data: T
  reason?: 'not_configured' | 'request_failed'
  message?: string
}

const emptyConfig: SpiritGenerationConfig = {
  defaultPresetId: '',
  defaultWorkflowId: '',
  presets: [],
  workflows: [],
  workflowRoutingRules: [],
  samplerWhitelist: [],
  schedulerWhitelist: [],
}

const asNumber = (value: unknown, fallback: number) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const normalizeConfig = (value: unknown): SpiritGenerationConfig => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

  const presetsRaw = Array.isArray(record.presets) ? record.presets : []
  const workflowsRaw = Array.isArray(record.workflows) ? record.workflows : []
  const routingRulesSource = record.workflowRoutingRules ?? record.workflow_routing_rules
  const routingRulesRaw: unknown[] = Array.isArray(routingRulesSource) ? routingRulesSource : []
  const samplerWhitelistSource = record.samplerWhitelist ?? record.sampler_whitelist
  const schedulerWhitelistSource = record.schedulerWhitelist ?? record.scheduler_whitelist
  const samplerWhitelistRaw: unknown[] = Array.isArray(samplerWhitelistSource) ? samplerWhitelistSource : []
  const schedulerWhitelistRaw: unknown[] = Array.isArray(schedulerWhitelistSource) ? schedulerWhitelistSource : []

  const presets: SpiritGenerationPreset[] = presetsRaw
    .map((item) => {
      const preset = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const id = String(preset.id ?? '').trim()
      const label = String(preset.label ?? '').trim()
      if (!id || !label) {
        return null
      }

      return {
        id,
        label,
        description: String(preset.description ?? '').trim(),
        width: asNumber(preset.width, 768),
        height: asNumber(preset.height, 1024),
        steps: asNumber(preset.steps, 20),
        cfgScale: asNumber(preset.cfgScale ?? preset.cfg_scale, 7),
        denoise: asNumber(preset.denoise, 1),
        samplerName: String(preset.samplerName ?? preset.sampler_name ?? 'euler').trim(),
        scheduler: String(preset.scheduler ?? 'normal').trim(),
        negativePrompt: String(preset.negativePrompt ?? preset.negative_prompt ?? '').trim(),
      }
    })
    .filter((item): item is SpiritGenerationPreset => Boolean(item))

  const workflows: SpiritWorkflowProfile[] = workflowsRaw
    .map((item) => {
      const workflow = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const id = String(workflow.id ?? '').trim()
      const label = String(workflow.label ?? '').trim()
      const path = String(workflow.path ?? '').trim()
      if (!id || !label || !path) {
        return null
      }

      return { id, label, path }
    })
    .filter((item): item is SpiritWorkflowProfile => Boolean(item))

  const workflowRoutingRules: SpiritWorkflowRoutingRule[] = routingRulesRaw
    .map((item, index) => {
      const rule = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
      const id = String(rule.id ?? '').trim() || `routing_rule_${index + 1}`
      const label = String(rule.label ?? '').trim() || id
      const presetId = String(rule.presetId ?? rule.preset_id ?? '').trim()
      const workflowId = String(rule.workflowId ?? rule.workflow_id ?? '').trim()
      if (!presetId || !workflowId) {
        return null
      }

      const toList = (value: unknown) =>
        Array.isArray(value) ? value.map((entry) => String(entry ?? '').trim()).filter(Boolean) : []

      return {
        id,
        label,
        description: String(rule.description ?? '').trim(),
        priority: asNumber(rule.priority, 0),
        typeLabels: toList(rule.typeLabels ?? rule.type_labels),
        riskLevels: toList(rule.riskLevels ?? rule.risk_levels),
        matchKeywords: toList(rule.matchKeywords ?? rule.match_keywords),
        presetId,
        workflowId,
      }
    })
    .filter((item): item is SpiritWorkflowRoutingRule => Boolean(item))
    .sort((left, right) => right.priority - left.priority)

  return {
    defaultPresetId: String(record.defaultPresetId ?? record.default_preset_id ?? presets[0]?.id ?? '').trim(),
    defaultWorkflowId: String(record.defaultWorkflowId ?? record.default_workflow_id ?? workflows[0]?.id ?? '').trim(),
    presets,
    workflows,
    workflowRoutingRules,
    samplerWhitelist: samplerWhitelistRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
    schedulerWhitelist: schedulerWhitelistRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean),
  }
}

export async function fetchSpiritGenerationConfigFromServer(): Promise<RemoteResult<SpiritGenerationConfig>> {
  if (!apiClient) {
    return {
      ok: false,
      data: emptyConfig,
      reason: 'not_configured',
      message: '未配置 VITE_API_BASE_URL，无法加载生图配置。',
    }
  }

  try {
    const response = await apiClient.get<{ data?: unknown }>('/spirit/config', {
      requestKey: 'spirit-generation-config',
      timeoutMessage: '生图配置加载超时，请稍后重试。',
    })

    return {
      ok: true,
      data: normalizeConfig(response.data ?? response),
    }
  } catch (error) {
    const message = error instanceof HttpError ? `请求失败：${error.status}` : '请求失败，请稍后重试。'
    return {
      ok: false,
      data: emptyConfig,
      reason: 'request_failed',
      message,
    }
  }
}
