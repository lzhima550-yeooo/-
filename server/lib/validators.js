import { ApiError } from './errors.js'

const text = (value) => String(value ?? '').trim()
const objectOrEmpty = (value) => (value && typeof value === 'object' ? value : {})

const listOfStrings = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => text(item))
    .filter(Boolean)
}

const listOfMessages = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const role = item.role === 'user' ? 'user' : 'spirit'
      const messageText = text(item.text)
      if (!messageText) {
        return null
      }

      return {
        id: text(item.id),
        role,
        text: messageText,
      }
    })
    .filter(Boolean)
}

const listOfPoints = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const x = Number(item.x)
      const y = Number(item.y)

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
      }

      return { x, y }
    })
    .filter(Boolean)
}

const numberInRange = (value, fallback, min, max) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  return Math.max(min, Math.min(max, num))
}

const integerInRange = (value, fallback, min, max) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return fallback
  }

  return Math.max(min, Math.min(max, Math.round(num)))
}

const normalizeDiagnosisCategory = (value) => {
  const raw = text(value)
  const lower = raw.toLowerCase()
  if (raw.includes('病') || lower.includes('disease')) {
    return '病害'
  }
  if (raw.includes('虫') || lower.includes('insect') || lower.includes('pest')) {
    return '虫害'
  }
  return ''
}

const normalizeDiagnosisRisk = (value) => {
  const raw = text(value)
  const lower = raw.toLowerCase()
  if (lower === 'critical' || lower === 'high' || lower === 'medium' || lower === 'low') {
    return lower
  }
  if (raw === '高') {
    return 'high'
  }
  if (raw === '中') {
    return 'medium'
  }
  if (raw === '低') {
    return 'low'
  }
  return ''
}

const normalizeGenerateRolePack = (value) => {
  const source = objectOrEmpty(value)
  return {
    id: text(source.id),
    name: text(source.name),
    style: text(source.style),
    persona: text(source.persona),
    guardrails: listOfStrings(source.guardrails).slice(0, 20),
    visualKeywords: listOfStrings(source.visualKeywords ?? source.visual_keywords).slice(0, 20),
    negativeKeywords: listOfStrings(source.negativeKeywords ?? source.negative_keywords).slice(0, 20),
  }
}

const normalizeGenerateDiagnosisResult = (value, fallback = {}) => {
  const source = objectOrEmpty(value)
  const diagnosis = objectOrEmpty(source.diagnosis)

  const symptomTagsSource = diagnosis.symptom_tags ?? diagnosis.symptomTags
  const evidenceTagsSource = diagnosis.evidence_tags ?? diagnosis.evidenceTags

  const diagnosisName = text(diagnosis.name) || text(fallback.name)
  const diagnosisCategory = normalizeDiagnosisCategory(diagnosis.category ?? diagnosis.typeLabel) || normalizeDiagnosisCategory(fallback.category)
  const symptomTags = listOfStrings(symptomTagsSource).slice(0, 16)
  const evidenceTags = listOfStrings(evidenceTagsSource).slice(0, 16)
  const hostPlant = text(diagnosis.host_plant ?? diagnosis.hostPlant ?? fallback.hostPlant)
  const riskLevel = normalizeDiagnosisRisk(diagnosis.risk_level ?? diagnosis.riskLevel ?? fallback.riskLevel)

  const confidenceValue = Number(diagnosis.confidence ?? fallback.confidence)
  const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0.5

  return {
    diagnosis: {
      name: diagnosisName,
      category: diagnosisCategory || '虫害',
      symptom_tags: symptomTags,
      evidence_tags: evidenceTags,
      host_plant: hostPlant,
      risk_level: riskLevel,
      confidence,
    },
    rolePack: normalizeGenerateRolePack(source.rolePack),
    styleMode: text(source.styleMode),
  }
}

const maxImageFieldLength = 4 * 1024 * 1024
const maxImageDataBytes = 2 * 1024 * 1024
const allowedImageDataMime = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

const estimateBase64Bytes = (base64Text) => {
  const normalized = base64Text.replace(/\s+/g, '')
  const paddingMatch = normalized.match(/=+$/)
  const padding = paddingMatch ? paddingMatch[0].length : 0
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding)
}

const validateImageField = (value, fieldName) => {
  const raw = text(value)
  if (!raw) {
    return ''
  }

  if (raw.length > maxImageFieldLength) {
    throw new ApiError(400, `${fieldName} is too large`)
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new ApiError(400, `${fieldName} protocol is not allowed`)
      }
      return raw
    } catch {
      throw new ApiError(400, `${fieldName} url is invalid`)
    }
  }

  const dataMatch = raw.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/=\r\n]+)$/)
  if (dataMatch) {
    const mime = String(dataMatch[1] ?? '').trim().toLowerCase()
    if (!allowedImageDataMime.has(mime)) {
      throw new ApiError(400, `${fieldName} mime is not allowed`)
    }

    const bytes = estimateBase64Bytes(String(dataMatch[2] ?? ''))
    if (bytes > maxImageDataBytes) {
      throw new ApiError(400, `${fieldName} exceeds max size`)
    }

    return raw
  }

  throw new ApiError(400, `${fieldName} must be http(s) url or data:image base64`)
}

export const validateCreatePostPayload = (payload) => {
  const title = text(payload?.title)
  const content = text(payload?.content)

  if (!title || !content) {
    throw new ApiError(400, 'title and content are required')
  }

  return {
    title,
    content,
    image: validateImageField(payload?.image, 'image'),
    markdown: text(payload?.markdown),
    mentions: listOfStrings(payload?.mentions),
    topics: listOfStrings(payload?.topics),
  }
}

export const validateCreateReplyPayload = (payload) => {
  const content = text(payload?.content)
  const image = text(payload?.image)

  if (!content && !image) {
    throw new ApiError(400, 'content or image is required')
  }

  const role = payload?.role === 'followup' ? 'followup' : 'answer'
  const replyToFloor = Number(payload?.replyToFloor)

  return {
    content,
    image: validateImageField(image, 'image'),
    role,
    replyToFloor: Number.isFinite(replyToFloor) && replyToFloor > 0 ? Math.floor(replyToFloor) : null,
    markdown: text(payload?.markdown),
    annotations: listOfPoints(payload?.annotations),
  }
}

export const validateSpiritGeneratePayload = (payload) => {
  const name = text(payload?.name)
  const scientificName = text(payload?.scientificName)
  const keywords = listOfStrings(payload?.keywords).slice(0, 16)
  const prompt = text(payload?.prompt)
  const negativePrompt = text(payload?.negativePrompt)
  const checkpoint = text(payload?.checkpoint)
  const filenamePrefix = text(payload?.filenamePrefix)
  const presetId = text(payload?.presetId)
  const workflowId = text(payload?.workflowId)
  const diagnosisResult = normalizeGenerateDiagnosisResult(payload?.diagnosisResult, {
    name,
    category: payload?.identifyTypeLabel,
    riskLevel: payload?.identifyRiskLevel,
    confidence: payload?.confidence,
  })
  const rolePack = normalizeGenerateRolePack(payload?.rolePack ?? diagnosisResult.rolePack)
  const styleMode = text(payload?.styleMode || diagnosisResult.styleMode)

  const diagnosisName = text(diagnosisResult?.diagnosis?.name)
  const diagnosisSignals = [
    ...listOfStrings(diagnosisResult?.diagnosis?.symptom_tags),
    ...listOfStrings(diagnosisResult?.diagnosis?.evidence_tags),
  ]

  if (!prompt && !name && keywords.length === 0 && !diagnosisName && diagnosisSignals.length === 0) {
    throw new ApiError(400, 'prompt or name or keywords or diagnosisResult is required')
  }

  return {
    name,
    scientificName,
    keywords,
    autoRoute: Boolean(payload?.autoRoute),
    identifyTypeLabel: text(payload?.identifyTypeLabel),
    identifyRiskLevel: text(payload?.identifyRiskLevel),
    prompt,
    negativePrompt,
    checkpoint,
    filenamePrefix,
    presetId,
    workflowId,
    diagnosisResult,
    rolePack,
    styleMode,
    seed: Number.isFinite(Number(payload?.seed)) ? Math.floor(Number(payload.seed)) : null,
    width: payload?.width === undefined || payload?.width === null || payload?.width === '' ? null : integerInRange(payload?.width, 768, 256, 1536),
    height: payload?.height === undefined || payload?.height === null || payload?.height === '' ? null : integerInRange(payload?.height, 1024, 256, 1536),
    steps: payload?.steps === undefined || payload?.steps === null || payload?.steps === '' ? null : integerInRange(payload?.steps, 24, 6, 100),
    cfgScale: payload?.cfgScale === undefined || payload?.cfgScale === null || payload?.cfgScale === '' ? null : numberInRange(payload?.cfgScale, 7, 1, 20),
    denoise: payload?.denoise === undefined || payload?.denoise === null || payload?.denoise === '' ? null : numberInRange(payload?.denoise, 1, 0, 1),
    samplerName: text(payload?.samplerName),
    scheduler: text(payload?.scheduler),
  }
}

export const validateSpiritIdentifyPayload = (payload) => {
  const image = validateImageField(payload?.image ?? payload?.imageUrl ?? payload?.image_url, 'image')
  if (!image) {
    throw new ApiError(400, 'image is required')
  }

  return {
    image,
    prompt: text(payload?.prompt),
  }
}

export const validateIdentifyTaskPayload = (payload) => {
  const image = validateImageField(payload?.image ?? payload?.imageUrl ?? payload?.image_url, 'image')
  if (!image) {
    throw new ApiError(400, 'image is required')
  }

  return {
    image,
    prompt: text(payload?.prompt),
    hostPlant: text(payload?.hostPlant),
  }
}

export const validateSpiritChatPayload = (payload) => {
  const question = text(payload?.question)
  if (!question) {
    throw new ApiError(400, 'question is required')
  }

  const spiritSource = objectOrEmpty(payload?.spirit)
  const identifySource = objectOrEmpty(payload?.identify)
  const orchestrationSource = objectOrEmpty(payload?.orchestration)
  const rolePackSource = objectOrEmpty(orchestrationSource.rolePack)
  const personaDesignSource = objectOrEmpty(orchestrationSource.personaDesign)
  const diagnosisSource = objectOrEmpty(orchestrationSource.diagnosisContext)
  const retrievalSource = objectOrEmpty(orchestrationSource.retrievalContext)
  const treatmentTemplateSource = objectOrEmpty(retrievalSource.treatmentTemplate)
  const memorySource = objectOrEmpty(orchestrationSource.memoryContext)

  const sourceIndex = Array.isArray(retrievalSource.sourceIndex)
    ? retrievalSource.sourceIndex
        .map((item) => {
          const record = objectOrEmpty(item)
          const title = text(record.title)
          if (!title) {
            return null
          }
          return {
            title,
            snippet: text(record.snippet),
            url: text(record.url),
            confidenceLabel: text(record.confidenceLabel),
          }
        })
        .filter(Boolean)
        .slice(0, 6)
    : []

  return {
    question,
    spirit: {
      name: text(spiritSource.name),
      scientificName: text(spiritSource.scientificName),
      keywords: listOfStrings(spiritSource.keywords).slice(0, 16),
      summary: text(spiritSource.summary),
      typeLabel: spiritSource.typeLabel === '病害' ? '病害' : '昆虫',
    },
    identify: {
      name: text(identifySource.name),
      scientificName: text(identifySource.scientificName),
      keywords: listOfStrings(identifySource.keywords).slice(0, 16),
      summary: text(identifySource.summary),
      typeLabel: identifySource.typeLabel === '病害' ? '病害' : '昆虫',
    },
    messages: listOfMessages(payload?.messages).slice(0, 20),
    orchestration: {
      sessionId: text(orchestrationSource.sessionId),
      legacySpiritSessionId: text(orchestrationSource.legacySpiritSessionId),
      userAccount: text(orchestrationSource.userAccount),
      systemPolicy: text(orchestrationSource.systemPolicy),
      rolePack: {
        id: text(rolePackSource.id),
        name: text(rolePackSource.name),
        style: text(rolePackSource.style),
        persona: text(rolePackSource.persona),
        guardrails: listOfStrings(rolePackSource.guardrails).slice(0, 16),
      },
      personaDesign: {
        coreConcept: text(personaDesignSource.coreConcept ?? personaDesignSource.core_concept),
        designDirection: text(personaDesignSource.designDirection ?? personaDesignSource.design_direction),
        colorPalette: listOfStrings(personaDesignSource.colorPalette ?? personaDesignSource.color_palette).slice(0, 16),
        silhouette: listOfStrings(personaDesignSource.silhouette).slice(0, 16),
        hairDesign: listOfStrings(personaDesignSource.hairDesign ?? personaDesignSource.hair_design).slice(0, 16),
        outfitElements: listOfStrings(personaDesignSource.outfitElements ?? personaDesignSource.outfit_elements).slice(0, 20),
        accessoryElements: listOfStrings(personaDesignSource.accessoryElements ?? personaDesignSource.accessory_elements).slice(0, 16),
        textureMaterials: listOfStrings(personaDesignSource.textureMaterials ?? personaDesignSource.texture_materials).slice(0, 16),
        symbolicMotifs: listOfStrings(personaDesignSource.symbolicMotifs ?? personaDesignSource.symbolic_motifs).slice(0, 20),
        temperament: listOfStrings(personaDesignSource.temperament).slice(0, 12),
        pose: listOfStrings(personaDesignSource.pose).slice(0, 12),
        forbiddenElements: listOfStrings(personaDesignSource.forbiddenElements ?? personaDesignSource.forbidden_elements).slice(0, 20),
      },
      diagnosisContext: {
        identifyTaskId: text(diagnosisSource.identifyTaskId),
        identifyName: text(diagnosisSource.identifyName),
        scientificName: text(diagnosisSource.scientificName),
        riskLevel: text(diagnosisSource.riskLevel),
        summary: text(diagnosisSource.summary),
        actionCards: listOfStrings(diagnosisSource.actionCards).slice(0, 12),
        sourceRefs: listOfStrings(diagnosisSource.sourceRefs).slice(0, 20),
      },
      retrievalContext: {
        sourceIndex,
        treatmentTemplate: {
          immediateActions: listOfStrings(treatmentTemplateSource.immediateActions).slice(0, 8),
          environmentAdjustments: listOfStrings(treatmentTemplateSource.environmentAdjustments).slice(0, 8),
          followUpSchedule: listOfStrings(treatmentTemplateSource.followUpSchedule).slice(0, 8),
          cautionNotes: listOfStrings(treatmentTemplateSource.cautionNotes).slice(0, 8),
        },
      },
      memoryContext: {
        sessionSummary: text(memorySource.sessionSummary),
        longTermFacts: listOfStrings(memorySource.longTermFacts).slice(0, 12),
        userPreferences: listOfStrings(memorySource.userPreferences).slice(0, 8),
      },
      currentIntent: text(orchestrationSource.currentIntent),
    },
  }
}

export const validateSpiritSessionPayload = (payload) => {
  const identifySource = payload?.identify && typeof payload.identify === 'object' ? payload.identify : {}
  const generationSource = payload?.generation && typeof payload.generation === 'object' ? payload.generation : {}
  const identifyTaskId = text(identifySource.taskId)
  const identifyName = text(identifySource.name)
  const identifySourceRefs = listOfStrings(identifySource.sourceRefs).slice(0, 20)
  const identifyKeywords = listOfStrings(identifySource.keywords)
  const generationTaskId = text(generationSource.taskId)
  const messageList = listOfMessages(payload?.messages).slice(0, 80)

  if (!identifyTaskId && !identifyName && identifyKeywords.length === 0 && !generationTaskId) {
    throw new ApiError(400, 'identify or generation.taskId is required')
  }

  return {
    identify: {
      taskId: identifyTaskId,
      name: identifyName,
      scientificName: text(identifySource.scientificName),
      sourceRefs: identifySourceRefs,
      keywords: identifyKeywords.slice(0, 16),
      summary: text(identifySource.summary),
      cover: validateImageField(identifySource.cover, 'identify.cover'),
      encyclopediaId: text(identifySource.encyclopediaId),
      provider: text(identifySource.provider),
      model: text(identifySource.model),
    },
    generation: {
      taskId: generationTaskId,
      status: text(generationSource.status),
      imageUrl: validateImageField(generationSource.imageUrl, 'generation.imageUrl'),
      promptId: text(generationSource.promptId),
      prompt: text(generationSource.prompt),
      negativePrompt: text(generationSource.negativePrompt),
      durationMs: Number.isFinite(Number(generationSource.durationMs)) ? Math.max(0, Number(generationSource.durationMs)) : 0,
      presetId: text(generationSource.presetId),
      workflowId: text(generationSource.workflowId),
      workflowPath: text(generationSource.workflowPath),
      workflowMode: text(generationSource.workflowMode),
      workflowFallbackReason: text(generationSource.workflowFallbackReason),
      routingRuleId: text(generationSource.routingRuleId),
      routingRuleLabel: text(generationSource.routingRuleLabel),
      routingMatchedKeywords: listOfStrings(generationSource.routingMatchedKeywords).slice(0, 12),
    },
    messages: messageList,
  }
}

export const validateSpiritDraftPayload = (payload) => {
  const sessionId = text(payload?.sessionId)
  if (!sessionId) {
    throw new ApiError(400, 'sessionId is required')
  }

  return {
    sessionId,
    title: text(payload?.title),
    extraContext: text(payload?.extraContext),
    image: validateImageField(payload?.image, 'image'),
    topics: listOfStrings(payload?.topics).slice(0, 8),
    mentions: listOfStrings(payload?.mentions).slice(0, 8),
  }
}

export const validateSpiritDraftUpdatePayload = (payload) => {
  const title = text(payload?.title)
  const content = text(payload?.content)
  const markdown = text(payload?.markdown)
  const image = text(payload?.image)
  const topics = listOfStrings(payload?.topics).slice(0, 8)
  const mentions = listOfStrings(payload?.mentions).slice(0, 8)

  if (!title && !content && !markdown && !image && topics.length === 0 && mentions.length === 0) {
    throw new ApiError(400, 'at least one draft field is required')
  }

  return {
    title,
    content,
    markdown,
    image: validateImageField(image, 'image'),
    topics,
    mentions,
  }
}

export const validateKnowledgeBackflowExtractPayload = (payload) => {
  return {
    q: text(payload?.q || payload?.query),
    minQualityScore: integerInRange(payload?.minQualityScore, 60, 0, 100),
    limit: integerInRange(payload?.limit, 20, 1, 100),
  }
}

export const validateKnowledgeBackflowApprovePayload = (payload) => {
  const rawConflictStrategy = text(payload?.conflictStrategy || payload?.conflict_strategy).toLowerCase()
  const conflictStrategy =
    rawConflictStrategy === 'overwrite' || rawConflictStrategy === 'merge' || rawConflictStrategy === 'keep_existing'
      ? rawConflictStrategy
      : ''

  return {
    entryId: text(payload?.entryId || payload?.entry_id),
    approvedBy: text(payload?.approvedBy || payload?.approved_by),
    reviewNote: text(payload?.reviewNote || payload?.review_note),
    force: Boolean(payload?.force),
    conflictStrategy,
  }
}

export const validateKnowledgeBackflowRejectPayload = (payload) => {
  return {
    rejectedBy: text(payload?.rejectedBy || payload?.rejected_by),
    reviewNote: text(payload?.reviewNote || payload?.review_note),
  }
}

export const validateKnowledgeBackflowRollbackPayload = (payload) => {
  return {
    rolledBackBy: text(payload?.rolledBackBy || payload?.rolled_back_by),
    reviewNote: text(payload?.reviewNote || payload?.review_note),
    rollbackToReviewId: text(payload?.rollbackToReviewId || payload?.rollback_to_review_id),
    force: Boolean(payload?.force),
  }
}
