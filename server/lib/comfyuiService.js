import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApiError } from './errors.js'
import { buildAnimePersonaPromptFromDiagnosis } from './spiritPersonaPromptBuilder.js'
import { createSpiritPersonaPipeline } from './spiritPersonaPipeline.js'

const safeText = (value) => String(value ?? '').trim()

const sleep = (ms) => new Promise((resolveTimer) => setTimeout(resolveTimer, ms))

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const safeNumber = (value, fallback) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const normalizeBaseUrl = (value) => safeText(value).replace(/\/+$/, '')
const normalizeProxyPath = (value) => {
  const text = safeText(value)
  if (!text) {
    return '/api/spirit/comfyui/view'
  }

  return text.startsWith('/') ? text : `/${text}`
}

const deepClone = (value) => JSON.parse(JSON.stringify(value))
const moduleDir = dirname(fileURLToPath(import.meta.url))
const defaultWorkflowPath = resolve(moduleDir, '..', '..', '..', 'comfyui', '默认原始工作流.json')

export const resolveDefaultComfyuiWorkflowPath = () => defaultWorkflowPath

const defaultPositivePrompt = (payload) => {
  const features = payload.keywords.slice(0, 8).join(', ')
  const parts = [
    'masterpiece',
    'best quality',
    'anime style',
    'single character portrait',
    'detailed face',
    'campus botanical guardian',
  ]

  if (payload.name) {
    parts.push(payload.name)
  }
  if (payload.scientificName) {
    parts.push(payload.scientificName)
  }
  if (features) {
    parts.push(features)
  }

  return parts.join(', ')
}

const defaultNegativePrompt =
  'worst quality, lowres, blurry, text, watermark, logo, bad anatomy, extra fingers, deformed'

const defaultDiagnosticPayload = {
  name: '',
  scientificName: '',
  keywords: [],
  prompt: '',
  negativePrompt: '',
  checkpoint: '',
  filenamePrefix: 'summer-wood/spirit',
  seed: null,
  width: 768,
  height: 1024,
  steps: 20,
  cfgScale: 7,
  denoise: 1,
  samplerName: 'euler',
  scheduler: 'normal',
}

const CAMPUS_GREEN_MASCOT_MODE = 'campus_green_mascot'

const campusGreenMascotRatioConstraints = [
  'chibi proportion',
  'large head small body',
  'head-to-body ratio around 1:2.5 to 1:3.5',
  'short limbs',
  'small hands and feet',
  'soft rounded form',
  'child-friendly mascot body ratio',
]

const isCampusGreenMascotMode = (styleMode) => safeText(styleMode).toLowerCase() === CAMPUS_GREEN_MASCOT_MODE

const extractLoraTags = (promptText) => {
  const text = safeText(promptText)
  if (!text) {
    return []
  }
  return Array.from(text.matchAll(/<[^>]+>/g))
    .map((item) => safeText(item[0]))
    .filter(Boolean)
}

const normalizePromptCommaSpace = (promptText) =>
  safeText(promptText)
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^,\s*/g, '')
    .replace(/\s*,$/g, '')
    .trim()

const sanitizePromptForStyleMode = (promptText, styleMode) => {
  const rawPrompt = safeText(promptText)
  if (!rawPrompt) {
    return {
      prompt: '',
      loraTagsUsed: [],
    }
  }

  if (!isCampusGreenMascotMode(styleMode)) {
    return {
      prompt: rawPrompt,
      loraTagsUsed: extractLoraTags(rawPrompt),
    }
  }

  const withoutExpressive = rawPrompt
    .replace(/<\s*wlr\s*:\s*expressive_h[^>]*>\s*,?/gi, '')
    .replace(/,\s*<\s*wlr\s*:\s*expressive_h[^>]*>/gi, '')

  const normalized = normalizePromptCommaSpace(withoutExpressive)
  return {
    prompt: normalized,
    loraTagsUsed: extractLoraTags(normalized),
  }
}

const resolveAspectRatio = (width, height) => {
  if (!(width > 0) || !(height > 0)) {
    return '3:4'
  }

  const ratio = width / height
  const delta34 = Math.abs(ratio - 3 / 4)
  const delta23 = Math.abs(ratio - 2 / 3)
  return delta23 < delta34 ? '2:3' : '3:4'
}

const resolveOutputSpecForStyleMode = (payload, styleMode) => {
  const source = isRecord(payload?.outputSpec) ? payload.outputSpec : {}
  let width = Number(payload?.width)
  let height = Number(payload?.height)

  if (!Number.isFinite(width) || width <= 0) {
    width = 768
  }
  if (!Number.isFinite(height) || height <= 0) {
    height = 1024
  }

  if (isCampusGreenMascotMode(styleMode) && width >= height) {
    width = 768
    height = 1024
  }

  const ratioCandidate = safeText(source.aspectRatio ?? source.aspect_ratio)
  const aspectRatio = ratioCandidate === '2:3' || ratioCandidate === '3:4' ? ratioCandidate : resolveAspectRatio(width, height)

  const outputSpec = {
    aspectRatio,
    width: Math.max(256, Math.round(width)),
    height: Math.max(256, Math.round(height)),
    fullBodyRequired: source.fullBodyRequired === undefined ? true : Boolean(source.fullBodyRequired),
    singleCharacter: source.singleCharacter === undefined ? true : Boolean(source.singleCharacter),
    cleanBackgroundPreferred: source.cleanBackgroundPreferred === undefined ? true : Boolean(source.cleanBackgroundPreferred),
    hostPlantAnchorAllowed: source.hostPlantAnchorAllowed === undefined ? true : Boolean(source.hostPlantAnchorAllowed),
  }

  if (isCampusGreenMascotMode(styleMode)) {
    return {
      ...outputSpec,
      fullBodyRequired: true,
      singleCharacter: true,
      cleanBackgroundPreferred: true,
      hostPlantAnchorAllowed: true,
    }
  }

  return outputSpec
}

const toOutputSpecLog = (outputSpec) => ({
  aspect_ratio: safeText(outputSpec?.aspectRatio) || '3:4',
  width: Number.isFinite(Number(outputSpec?.width)) ? Number(outputSpec.width) : 768,
  height: Number.isFinite(Number(outputSpec?.height)) ? Number(outputSpec.height) : 1024,
  full_body_required: Boolean(outputSpec?.fullBodyRequired),
  single_character: Boolean(outputSpec?.singleCharacter),
  clean_background_preferred: Boolean(outputSpec?.cleanBackgroundPreferred),
  host_plant_anchor_allowed: Boolean(outputSpec?.hostPlantAnchorAllowed),
})

const normalizeDiagnosisCategory = (value) => {
  const text = safeText(value)
  const lower = text.toLowerCase()
  if (text.includes('病') || lower.includes('disease')) {
    return '病害'
  }
  if (text.includes('虫') || lower.includes('insect') || lower.includes('pest')) {
    return '虫害'
  }
  return ''
}

const buildDiagnosisPromptInputFromPayload = (payload) => {
  const source = isRecord(payload?.diagnosisResult) ? payload.diagnosisResult : {}
  const sourceDiagnosis = isRecord(source.diagnosis) ? source.diagnosis : source
  const sourceRolePack = isRecord(source.rolePack) ? source.rolePack : {}
  const payloadRolePack = isRecord(payload?.rolePack) ? payload.rolePack : {}
  const fallbackKeywords = Array.isArray(payload?.keywords) ? payload.keywords.map((item) => safeText(item)).filter(Boolean) : []

  const normalizedDiagnosis = {
    name: safeText(sourceDiagnosis.name) || safeText(payload?.name),
    category:
      normalizeDiagnosisCategory(sourceDiagnosis.category ?? sourceDiagnosis.typeLabel) ||
      normalizeDiagnosisCategory(payload?.identifyTypeLabel),
    symptom_tags:
      (Array.isArray(sourceDiagnosis.symptom_tags) ? sourceDiagnosis.symptom_tags : Array.isArray(sourceDiagnosis.symptomTags) ? sourceDiagnosis.symptomTags : [])
        .map((item) => safeText(item))
        .filter(Boolean)
        .slice(0, 12),
    evidence_tags:
      (Array.isArray(sourceDiagnosis.evidence_tags) ? sourceDiagnosis.evidence_tags : Array.isArray(sourceDiagnosis.evidenceTags) ? sourceDiagnosis.evidenceTags : [])
        .map((item) => safeText(item))
        .filter(Boolean)
        .slice(0, 12),
    host_plant: safeText(sourceDiagnosis.host_plant ?? sourceDiagnosis.hostPlant ?? payload?.hostPlant),
    risk_level: safeText(sourceDiagnosis.risk_level ?? sourceDiagnosis.riskLevel ?? payload?.identifyRiskLevel),
    confidence: Number.isFinite(Number(sourceDiagnosis.confidence))
      ? Number(sourceDiagnosis.confidence)
      : Number.isFinite(Number(payload?.confidence))
        ? Number(payload.confidence)
        : 0.5,
  }

  if (normalizedDiagnosis.symptom_tags.length === 0) {
    normalizedDiagnosis.symptom_tags = fallbackKeywords.slice(0, 8)
  }
  if (normalizedDiagnosis.evidence_tags.length === 0) {
    normalizedDiagnosis.evidence_tags = fallbackKeywords.slice(0, 8)
  }

  return {
    diagnosis: normalizedDiagnosis,
    rolePack: {
      ...sourceRolePack,
      ...payloadRolePack,
    },
    styleMode: safeText(payload?.styleMode || source.styleMode || payload?.presetId),
  }
}

const buildGenerationPromptContext = async (payload, personaPipeline) => {
  const diagnosisInput = buildDiagnosisPromptInputFromPayload(payload)

  let built
  if (personaPipeline && typeof personaPipeline.buildFromDiagnosis === 'function') {
    try {
      built = await personaPipeline.buildFromDiagnosis({
        diagnosisResult: diagnosisInput,
        rolePack: payload?.rolePack,
        styleMode: payload?.styleMode,
      })
    } catch {
      built = buildAnimePersonaPromptFromDiagnosis(diagnosisInput, payload?.rolePack, payload?.styleMode)
    }
  } else {
    built = buildAnimePersonaPromptFromDiagnosis(diagnosisInput, payload?.rolePack, payload?.styleMode)
  }

  const resolvedStyleMode = safeText(built?.styleMode || payload?.styleMode || diagnosisInput.styleMode || payload?.presetId)
  const rawPositivePrompt = safeText(built.positivePrompt) || safeText(payload?.prompt) || defaultPositivePrompt(payload)
  const promptSanitization = sanitizePromptForStyleMode(rawPositivePrompt, resolvedStyleMode)
  const positivePrompt = promptSanitization.prompt || rawPositivePrompt
  const negativePrompt = safeText(built.negativePrompt) || safeText(payload?.negativePrompt) || defaultNegativePrompt
  const personaDesignJson = isRecord(built?.personaDesignJson) ? built.personaDesignJson : {}
  const softenedInsectFeatures = Array.isArray(built?.softenedInsectFeatures)
    ? built.softenedInsectFeatures.map((item) => safeText(item)).filter(Boolean).slice(0, 24)
    : []
  const hostPlantAnchor = safeText(built?.hostPlantAnchor)
  const ratioConstraints = Array.isArray(built?.ratioConstraints)
    ? built.ratioConstraints.map((item) => safeText(item)).filter(Boolean).slice(0, 16)
    : isCampusGreenMascotMode(resolvedStyleMode)
      ? [...campusGreenMascotRatioConstraints]
      : []
  const outputSpec = resolveOutputSpecForStyleMode(
    {
      ...payload,
      outputSpec: payload?.outputSpec,
    },
    resolvedStyleMode,
  )
  const promptStages = isRecord(built?.stages)
    ? {
        visualMapping: safeText(built.stages.visualMapping) || 'fallback',
        promptGeneration: safeText(built.stages.promptGeneration) || 'fallback',
      }
    : {
        visualMapping: 'fallback',
        promptGeneration: 'fallback',
      }

  return {
    payload: {
      ...payload,
      diagnosisResult: built.diagnosisResult,
      rolePack: built.rolePack,
      styleMode: resolvedStyleMode,
      personaDesignJson,
      prompt: positivePrompt,
      negativePrompt,
      width: outputSpec.width,
      height: outputSpec.height,
      outputSpec,
    },
    diagnosisResult: built.diagnosisResult,
    extractedPersonaTags: Array.isArray(built.extractedPersonaTags) ? built.extractedPersonaTags : [],
    personaDesignJson,
    promptStages,
    styleMode: resolvedStyleMode,
    softenedInsectFeatures,
    hostPlantAnchor,
    ratioConstraints,
    loraTagsUsed: promptSanitization.loraTagsUsed,
    outputSpec,
    outputSpecLog: toOutputSpecLog(outputSpec),
    finalPositivePrompt: positivePrompt,
    finalNegativePrompt: negativePrompt,
  }
}

const extractSeedFromGraph = (graph, fallbackSeed) => {
  const graphRecord = isRecord(graph) ? graph : {}

  for (const node of Object.values(graphRecord)) {
    if (!isRecord(node) || safeText(node.class_type) !== 'KSampler' || !isRecord(node.inputs)) {
      continue
    }
    const seed = Number(node.inputs.seed)
    if (Number.isFinite(seed)) {
      return Math.max(0, Math.floor(seed))
    }
  }

  const fallback = Number(fallbackSeed)
  if (Number.isFinite(fallback)) {
    return Math.max(0, Math.floor(fallback))
  }
  return null
}

const pickMessage = async (response) => {
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = await response.json()
      if (isRecord(data)) {
        const raw = data.error ?? data.message ?? JSON.stringify(data)
        return safeText(raw)
      }
    }

    return safeText(await response.text())
  } catch {
    return ''
  }
}

const buildViewQuery = (image) => {
  const query = new URLSearchParams({
    filename: safeText(image.filename),
    type: safeText(image.type || 'output'),
  })

  const subfolder = safeText(image.subfolder)
  if (subfolder) {
    query.set('subfolder', subfolder)
  }

  return query.toString()
}

const buildViewUrl = (baseUrl, image) => `${baseUrl}/view?${buildViewQuery(image)}`
const buildProxyViewUrl = (proxyPath, image) => `${normalizeProxyPath(proxyPath)}?${buildViewQuery(image)}`

const pickImageFromPromptHistory = (history, promptId) => {
  if (!isRecord(history)) {
    return null
  }

  const promptRecord = history[promptId]
  if (!isRecord(promptRecord)) {
    return null
  }

  const outputs = promptRecord.outputs
  if (!isRecord(outputs)) {
    return null
  }

  for (const nodeOutput of Object.values(outputs)) {
    if (!isRecord(nodeOutput)) {
      continue
    }

    const images = Array.isArray(nodeOutput.images) ? nodeOutput.images : []
    const found = images.find((image) => isRecord(image) && safeText(image.filename))
    if (found) {
      return found
    }
  }

  return null
}

const buildFallbackPromptGraph = (payload, checkpoint) => {
  const positivePrompt = payload.prompt || defaultPositivePrompt(payload)
  const negativePrompt = payload.negativePrompt || defaultNegativePrompt
  const samplerName = payload.samplerName || 'euler'
  const scheduler = payload.scheduler || 'normal'
  const filenamePrefix = payload.filenamePrefix || 'summer-wood/spirit'
  const seed =
    payload.seed !== null && Number.isFinite(payload.seed)
      ? Math.max(0, Math.floor(payload.seed))
      : Math.floor(Math.random() * 2_147_483_647)

  return {
    mode: 'fallback-template',
    graph: {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: checkpoint,
        },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: positivePrompt,
          clip: ['1', 1],
        },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: negativePrompt,
          clip: ['1', 1],
        },
      },
      '4': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: payload.width,
          height: payload.height,
          batch_size: 1,
        },
      },
      '5': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: payload.steps,
          cfg: payload.cfgScale,
          sampler_name: samplerName,
          scheduler,
          denoise: payload.denoise,
          model: ['1', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['4', 0],
        },
      },
      '6': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['5', 0],
          vae: ['1', 2],
        },
      },
      '7': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: filenamePrefix,
          images: ['6', 0],
        },
      },
    },
    positivePrompt,
    negativePrompt,
    samplerName,
    scheduler,
    seed,
    filenamePrefix,
  }
}

const resolveCheckpoints = async ({ baseUrl, fetchImpl }) => {
  const response = await fetchImpl(`${baseUrl}/models/checkpoints`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const message = await pickMessage(response)
    throw new ApiError(502, `comfyui checkpoints request failed: ${response.status}`, message)
  }

  const models = await response.json()
  return Array.isArray(models) ? models.map((item) => safeText(item)).filter(Boolean) : []
}

const resolveCheckpoint = async ({ baseUrl, fetchImpl, checkpoint }) => {
  if (checkpoint) {
    return checkpoint
  }

  const models = await resolveCheckpoints({ baseUrl, fetchImpl })
  if (!Array.isArray(models) || models.length === 0) {
    throw new ApiError(503, 'comfyui checkpoint not found, set COMFYUI_CHECKPOINT or install one model')
  }

  return safeText(models[0])
}

const parseUiLinks = (rawLinks) => {
  if (!Array.isArray(rawLinks)) {
    return new Map()
  }

  const result = new Map()
  rawLinks.forEach((item) => {
    if (Array.isArray(item) && item.length >= 5) {
      const id = Number(item[0])
      if (!Number.isFinite(id)) {
        return
      }

      result.set(id, {
        id,
        originNodeId: String(item[1]),
        originSlot: safeNumber(item[2], 0),
        targetNodeId: String(item[3]),
        targetSlot: safeNumber(item[4], 0),
      })
      return
    }

    if (isRecord(item)) {
      const id = safeNumber(item.id, NaN)
      if (!Number.isFinite(id)) {
        return
      }

      result.set(id, {
        id,
        originNodeId: String(item.origin_id ?? item.from_node ?? item.originNodeId ?? ''),
        originSlot: safeNumber(item.origin_slot ?? item.from_slot ?? item.originSlot, 0),
        targetNodeId: String(item.target_id ?? item.to_node ?? item.targetNodeId ?? ''),
        targetSlot: safeNumber(item.target_slot ?? item.to_slot ?? item.targetSlot, 0),
      })
    }
  })

  return result
}

const buildConnectedTextNodeSets = (graph) => {
  const positiveNodeIds = new Set()
  const negativeNodeIds = new Set()

  Object.values(graph).forEach((node) => {
    if (!isRecord(node) || node.class_type !== 'KSampler' || !isRecord(node.inputs)) {
      return
    }

    const positiveRef = node.inputs.positive
    const negativeRef = node.inputs.negative

    if (Array.isArray(positiveRef) && positiveRef.length >= 1) {
      positiveNodeIds.add(String(positiveRef[0]))
    }

    if (Array.isArray(negativeRef) && negativeRef.length >= 1) {
      negativeNodeIds.add(String(negativeRef[0]))
    }
  })

  return { positiveNodeIds, negativeNodeIds }
}

const patchPromptGraphTemplate = (graph, payload) => {
  const patchedGraph = deepClone(graph)
  const positivePrompt = payload.prompt || defaultPositivePrompt(payload)
  const negativePrompt = payload.negativePrompt || defaultNegativePrompt
  let node27Patched = false
  let node7Patched = false

  const node27 = patchedGraph['27']
  if (isRecord(node27) && safeText(node27.class_type) === 'WeiLinPromptUI') {
    const inputs = isRecord(node27.inputs) ? node27.inputs : {}
    node27.inputs = inputs
    inputs.opt_text = positivePrompt
    Object.keys(inputs).forEach((key) => {
      const lower = key.toLowerCase()
      if ((lower.includes('text') || lower.includes('prompt')) && typeof inputs[key] === 'string') {
        inputs[key] = positivePrompt
      }
    })
    node27Patched = true
  }

  const node7 = patchedGraph['7']
  if (isRecord(node7) && safeText(node7.class_type) === 'CLIPTextEncode') {
    const inputs = isRecord(node7.inputs) ? node7.inputs : {}
    node7.inputs = inputs
    inputs.text = negativePrompt
    node7Patched = true
  }

  return {
    graph: patchedGraph,
    node27Patched,
    node7Patched,
  }
}

const patchUiWorkflowTemplate = (workflow, payload) => {
  const patchedWorkflow = deepClone(workflow)
  const nodes = Array.isArray(patchedWorkflow.nodes) ? patchedWorkflow.nodes : []
  const positivePrompt = payload.prompt || defaultPositivePrompt(payload)
  const negativePrompt = payload.negativePrompt || defaultNegativePrompt
  let node27Patched = false
  let node7Patched = false

  nodes.forEach((node) => {
    const nodeId = String(node?.id ?? '')
    const type = safeText(node?.type)

    if (nodeId === '27' && type === 'WeiLinPromptUI') {
      const widgets = Array.isArray(node.widgets_values) ? node.widgets_values : []
      widgets[0] = positivePrompt
      node.widgets_values = widgets
      node27Patched = true
    }

    if (nodeId === '7' && type === 'CLIPTextEncode') {
      const widgets = Array.isArray(node.widgets_values) ? node.widgets_values : []
      widgets[0] = negativePrompt
      node.widgets_values = widgets
      node7Patched = true
    }
  })

  return {
    workflow: patchedWorkflow,
    node27Patched,
    node7Patched,
  }
}

const applyGraphOverrides = (graph, payload, checkpoint) => {
  const { positiveNodeIds, negativeNodeIds } = buildConnectedTextNodeSets(graph)

  Object.entries(graph).forEach(([nodeId, node]) => {
    if (!isRecord(node)) {
      return
    }

    const classType = safeText(node.class_type)
    const inputs = isRecord(node.inputs) ? node.inputs : {}
    node.inputs = inputs

    if (classType === 'CheckpointLoaderSimple') {
      inputs.ckpt_name = checkpoint
      return
    }

    if (classType === 'EmptyLatentImage') {
      inputs.width = payload.width
      inputs.height = payload.height
      if (!Number.isFinite(Number(inputs.batch_size))) {
        inputs.batch_size = 1
      }
      return
    }

    if (classType === 'KSampler') {
      inputs.seed =
        payload.seed !== null && Number.isFinite(payload.seed)
          ? Math.max(0, Math.floor(payload.seed))
          : Math.floor(Math.random() * 2_147_483_647)
      inputs.steps = payload.steps
      inputs.cfg = payload.cfgScale
      inputs.sampler_name = payload.samplerName || safeText(inputs.sampler_name) || 'euler'
      inputs.scheduler = payload.scheduler || safeText(inputs.scheduler) || 'normal'
      inputs.denoise = payload.denoise
      return
    }

    if (classType === 'SaveImage') {
      inputs.filename_prefix = payload.filenamePrefix || safeText(inputs.filename_prefix) || 'summer-wood/spirit'
      return
    }

    if (classType === 'CLIPTextEncode') {
      if (negativeNodeIds.has(nodeId)) {
        inputs.text = payload.negativePrompt || defaultNegativePrompt
        return
      }

      if (positiveNodeIds.has(nodeId)) {
        inputs.text = payload.prompt || defaultPositivePrompt(payload)
        return
      }

      if (!safeText(inputs.text)) {
        inputs.text = payload.prompt || defaultPositivePrompt(payload)
      }
      return
    }

    if (classType === 'WeiLinPromptUI') {
      const promptText = payload.prompt || defaultPositivePrompt(payload)
      if (inputs.opt_text === undefined || typeof inputs.opt_text === 'string') {
        inputs.opt_text = promptText
      }

      Object.keys(inputs).forEach((key) => {
        const lower = key.toLowerCase()
        if ((lower.includes('text') || lower.includes('prompt')) && typeof inputs[key] === 'string') {
          inputs[key] = promptText
        }
      })
    }
  })
}

const mapWidgetsToInputs = (node, info, inputs) => {
  const widgets = Array.isArray(node.widgets_values) ? node.widgets_values : []
  if (widgets.length === 0) {
    return
  }

  if (safeText(node.type) === 'KSampler' && widgets.length >= 7 && typeof widgets[1] === 'string') {
    if (inputs.seed === undefined) {
      inputs.seed = widgets[0]
    }
    if (inputs.steps === undefined) {
      inputs.steps = widgets[2]
    }
    if (inputs.cfg === undefined) {
      inputs.cfg = widgets[3]
    }
    if (inputs.sampler_name === undefined) {
      inputs.sampler_name = widgets[4]
    }
    if (inputs.scheduler === undefined) {
      inputs.scheduler = widgets[5]
    }
    if (inputs.denoise === undefined) {
      inputs.denoise = widgets[6]
    }
    return
  }

  const requiredOrder = Array.isArray(info?.input_order?.required) ? info.input_order.required : []
  const optionalOrder = Array.isArray(info?.input_order?.optional) ? info.input_order.optional : []
  const orderedNames = [...requiredOrder, ...optionalOrder].filter((name, index, array) => safeText(name) && array.indexOf(name) === index)
  const unboundNames = orderedNames.filter((name) => inputs[name] === undefined)

  for (let index = 0; index < widgets.length && index < unboundNames.length; index += 1) {
    inputs[unboundNames[index]] = widgets[index]
  }
}

const convertUiWorkflowToPromptGraph = ({ workflow, objectInfo, payload, checkpoint }) => {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : []
  const links = parseUiLinks(workflow.links)
  const nodeTypes = Array.from(new Set(nodes.map((node) => safeText(node?.type)).filter(Boolean)))

  if (nodes.length === 0) {
    return {
      ok: false,
      reason: 'workflow.nodes is empty',
      nodeTypes: [],
      unsupportedNodes: [],
    }
  }

  const unsupported = nodeTypes.filter((type) => !objectInfo[type])
  const unsupportedSet = new Set(unsupported)
  const unsupportedWithoutWeiLin = unsupported.filter((type) => type !== 'WeiLinPromptUI')

  if (unsupportedWithoutWeiLin.length > 0) {
    return {
      ok: false,
      reason: `workflow contains unsupported nodes: ${unsupported.join(', ')}`,
      nodeTypes,
      unsupportedNodes: unsupported,
    }
  }

  const nodeIdToType = new Map(nodes.map((node) => [String(node.id), safeText(node.type)]))
  const checkpointNode = nodes.find((node) => safeText(node.type) === 'CheckpointLoaderSimple')
  const checkpointNodeId = checkpointNode ? String(checkpointNode.id) : ''

  const weiLinNodes = nodes.filter((node) => safeText(node.type) === 'WeiLinPromptUI')
  const weiLinFallbackEnabled = unsupportedSet.has('WeiLinPromptUI') && weiLinNodes.length > 0
  const weiLinNodeId = weiLinFallbackEnabled ? String(weiLinNodes[0].id) : ''

  const findSourceFromWeiLinInput = (inputName, defaultSlot) => {
    if (!weiLinFallbackEnabled || !weiLinNodes[0] || !Array.isArray(weiLinNodes[0].inputs)) {
      return checkpointNodeId ? [checkpointNodeId, defaultSlot] : null
    }

    const input = weiLinNodes[0].inputs.find((item) => safeText(item?.name) === inputName)
    if (!input) {
      return checkpointNodeId ? [checkpointNodeId, defaultSlot] : null
    }

    const linkId = safeNumber(input.link, NaN)
    if (!Number.isFinite(linkId)) {
      return checkpointNodeId ? [checkpointNodeId, defaultSlot] : null
    }

    const link = links.get(linkId)
    if (!link || !safeText(link.originNodeId)) {
      return checkpointNodeId ? [checkpointNodeId, defaultSlot] : null
    }

    return [link.originNodeId, safeNumber(link.originSlot, defaultSlot)]
  }

  const weiLinClipRef = findSourceFromWeiLinInput('opt_clip', 1)
  const weiLinModelRef = findSourceFromWeiLinInput('opt_model', 0)
  const virtualPositiveEncodeNodeId = '900001'

  const graph = {}
  let usedWeiLinFallback = false

  nodes.forEach((node) => {
    const nodeId = String(node.id)
    const classType = safeText(node.type)

    if (weiLinFallbackEnabled && classType === 'WeiLinPromptUI') {
      usedWeiLinFallback = true
      return
    }

    const info = objectInfo[classType]

    const inputs = {}
    const rawInputs = Array.isArray(node.inputs) ? node.inputs : []

    rawInputs.forEach((input) => {
      const inputName = safeText(input?.name)
      const linkId = safeNumber(input?.link, NaN)
      if (!inputName || !Number.isFinite(linkId)) {
        return
      }

      const link = links.get(linkId)
      if (!link || !safeText(link.originNodeId)) {
        return
      }

      const originType = nodeIdToType.get(String(link.originNodeId)) || ''
      if (weiLinFallbackEnabled && originType === 'WeiLinPromptUI' && String(link.originNodeId) === weiLinNodeId) {
        usedWeiLinFallback = true

        if (inputName === 'model' && weiLinModelRef) {
          inputs[inputName] = weiLinModelRef
          return
        }

        if (inputName === 'clip' && weiLinClipRef) {
          inputs[inputName] = weiLinClipRef
          return
        }

        if (inputName === 'positive') {
          inputs[inputName] = [virtualPositiveEncodeNodeId, 0]
          return
        }

        return
      }

      inputs[inputName] = [link.originNodeId, link.originSlot]
    })

    mapWidgetsToInputs(node, info, inputs)

    graph[nodeId] = {
      class_type: classType,
      inputs,
    }
  })

  if (usedWeiLinFallback && weiLinClipRef) {
    graph[virtualPositiveEncodeNodeId] = {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: payload.prompt || defaultPositivePrompt(payload),
        clip: weiLinClipRef,
      },
    }
  }

  applyGraphOverrides(graph, payload, checkpoint)

  return {
    ok: true,
    graph,
    mode: usedWeiLinFallback ? 'workflow-weilin-fallback' : 'workflow',
    reason: usedWeiLinFallback ? 'WeiLinPromptUI replaced by CLIPTextEncode fallback' : '',
    nodeTypes,
    unsupportedNodes: unsupported,
  }
}

const summarizePromptGraph = (graph) => {
  const graphRecord = isRecord(graph) ? graph : {}
  const nodeValues = Object.values(graphRecord).filter((node) => isRecord(node))
  const classTypes = Array.from(
    new Set(
      nodeValues
        .map((node) => safeText(node.class_type))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right))

  const { positiveNodeIds, negativeNodeIds } = buildConnectedTextNodeSets(graphRecord)

  return {
    nodeCount: nodeValues.length,
    classTypes,
    fieldCoverage: {
      checkpoint: classTypes.includes('CheckpointLoaderSimple'),
      latentSize: classTypes.includes('EmptyLatentImage'),
      sampler: classTypes.includes('KSampler'),
      saveImage: classTypes.includes('SaveImage'),
      positivePrompt: positiveNodeIds.size > 0 || classTypes.includes('WeiLinPromptUI'),
      negativePrompt: negativeNodeIds.size > 0 || classTypes.includes('WeiLinPromptUI'),
    },
  }
}

const loadWorkflowJson = (workflowPath) => {
  const normalizedPath = safeText(workflowPath)
  if (!normalizedPath) {
    return {
      ok: false,
      reason: 'workflow path is empty',
    }
  }

  const absolutePath = resolve(normalizedPath)
  if (!existsSync(absolutePath)) {
    return {
      ok: false,
      reason: `workflow file not found: ${absolutePath}`,
      workflowPath: absolutePath,
    }
  }

  try {
    const data = JSON.parse(readFileSync(absolutePath, 'utf8'))
    return {
      ok: true,
      workflowPath: absolutePath,
      data,
    }
  } catch (error) {
    return {
      ok: false,
      reason: `workflow parse failed: ${error instanceof Error ? error.message : 'invalid json'}`,
      workflowPath: absolutePath,
    }
  }
}

const fetchObjectInfo = async ({ baseUrl, fetchImpl }) => {
  const response = await fetchImpl(`${baseUrl}/object_info`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const message = await pickMessage(response)
    throw new ApiError(502, `comfyui object_info request failed: ${response.status}`, message)
  }

  const payload = await response.json()
  return isRecord(payload) ? payload : {}
}

const buildWorkflowCandidate = async ({
  workflowPath,
  payload,
  checkpoint,
  baseUrl,
  fetchImpl,
  objectInfoCache,
}) => {
  const loaded = loadWorkflowJson(workflowPath)
  if (!loaded.ok) {
    return {
      ok: false,
      reason: loaded.reason,
      workflowPath: loaded.workflowPath,
    }
  }

  const workflowData = loaded.data

  if (isRecord(workflowData.prompt)) {
    const graphPatch = patchPromptGraphTemplate(workflowData.prompt, payload)
    const graph = graphPatch.graph
    applyGraphOverrides(graph, payload, checkpoint)
    const summary = summarizePromptGraph(graph)

    return {
      ok: true,
      mode: 'workflow',
      workflowPath: loaded.workflowPath,
      graph,
      sourceFormat: 'prompt',
      nodeCount: summary.nodeCount,
      classTypes: summary.classTypes,
      fieldCoverage: summary.fieldCoverage,
      unsupportedNodes: [],
      workflowPatch: {
        node27Patched: graphPatch.node27Patched,
        node7Patched: graphPatch.node7Patched,
      },
    }
  }

  if (Array.isArray(workflowData.nodes)) {
    const uiPatch = patchUiWorkflowTemplate(workflowData, payload)
    if (!objectInfoCache.value) {
      objectInfoCache.value = await fetchObjectInfo({ baseUrl, fetchImpl })
    }

    const converted = convertUiWorkflowToPromptGraph({
      workflow: uiPatch.workflow,
      objectInfo: objectInfoCache.value,
      payload,
      checkpoint,
    })

    if (!converted.ok) {
      return {
        ok: false,
        reason: converted.reason,
        workflowPath: loaded.workflowPath,
        sourceFormat: 'ui',
        nodeTypes: converted.nodeTypes ?? [],
        unsupportedNodes: converted.unsupportedNodes ?? [],
      }
    }
    const summary = summarizePromptGraph(converted.graph)

    return {
      ok: true,
      mode: converted.mode || 'workflow',
      workflowPath: loaded.workflowPath,
      graph: converted.graph,
      reason: converted.reason || '',
      sourceFormat: 'ui',
      nodeCount: summary.nodeCount,
      classTypes: summary.classTypes,
      fieldCoverage: summary.fieldCoverage,
      unsupportedNodes: converted.unsupportedNodes ?? [],
      nodeTypes: converted.nodeTypes ?? [],
      workflowPatch: {
        node27Patched: uiPatch.node27Patched,
        node7Patched: uiPatch.node7Patched,
      },
    }
  }

  return {
    ok: false,
    reason: 'workflow must contain prompt or nodes',
    workflowPath: loaded.workflowPath,
    sourceFormat: '',
    nodeTypes: [],
    unsupportedNodes: [],
  }
}

const submitPromptAndWaitImage = async ({ baseUrl, fetchImpl, clientId, graph, timeoutMs, pollIntervalMs }) => {
  const promptPayloadHash = createHash('sha256')
    .update(JSON.stringify(graph))
    .digest('hex')
    .slice(0, 24)

  const submitResponse = await fetchImpl(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      prompt: graph,
    }),
  })

  if (!submitResponse.ok) {
    const message = await pickMessage(submitResponse)
    throw new ApiError(502, `comfyui prompt submit failed: ${submitResponse.status}`, message)
  }

  const submitPayload = await submitResponse.json()
  const promptId = safeText(submitPayload?.prompt_id)
  if (!promptId) {
    throw new ApiError(502, 'comfyui prompt_id missing')
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const historyResponse = await fetchImpl(`${baseUrl}/history/${encodeURIComponent(promptId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!historyResponse.ok) {
      const message = await pickMessage(historyResponse)
      throw new ApiError(502, `comfyui history request failed: ${historyResponse.status}`, message)
    }

    const history = await historyResponse.json()
    const image = pickImageFromPromptHistory(history, promptId)

    if (image) {
      return {
        promptId,
        image,
        promptPayloadHash,
      }
    }

    await sleep(pollIntervalMs)
  }

  throw new ApiError(504, 'comfyui generation timed out')
}

export function createComfyuiService({
  baseUrl = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188',
  publicBaseUrl = process.env.COMFYUI_PUBLIC_BASE_URL || '',
  clientId = process.env.COMFYUI_CLIENT_ID || 'summer-wood-api',
  checkpoint = process.env.COMFYUI_CHECKPOINT || '',
  workflowPath = process.env.COMFYUI_WORKFLOW_PATH || defaultWorkflowPath,
  imageDeliveryMode = process.env.COMFYUI_IMAGE_DELIVERY_MODE || 'proxy',
  imageProxyPath = process.env.COMFYUI_IMAGE_PROXY_PATH || '/api/spirit/comfyui/view',
  fetchImpl = fetch,
  timeoutMs = Number(process.env.COMFYUI_TIMEOUT_MS ?? 120_000),
  pollIntervalMs = Number(process.env.COMFYUI_POLL_INTERVAL_MS ?? 1_000),
  personaPipeline: injectedPersonaPipeline,
} = {}) {
  const endpoint = normalizeBaseUrl(baseUrl)
  const publicEndpoint = normalizeBaseUrl(publicBaseUrl)
  const normalizedClientId = safeText(clientId) || 'summer-wood-api'
  const defaultCheckpoint = safeText(checkpoint)
  const normalizedWorkflowPath = safeText(workflowPath)
  const normalizedImageProxyPath = normalizeProxyPath(imageProxyPath)
  const safeImageDeliveryMode = safeText(imageDeliveryMode).toLowerCase() === 'direct' ? 'direct' : 'proxy'
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 3_000 ? timeoutMs : 120_000
  const safePollIntervalMs = Number.isFinite(pollIntervalMs) && pollIntervalMs >= 300 ? pollIntervalMs : 1_000

  if (!endpoint) {
    throw new ApiError(500, 'COMFYUI_BASE_URL is required')
  }

  const objectInfoCache = { value: null }
  const personaPipeline =
    injectedPersonaPipeline && typeof injectedPersonaPipeline === 'object'
      ? injectedPersonaPipeline
      : createSpiritPersonaPipeline()

  return {
    async getRuntimeStatus() {
      const status = {
        ready: false,
        comfyuiOnline: false,
        baseUrl: endpoint,
        workflowPath: normalizedWorkflowPath,
        workflowLoaded: false,
        workflowModeCandidate: 'fallback-template',
        workflowReason: '',
        checkpointCount: 0,
        checkpointNames: [],
        checkpointSelected: safeText(defaultCheckpoint),
        weilinAvailable: false,
        imageDeliveryMode: safeImageDeliveryMode,
        imageProxyPath: normalizedImageProxyPath,
        imageDirectBaseUrl: publicEndpoint || endpoint,
        generatedAt: new Date().toISOString(),
      }

      try {
        const systemResponse = await fetchImpl(`${endpoint}/system_stats`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })

        if (!systemResponse.ok) {
          status.workflowReason = `comfyui system_stats failed: ${systemResponse.status}`
          return status
        }

        status.comfyuiOnline = true

        const checkpoints = await resolveCheckpoints({ baseUrl: endpoint, fetchImpl })
        status.checkpointNames = checkpoints.slice(0, 20)
        status.checkpointCount = checkpoints.length
        status.checkpointSelected = safeText(defaultCheckpoint) || checkpoints[0] || ''

        const weilinResponse = await fetchImpl(`${endpoint}/object_info/WeiLinPromptUI`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        })

        if (weilinResponse.ok) {
          const weilinPayload = await weilinResponse.json()
          status.weilinAvailable = isRecord(weilinPayload) && isRecord(weilinPayload.WeiLinPromptUI)
        }

        if (normalizedWorkflowPath) {
          const workflowCandidate = await buildWorkflowCandidate({
            workflowPath: normalizedWorkflowPath,
            payload: defaultDiagnosticPayload,
            checkpoint: status.checkpointSelected || 'unknown.safetensors',
            baseUrl: endpoint,
            fetchImpl,
            objectInfoCache,
          })

          status.workflowLoaded = workflowCandidate.ok
          status.workflowModeCandidate = workflowCandidate.ok ? safeText(workflowCandidate.mode) || 'workflow' : 'fallback-template'
          status.workflowReason = safeText(workflowCandidate.reason)
        } else {
          status.workflowReason = 'workflow path is empty'
        }

        status.ready = status.comfyuiOnline && status.checkpointCount > 0
        status.generatedAt = new Date().toISOString()
        return status
      } catch (error) {
        status.workflowReason = error instanceof Error ? error.message : 'runtime check failed'
        status.generatedAt = new Date().toISOString()
        return status
      }
    },

    async generateSpiritPortrait(payload) {
      const payloadRecord = isRecord(payload) ? payload : {}
      const promptContext = await buildGenerationPromptContext(payloadRecord, personaPipeline)
      const resolvedPayload = promptContext.payload

      const selectedCheckpoint = await resolveCheckpoint({
        baseUrl: endpoint,
        fetchImpl,
        checkpoint: resolvedPayload.checkpoint || defaultCheckpoint,
      })

      const fallbackPrompt = buildFallbackPromptGraph(resolvedPayload, selectedCheckpoint)
      const requestWorkflowPath = safeText(resolvedPayload.workflowPath) || normalizedWorkflowPath
      const workflowCandidate = requestWorkflowPath
        ? await buildWorkflowCandidate({
            workflowPath: requestWorkflowPath,
            payload: resolvedPayload,
            checkpoint: selectedCheckpoint,
            baseUrl: endpoint,
            fetchImpl,
            objectInfoCache,
          })
        : {
            ok: false,
            reason: 'workflow path is empty',
          }

      const candidates = []
      if (workflowCandidate.ok) {
        candidates.push({
          mode: workflowCandidate.mode || 'workflow',
          graph: workflowCandidate.graph,
          workflowPath: workflowCandidate.workflowPath,
          fallbackReason: safeText(workflowCandidate.reason),
          workflowPatch: workflowCandidate.workflowPatch ?? {},
        })
      }

      candidates.push({
        mode: fallbackPrompt.mode,
        graph: fallbackPrompt.graph,
        workflowPath: workflowCandidate.workflowPath,
        fallbackReason: workflowCandidate.ok ? '' : safeText(workflowCandidate.reason),
        workflowPatch: {
          node27Patched: false,
          node7Patched: false,
        },
      })

      let lastError = null

      for (const candidate of candidates) {
        try {
          const output = await submitPromptAndWaitImage({
            baseUrl: endpoint,
            fetchImpl,
            clientId: normalizedClientId,
            graph: candidate.graph,
            timeoutMs: safeTimeoutMs,
            pollIntervalMs: safePollIntervalMs,
          })

          const imageUrl =
            safeImageDeliveryMode === 'direct'
              ? buildViewUrl(publicEndpoint || endpoint, output.image)
              : buildProxyViewUrl(normalizedImageProxyPath, output.image)
          const imageUrlDirect = buildViewUrl(publicEndpoint || endpoint, output.image)
          const imageUrlProxy = buildProxyViewUrl(normalizedImageProxyPath, output.image)
          const resolvedSeed = extractSeedFromGraph(candidate.graph, resolvedPayload.seed)

          const result = {
            promptId: output.promptId,
            imageUrl,
            imageUrlDirect,
            imageUrlProxy,
            checkpoint: selectedCheckpoint,
            prompt: promptContext.finalPositivePrompt,
            negativePrompt: promptContext.finalNegativePrompt,
            styleMode: promptContext.styleMode,
            softenedInsectFeatures: [...promptContext.softenedInsectFeatures],
            hostPlantAnchor: promptContext.hostPlantAnchor,
            ratioConstraints: [...promptContext.ratioConstraints],
            loraTagsUsed: [...promptContext.loraTagsUsed],
            outputSpec: { ...promptContext.outputSpec },
            samplerName: resolvedPayload.samplerName || 'euler',
            scheduler: resolvedPayload.scheduler || 'normal',
            seed: resolvedSeed,
            filenamePrefix: resolvedPayload.filenamePrefix || 'summer-wood/spirit',
            workflowMode: candidate.mode,
            workflowPath: safeText(candidate.workflowPath),
            workflowFallbackReason: candidate.fallbackReason,
            presetId: safeText(resolvedPayload.presetId),
            workflowId: safeText(resolvedPayload.workflowId),
            routingRuleId: safeText(resolvedPayload.routingRuleId),
            routingRuleLabel: safeText(resolvedPayload.routingRuleLabel),
            routingMatchedKeywords: Array.isArray(resolvedPayload.routingMatchedKeywords)
              ? resolvedPayload.routingMatchedKeywords.map((item) => safeText(item)).filter(Boolean)
              : [],
            comfyPromptPayloadHash: safeText(output.promptPayloadHash),
            extractedPersonaTags: [...promptContext.extractedPersonaTags],
            personaDesignJson: promptContext.personaDesignJson,
            promptStages: promptContext.promptStages,
            diagnosisResult: promptContext.diagnosisResult,
          }

          // eslint-disable-next-line no-console
          console.info(
            '[comfyui] generation_trace',
            JSON.stringify({
              workflowName: safeText(resolvedPayload.workflowId) || safeText(candidate.workflowPath),
              workflowMode: candidate.mode,
              workflowPatch: candidate.workflowPatch,
              style_mode: promptContext.styleMode,
              diagnosisResult: promptContext.diagnosisResult,
              softened_insect_features: promptContext.softenedInsectFeatures,
              host_plant_anchor: promptContext.hostPlantAnchor,
              ratio_constraints: promptContext.ratioConstraints,
              extractedPersonaTags: promptContext.extractedPersonaTags,
              personaDesignJson: promptContext.personaDesignJson,
              promptStages: promptContext.promptStages,
              finalPositivePrompt: promptContext.finalPositivePrompt,
              finalNegativePrompt: promptContext.finalNegativePrompt,
              lora_tags_used: promptContext.loraTagsUsed,
              output_spec: promptContext.outputSpecLog,
              comfyPromptPayloadHash: safeText(output.promptPayloadHash),
              outputUrls: {
                imageUrl,
                imageUrlDirect,
                imageUrlProxy,
              },
              seed: resolvedSeed,
            }),
          )

          return result
        } catch (error) {
          lastError = error
          // eslint-disable-next-line no-console
          console.warn(
            '[comfyui] generation_attempt_failed',
            JSON.stringify({
              workflowName: safeText(resolvedPayload.workflowId) || safeText(candidate.workflowPath),
              workflowMode: candidate.mode,
              workflowPatch: candidate.workflowPatch,
              error: error instanceof Error ? error.message : String(error),
            }),
          )
        }
      }

      if (lastError instanceof Error) {
        throw lastError
      }

      throw new ApiError(500, 'comfyui generation failed unexpectedly')
    },

    async validateWorkflowProfile({ workflowPath, payload } = {}) {
      const requestWorkflowPath = safeText(workflowPath) || normalizedWorkflowPath
      if (!requestWorkflowPath) {
        return {
          ok: false,
          workflowPath: '',
          reason: 'workflow path is empty',
          sourceFormat: '',
          mode: 'fallback-template',
          nodeCount: 0,
          classTypes: [],
          fieldCoverage: {
            checkpoint: false,
            latentSize: false,
            sampler: false,
            saveImage: false,
            positivePrompt: false,
            negativePrompt: false,
          },
          unsupportedNodes: [],
        }
      }

      let selectedCheckpoint = safeText(defaultCheckpoint) || 'unknown.safetensors'
      try {
        selectedCheckpoint = await resolveCheckpoint({
          baseUrl: endpoint,
          fetchImpl,
          checkpoint: defaultCheckpoint,
        })
      } catch {
        // Keep fallback checkpoint label for dry-run validation.
      }

      const payloadRecord = payload && typeof payload === 'object' ? payload : {}
      const candidatePayload = {
        ...defaultDiagnosticPayload,
        ...payloadRecord,
      }

      try {
        const candidate = await buildWorkflowCandidate({
          workflowPath: requestWorkflowPath,
          payload: candidatePayload,
          checkpoint: selectedCheckpoint,
          baseUrl: endpoint,
          fetchImpl,
          objectInfoCache,
        })

        if (!candidate.ok) {
          return {
            ok: false,
            workflowPath: safeText(candidate.workflowPath),
            reason: safeText(candidate.reason),
            sourceFormat: safeText(candidate.sourceFormat),
            mode: 'fallback-template',
            nodeCount: Number.isFinite(Number(candidate.nodeCount)) ? Number(candidate.nodeCount) : 0,
            classTypes: Array.isArray(candidate.classTypes) ? candidate.classTypes.map((item) => safeText(item)).filter(Boolean) : [],
            fieldCoverage:
              candidate.fieldCoverage && typeof candidate.fieldCoverage === 'object'
                ? {
                    checkpoint: Boolean(candidate.fieldCoverage.checkpoint),
                    latentSize: Boolean(candidate.fieldCoverage.latentSize),
                    sampler: Boolean(candidate.fieldCoverage.sampler),
                    saveImage: Boolean(candidate.fieldCoverage.saveImage),
                    positivePrompt: Boolean(candidate.fieldCoverage.positivePrompt),
                    negativePrompt: Boolean(candidate.fieldCoverage.negativePrompt),
                  }
                : {
                    checkpoint: false,
                    latentSize: false,
                    sampler: false,
                    saveImage: false,
                    positivePrompt: false,
                    negativePrompt: false,
                  },
            unsupportedNodes: Array.isArray(candidate.unsupportedNodes)
              ? candidate.unsupportedNodes.map((item) => safeText(item)).filter(Boolean)
              : [],
            nodeTypes: Array.isArray(candidate.nodeTypes) ? candidate.nodeTypes.map((item) => safeText(item)).filter(Boolean) : [],
          }
        }

        return {
          ok: true,
          workflowPath: safeText(candidate.workflowPath),
          reason: safeText(candidate.reason),
          sourceFormat: safeText(candidate.sourceFormat),
          mode: safeText(candidate.mode) || 'workflow',
          nodeCount: Number.isFinite(Number(candidate.nodeCount)) ? Number(candidate.nodeCount) : 0,
          classTypes: Array.isArray(candidate.classTypes) ? candidate.classTypes.map((item) => safeText(item)).filter(Boolean) : [],
          fieldCoverage:
            candidate.fieldCoverage && typeof candidate.fieldCoverage === 'object'
              ? {
                  checkpoint: Boolean(candidate.fieldCoverage.checkpoint),
                  latentSize: Boolean(candidate.fieldCoverage.latentSize),
                  sampler: Boolean(candidate.fieldCoverage.sampler),
                  saveImage: Boolean(candidate.fieldCoverage.saveImage),
                  positivePrompt: Boolean(candidate.fieldCoverage.positivePrompt),
                  negativePrompt: Boolean(candidate.fieldCoverage.negativePrompt),
                }
              : {
                  checkpoint: false,
                  latentSize: false,
                  sampler: false,
                  saveImage: false,
                  positivePrompt: false,
                  negativePrompt: false,
                },
          unsupportedNodes: Array.isArray(candidate.unsupportedNodes)
            ? candidate.unsupportedNodes.map((item) => safeText(item)).filter(Boolean)
            : [],
          nodeTypes: Array.isArray(candidate.nodeTypes) ? candidate.nodeTypes.map((item) => safeText(item)).filter(Boolean) : [],
        }
      } catch (error) {
        return {
          ok: false,
          workflowPath: requestWorkflowPath,
          reason: error instanceof Error ? error.message : 'validate workflow failed',
          sourceFormat: '',
          mode: 'fallback-template',
          nodeCount: 0,
          classTypes: [],
          fieldCoverage: {
            checkpoint: false,
            latentSize: false,
            sampler: false,
            saveImage: false,
            positivePrompt: false,
            negativePrompt: false,
          },
          unsupportedNodes: [],
        }
      }
    },

    async fetchViewImage({ filename, type = 'output', subfolder = '' } = {}) {
      const resolvedFilename = safeText(filename)
      if (!resolvedFilename) {
        throw new ApiError(400, 'filename is required')
      }

      const query = new URLSearchParams({
        filename: resolvedFilename,
        type: safeText(type) || 'output',
      })
      const resolvedSubfolder = safeText(subfolder)
      if (resolvedSubfolder) {
        query.set('subfolder', resolvedSubfolder)
      }

      const response = await fetchImpl(`${endpoint}/view?${query.toString()}`, {
        method: 'GET',
      })

      if (!response.ok) {
        const message = await pickMessage(response)
        throw new ApiError(502, `comfyui view request failed: ${response.status}`, message)
      }

      const bytes = Buffer.from(await response.arrayBuffer())
      return {
        bytes,
        contentType: safeText(response.headers.get('content-type')) || 'application/octet-stream',
        cacheControl: safeText(response.headers.get('cache-control')),
        etag: safeText(response.headers.get('etag')),
        lastModified: safeText(response.headers.get('last-modified')),
      }
    },
  }
}

