import { resolve } from 'node:path'

const safeText = (value) => String(value ?? '').trim()
const asList = (value) => (Array.isArray(value) ? value : [])
const normalizeKeyword = (value) => safeText(value).toLowerCase()
const normalizeTypeLabel = (value) => {
  const text = safeText(value)
  if (text === '病害' || text.toLowerCase() === 'disease') {
    return '病害'
  }

  if (text === '昆虫' || text.toLowerCase() === 'insect') {
    return '昆虫'
  }

  return ''
}

const normalizeRiskLevel = (value) => {
  const text = safeText(value).toLowerCase()
  if (text === 'critical' || text === 'high' || text === 'medium' || text === 'low') {
    return text
  }

  if (text === '高') {
    return 'high'
  }
  if (text === '中') {
    return 'medium'
  }
  if (text === '低') {
    return 'low'
  }

  return ''
}

const clampNumber = (value, min, max, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  return Math.max(min, Math.min(max, num))
}

const clampInteger = (value, min, max, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.round(num)))
}

const parseProfilesEnv = (raw, defaultWorkflowPath) => {
  const fallback = [
    {
      id: 'default',
      label: '默认原始工作流',
      path: defaultWorkflowPath,
    },
  ]

  const text = safeText(raw)
  if (!text) {
    return fallback
  }

  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      return fallback
    }

    const normalized = parsed
      .map((item, index) => {
        const record = item && typeof item === 'object' ? item : {}
        const id = safeText(record.id) || `workflow_${index + 1}`
        const label = safeText(record.label) || id
        const path = safeText(record.path)
        if (!path) {
          return null
        }

        return {
          id,
          label,
          path: resolve(path),
        }
      })
      .filter(Boolean)

    if (normalized.length === 0) {
      return fallback
    }

    if (!normalized.some((item) => item.id === 'default')) {
      normalized.unshift({
        id: 'default',
        label: '默认原始工作流',
        path: defaultWorkflowPath,
      })
    }

    return normalized
  } catch {
    return fallback
  }
}

const defaultPresets = [
  {
    id: 'campus_anime',
    label: '校园清新风',
    description: '适合灵化角色的二次元校园风立绘。',
    width: 768,
    height: 1024,
    steps: 20,
    cfgScale: 7,
    denoise: 1,
    samplerName: 'euler_ancestral',
    scheduler: 'karras',
    negativePrompt: 'worst quality, lowres, blurry, text, watermark, bad anatomy',
  },
  {
    id: 'campus_green_mascot',
    label: 'Campus Green Mascot',
    description: 'Child-friendly campus eco mascot full-body portrait profile.',
    width: 768,
    height: 1024,
    steps: 24,
    cfgScale: 7,
    denoise: 1,
    samplerName: 'dpmpp_2m',
    scheduler: 'karras',
    negativePrompt:
      'sexy, mature woman, adult body proportion, long legs, realistic woman ratio, monster girl, body horror, dark horror insect, generic anime girl, battle scene',
    outputSpec: {
      aspectRatio: '3:4',
      fullBodyRequired: true,
      singleCharacter: true,
      cleanBackgroundPreferred: true,
      hostPlantAnchorAllowed: true,
    },
  },
  {
    id: 'science_card',
    label: '科普图鉴风',
    description: '适合图鉴展示的清晰插画风。',
    width: 832,
    height: 1216,
    steps: 24,
    cfgScale: 6.5,
    denoise: 1,
    samplerName: 'dpmpp_2m',
    scheduler: 'karras',
    negativePrompt: 'blurry, noisy, low detail, text, watermark',
  },
  {
    id: 'insect_anatomy',
    label: '昆虫形态强化',
    description: '优先表现触角、节肢、鞘翅、腹部等昆虫结构的拟人立绘。',
    width: 832,
    height: 1152,
    steps: 26,
    cfgScale: 7.5,
    denoise: 1,
    samplerName: 'dpmpp_2m',
    scheduler: 'karras',
    negativePrompt:
      'generic anime girl, plain school uniform, missing antennae, missing segmented arthropod limbs, missing elytra, blurry, text, watermark',
  },
  {
    id: 'portrait_real',
    label: '写实肖像风',
    description: '更接近写实风格的人像渲染。',
    width: 768,
    height: 1152,
    steps: 28,
    cfgScale: 6,
    denoise: 1,
    samplerName: 'dpmpp_2m_sde',
    scheduler: 'normal',
    negativePrompt: 'cartoon, anime, text, watermark, low quality',
  },
]

const resolveAspectRatioFromDimensions = (width, height) => {
  if (width <= 0 || height <= 0) {
    return '3:4'
  }

  const ratio = width / height
  const delta34 = Math.abs(ratio - 3 / 4)
  const delta23 = Math.abs(ratio - 2 / 3)
  return delta23 < delta34 ? '2:3' : '3:4'
}

const sanitizeOutputSpec = (outputSpec, width, height) => {
  const source = outputSpec && typeof outputSpec === 'object' ? outputSpec : {}
  const ratioCandidate = safeText(source.aspectRatio ?? source.aspect_ratio)
  const aspectRatio = ratioCandidate === '2:3' || ratioCandidate === '3:4' ? ratioCandidate : resolveAspectRatioFromDimensions(width, height)

  return {
    aspectRatio,
    fullBodyRequired: source.fullBodyRequired === undefined ? true : Boolean(source.fullBodyRequired),
    singleCharacter: source.singleCharacter === undefined ? true : Boolean(source.singleCharacter),
    cleanBackgroundPreferred: source.cleanBackgroundPreferred === undefined ? true : Boolean(source.cleanBackgroundPreferred),
    hostPlantAnchorAllowed: source.hostPlantAnchorAllowed === undefined ? true : Boolean(source.hostPlantAnchorAllowed),
  }
}

const defaultRoutingRules = [
  {
    id: 'disease-diagnosis-priority',
    label: '病害诊断优先',
    description: '病害与病斑类标签优先使用科普图鉴风，便于症状细节比对。',
    priority: 95,
    typeLabels: ['病害'],
    matchKeywords: ['病斑', '霉', '腐烂', '枯萎', '白粉', '锈病'],
    presetId: 'science_card',
    workflowId: 'default',
  },
  {
    id: 'pest-outbreak-priority',
    label: '虫害扩散优先',
    description: '虫害扩散关键词优先使用科普图鉴风，突出体征与处置节奏。',
    priority: 88,
    typeLabels: ['昆虫'],
    matchKeywords: ['蚜虫', '介壳虫', '红蜘蛛', '蓟马', '飞虱', '爆发'],
    presetId: 'campus_green_mascot',
    workflowId: 'default',
  },
  {
    id: 'beneficial-guardian',
    label: '益虫守护者',
    description: '益虫/天敌标签仍优先保留昆虫壳体与翅鞘结构，再叠加守护型角色表达。',
    priority: 72,
    typeLabels: ['昆虫'],
    matchKeywords: ['益虫', '天敌', '瓢虫', '捕食'],
    presetId: 'campus_green_mascot',
    workflowId: 'default',
  },
  {
    id: 'general-insect-anatomy',
    label: '昆虫形态兜底',
    description: '所有昆虫默认优先表现解剖与体态，再决定校园风格细节。',
    priority: 24,
    typeLabels: ['昆虫'],
    matchKeywords: [],
    presetId: 'campus_green_mascot',
    workflowId: 'default',
  },
  {
    id: 'default-campus-style',
    label: '默认校园风',
    description: '兜底规则：未命中标签时使用默认预设与默认工作流。',
    priority: 0,
    typeLabels: [],
    matchKeywords: [],
    presetId: 'campus_anime',
    workflowId: 'default',
  },
]

const allowedSamplers = new Set([
  'euler',
  'euler_ancestral',
  'heun',
  'dpmpp_2m',
  'dpmpp_2m_sde',
  'dpmpp_sde',
  'uni_pc',
  'uni_pc_bh2',
])

const allowedSchedulers = new Set([
  'normal',
  'karras',
  'exponential',
  'sgm_uniform',
  'simple',
  'ddim_uniform',
  'beta',
])

const sanitizePreset = (preset) => {
  const width = clampInteger(preset.width, 256, 1536, 768)
  const height = clampInteger(preset.height, 256, 1536, 1024)
  return {
    id: preset.id,
    label: preset.label,
    description: preset.description,
    width,
    height,
    steps: clampInteger(preset.steps, 6, 100, 20),
    cfgScale: clampNumber(preset.cfgScale, 1, 20, 7),
    denoise: clampNumber(preset.denoise, 0, 1, 1),
    samplerName: allowedSamplers.has(safeText(preset.samplerName)) ? safeText(preset.samplerName) : 'euler_ancestral',
    scheduler: allowedSchedulers.has(safeText(preset.scheduler)) ? safeText(preset.scheduler) : 'normal',
    negativePrompt: safeText(preset.negativePrompt),
    outputSpec: sanitizeOutputSpec(preset.outputSpec, width, height),
  }
}

const sanitizeRoutingRule = (rule, index, presetMap, workflowMap, defaultPresetId, defaultWorkflowId) => {
  const record = rule && typeof rule === 'object' ? rule : {}
  const id = safeText(record.id) || `routing_rule_${index + 1}`
  const label = safeText(record.label) || id
  const description = safeText(record.description)
  const priority = Number.isFinite(Number(record.priority)) ? Number(record.priority) : 0
  const typeLabels = asList(record.typeLabels)
    .map((item) => normalizeTypeLabel(item))
    .filter(Boolean)
  const riskLevels = asList(record.riskLevels)
    .map((item) => normalizeRiskLevel(item))
    .filter(Boolean)
  const matchKeywords = asList(record.matchKeywords)
    .map((item) => safeText(item))
    .filter(Boolean)

  const presetCandidate = safeText(record.presetId)
  const workflowCandidate = safeText(record.workflowId)
  const presetId = presetMap.has(presetCandidate) ? presetCandidate : defaultPresetId
  const workflowId = workflowMap.has(workflowCandidate) ? workflowCandidate : defaultWorkflowId

  return {
    id,
    label,
    description,
    priority,
    typeLabels,
    riskLevels,
    matchKeywords,
    presetId,
    workflowId,
  }
}

const parseRoutingRulesEnv = ({
  raw,
  presetMap,
  workflowMap,
  defaultPresetId,
  defaultWorkflowId,
}) => {
  const fallback = defaultRoutingRules.map((rule, index) =>
    sanitizeRoutingRule(rule, index, presetMap, workflowMap, defaultPresetId, defaultWorkflowId),
  )
  const text = safeText(raw)
  if (!text) {
    return fallback
  }

  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) {
      return fallback
    }

    const normalized = parsed
      .map((rule, index) => sanitizeRoutingRule(rule, index, presetMap, workflowMap, defaultPresetId, defaultWorkflowId))
      .filter(Boolean)
      .sort((left, right) => Number(right.priority) - Number(left.priority))

    return normalized.length > 0 ? normalized : fallback
  } catch {
    return fallback
  }
}

const findRoutingDecision = (input, routingRules) => {
  const routeInput = input && typeof input === 'object' ? input : {}
  const keywords = Array.from(
    new Set(
      asList(routeInput.keywords)
        .map((item) => normalizeKeyword(item))
        .filter(Boolean),
    ),
  )
  const typeLabel = normalizeTypeLabel(routeInput.identifyTypeLabel)
  const riskLevel = normalizeRiskLevel(routeInput.identifyRiskLevel)

  let best = null

  routingRules.forEach((rule) => {
    const requiredTypeLabels = asList(rule.typeLabels)
    if (requiredTypeLabels.length > 0 && (!typeLabel || !requiredTypeLabels.includes(typeLabel))) {
      return
    }

    const requiredRiskLevels = asList(rule.riskLevels)
    if (requiredRiskLevels.length > 0 && (!riskLevel || !requiredRiskLevels.includes(riskLevel))) {
      return
    }

    const ruleKeywords = asList(rule.matchKeywords).map((item) => normalizeKeyword(item)).filter(Boolean)
    const matchedKeywords = ruleKeywords.filter((keyword) =>
      keywords.some((item) => item.includes(keyword) || keyword.includes(item)),
    )
    if (ruleKeywords.length > 0 && matchedKeywords.length === 0) {
      return
    }

    const score =
      Number(rule.priority || 0) +
      matchedKeywords.length * 5 +
      (requiredTypeLabels.length > 0 && typeLabel ? 2 : 0) +
      (requiredRiskLevels.length > 0 && riskLevel ? 2 : 0)

    if (!best || score > best.score) {
      best = {
        score,
        rule,
        matchedKeywords,
      }
    }
  })

  return best
}

export function createSpiritGenerationConfig({
  defaultWorkflowPath,
  workflowProfilesEnv = process.env.COMFYUI_WORKFLOW_PROFILES,
  workflowRoutingRulesEnv = process.env.COMFYUI_WORKFLOW_ROUTING_RULES,
} = {}) {
  const normalizedDefaultPath = resolve(safeText(defaultWorkflowPath))
  const presets = defaultPresets.map((preset) => sanitizePreset(preset))
  const presetMap = new Map(presets.map((preset) => [preset.id, preset]))
  const workflows = parseProfilesEnv(workflowProfilesEnv, normalizedDefaultPath)
  const workflowMap = new Map(workflows.map((workflow) => [workflow.id, workflow]))
  const defaultPreset = presets[0]
  const defaultWorkflow = workflowMap.get('default') ?? workflows[0]
  const workflowRoutingRules = parseRoutingRulesEnv({
    raw: workflowRoutingRulesEnv,
    presetMap,
    workflowMap,
    defaultPresetId: defaultPreset.id,
    defaultWorkflowId: defaultWorkflow.id,
  })

  return {
    listConfig() {
      return {
        defaultPresetId: defaultPreset.id,
        defaultWorkflowId: defaultWorkflow.id,
        presets: presets.map((preset) => ({
          ...preset,
          outputSpec: { ...preset.outputSpec },
        })),
        workflows: workflows.map((workflow) => ({ ...workflow })),
        workflowRoutingRules: workflowRoutingRules.map((rule) => ({
          ...rule,
          matchKeywords: [...rule.matchKeywords],
          typeLabels: [...rule.typeLabels],
          riskLevels: [...rule.riskLevels],
        })),
        samplerWhitelist: Array.from(allowedSamplers),
        schedulerWhitelist: Array.from(allowedSchedulers),
      }
    },

    resolvePayload(rawPayload) {
      const input = rawPayload && typeof rawPayload === 'object' ? rawPayload : {}
      const requestedPresetId = safeText(input.presetId)
      const requestedWorkflowId = safeText(input.workflowId)
      const autoRoute = Boolean(input.autoRoute)
      const routingDecision = findRoutingDecision(input, workflowRoutingRules)

      const routedPresetId = safeText(routingDecision?.rule?.presetId)
      const routedWorkflowId = safeText(routingDecision?.rule?.workflowId)
      const selectedPreset =
        presetMap.get(requestedPresetId) ??
        (autoRoute && presetMap.get(routedPresetId)) ??
        defaultPreset
      const selectedWorkflow =
        workflowMap.get(requestedWorkflowId) ??
        (autoRoute && workflowMap.get(routedWorkflowId)) ??
        defaultWorkflow

      const samplerNameCandidate = safeText(input.samplerName)
      const schedulerCandidate = safeText(input.scheduler)
      const routingApplied = autoRoute && Boolean(routingDecision?.rule)
      const routingRuleId = routingApplied ? safeText(routingDecision?.rule?.id) : ''
      const routingRuleLabel = routingApplied ? safeText(routingDecision?.rule?.label) : ''
      const routingMatchedKeywords = routingApplied ? asList(routingDecision?.matchedKeywords).map((item) => safeText(item)).filter(Boolean) : []
      const resolvedWidth = clampInteger(input.width, 256, 1536, selectedPreset.width)
      const resolvedHeight = clampInteger(input.height, 256, 1536, selectedPreset.height)
      const inputOutputSpec = input.outputSpec && typeof input.outputSpec === 'object' ? input.outputSpec : null
      const outputSpec = sanitizeOutputSpec(inputOutputSpec ?? selectedPreset.outputSpec, resolvedWidth, resolvedHeight)

      return {
        ...input,
        autoRoute,
        presetId: selectedPreset.id,
        workflowId: selectedWorkflow.id,
        workflowPath: selectedWorkflow.path,
        width: resolvedWidth,
        height: resolvedHeight,
        steps: clampInteger(input.steps, 6, 100, selectedPreset.steps),
        cfgScale: clampNumber(input.cfgScale, 1, 20, selectedPreset.cfgScale),
        denoise: clampNumber(input.denoise, 0, 1, selectedPreset.denoise),
        samplerName: allowedSamplers.has(samplerNameCandidate) ? samplerNameCandidate : selectedPreset.samplerName,
        scheduler: allowedSchedulers.has(schedulerCandidate) ? schedulerCandidate : selectedPreset.scheduler,
        negativePrompt: safeText(input.negativePrompt) || selectedPreset.negativePrompt,
        outputSpec,
        routingRuleId,
        routingRuleLabel,
        routingMatchedKeywords,
      }
    },
  }
}
