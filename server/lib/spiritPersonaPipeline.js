import OpenAI from 'openai'
import {
  buildAnimePersonaPromptFromDiagnosis,
  buildComfyPromptFromPersonaDesign,
  buildPersonaDesignFromDiagnosis,
} from './spiritPersonaPromptBuilder.js'

const toText = (value) => String(value ?? '').trim()
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toList = (value, max = 16) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, max)
}

const dedupe = (items) => Array.from(new Set((Array.isArray(items) ? items : []).map((item) => toText(item)).filter(Boolean)))

const extractMessageText = (message) => {
  if (!message) {
    return ''
  }

  if (typeof message.content === 'string') {
    return message.content.trim()
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item) => {
        if (!item || typeof item !== 'object' || item.type !== 'text') {
          return ''
        }
        return toText(item.text)
      })
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return ''
}

const parseJsonFromText = (rawText) => {
  const content = toText(rawText)
  if (!content) {
    throw new Error('empty response')
  }

  const directTry = content.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(directTry)
  } catch {
    const firstBrace = content.indexOf('{')
    const lastBrace = content.lastIndexOf('}')
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error('json block not found')
    }
    return JSON.parse(content.slice(firstBrace, lastBrace + 1))
  }
}

const visualMappingPrompt = [
  '你要把识图结果转译为二次元角色视觉设计语言。',
  '不要输出解释，不要 markdown，只能输出 JSON。',
  '必须包含字段：core_concept, design_direction, color_palette, silhouette, hair_design, outfit_elements, accessory_elements, texture_materials, symbolic_motifs, temperament, pose, forbidden_elements。',
  '禁止退化为 generic anime girl；识图语义必须决定角色原型。',
].join('\n')

const imagePromptPrompt = [
  '你要根据角色视觉 JSON 生成 ComfyUI 可用的正负提示词 JSON。',
  '只输出 JSON，字段必须为 positivePrompt 和 negativePrompt。',
  '如果对象是昆虫灵化角色，必须把触角、节肢、鞘翅、腹部、口器等关键解剖特征放在 prompt 前半段。',
  'positivePrompt 按：角色原型/来源意象/配色/轮廓/发型/服装/饰品/材质/象征元素/气质/二次元风格/质量标签。',
  'negativePrompt 必须抑制 generic anime girl、固定模板、无关元素，以及缺失关键昆虫结构的画面。',
].join('\n')

const normalizePersonaDesignJson = (raw, fallbackPersona) => {
  const source = isRecord(raw) ? raw : {}
  const fallback = isRecord(fallbackPersona) ? fallbackPersona : {}
  return {
    core_concept: toText(source.core_concept) || toText(fallback.core_concept),
    design_direction: toText(source.design_direction) || toText(fallback.design_direction),
    color_palette: dedupe(toList(source.color_palette, 8).concat(toList(fallback.color_palette, 8))).slice(0, 8),
    silhouette: dedupe(toList(source.silhouette, 8).concat(toList(fallback.silhouette, 8))).slice(0, 8),
    hair_design: dedupe(toList(source.hair_design, 8).concat(toList(fallback.hair_design, 8))).slice(0, 8),
    outfit_elements: dedupe(toList(source.outfit_elements, 10).concat(toList(fallback.outfit_elements, 10))).slice(0, 10),
    accessory_elements: dedupe(toList(source.accessory_elements, 8).concat(toList(fallback.accessory_elements, 8))).slice(0, 8),
    texture_materials: dedupe(toList(source.texture_materials, 8).concat(toList(fallback.texture_materials, 8))).slice(0, 8),
    symbolic_motifs: dedupe(toList(source.symbolic_motifs, 10).concat(toList(fallback.symbolic_motifs, 10))).slice(0, 10),
    temperament: dedupe(toList(source.temperament, 6).concat(toList(fallback.temperament, 6))).slice(0, 6),
    pose: dedupe(toList(source.pose, 6).concat(toList(fallback.pose, 6))).slice(0, 6),
    anatomy_anchors: dedupe(toList(source.anatomy_anchors, 8).concat(toList(fallback.anatomy_anchors, 8))).slice(0, 8),
    behavior_anchors: dedupe(toList(source.behavior_anchors, 6).concat(toList(fallback.behavior_anchors, 6))).slice(0, 6),
    negative_anatomy: dedupe(toList(source.negative_anatomy, 12).concat(toList(fallback.negative_anatomy, 12))).slice(0, 12),
    forbidden_elements: dedupe(toList(source.forbidden_elements, 12).concat(toList(fallback.forbidden_elements, 12))).slice(0, 12),
  }
}

const normalizePromptJson = (raw, fallbackPrompts) => {
  const source = isRecord(raw) ? raw : {}
  const fallback = isRecord(fallbackPrompts) ? fallbackPrompts : {}

  const mergePromptText = (...values) =>
    dedupe(
      values.flatMap((value) =>
        toText(value)
          .split(',')
          .map((item) => toText(item)),
      ),
    )
      .slice(0, 64)
      .join(', ')

  return {
    positivePrompt: mergePromptText(fallback.positivePrompt, source.positivePrompt),
    negativePrompt: mergePromptText(fallback.negativePrompt, source.negativePrompt),
  }
}

const tryCallJsonModel = async ({ client, model, systemPrompt, payload, temperature = 0.3 }) => {
  const completion = await client.chat.completions.create({
    model,
    temperature,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify(payload, null, 2),
      },
    ],
  })

  return parseJsonFromText(extractMessageText(completion.choices?.[0]?.message))
}

export const createSpiritPersonaPipeline = (options = {}) => {
  const apiKey = toText(options.apiKey ?? process.env.SILICONFLOW_API_KEY)
  const baseURL = toText(options.baseURL ?? process.env.SILICONFLOW_BASE_URL) || 'https://api.siliconflow.cn/v1'
  const model = toText(options.model ?? process.env.SILICONFLOW_PERSONA_MODEL ?? process.env.SILICONFLOW_CHAT_MODEL) || 'deepseek-ai/DeepSeek-V3'
  const timeoutMsRaw = Number(options.timeoutMs ?? process.env.SILICONFLOW_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(3_000, Math.floor(timeoutMsRaw)) : 45_000

  const injectedClient = options.client && typeof options.client === 'object' ? options.client : null
  const client =
    injectedClient ??
    (apiKey
      ? new OpenAI({
          apiKey,
          baseURL,
          timeout: timeoutMs,
          maxRetries: 1,
        })
      : null)

  return {
    async buildFromDiagnosis({ diagnosisResult, rolePack, styleMode } = {}) {
      const fallback = buildAnimePersonaPromptFromDiagnosis(diagnosisResult, rolePack, styleMode)
      const fallbackPersona = fallback.personaDesignJson
      const fallbackPrompts = {
        positivePrompt: fallback.positivePrompt,
        negativePrompt: fallback.negativePrompt,
      }

      let personaDesignJson = fallbackPersona
      let visualStage = 'fallback'
      if (client) {
        try {
          const mapped = await tryCallJsonModel({
            client,
            model,
            systemPrompt: visualMappingPrompt,
            payload: {
              diagnosisResult: fallback.diagnosisResult,
              rolePack: fallback.rolePack,
              styleMode: fallback.styleMode,
            },
          })
          personaDesignJson = normalizePersonaDesignJson(mapped, fallbackPersona)
          visualStage = 'ai'
        } catch {
          personaDesignJson = fallbackPersona
          visualStage = 'fallback'
        }
      }

      let promptPair = buildComfyPromptFromPersonaDesign(personaDesignJson, {
        diagnosisResult: fallback.diagnosisResult,
        rolePack: fallback.rolePack,
        styleMode: fallback.styleMode,
      })
      let promptStage = 'fallback'
      if (client) {
        try {
          const generated = await tryCallJsonModel({
            client,
            model,
            systemPrompt: imagePromptPrompt,
            payload: {
              personaDesignJson,
              rolePackStyle: fallback.rolePack,
              diagnosisResult: fallback.diagnosisResult,
            },
          })
          const normalized = normalizePromptJson(generated, fallbackPrompts)
          promptPair = {
            ...promptPair,
            positivePrompt: normalized.positivePrompt,
            negativePrompt: normalized.negativePrompt,
          }
          promptStage = 'ai'
        } catch {
          promptStage = 'fallback'
        }
      }

      const extractedPersonaTags = dedupe([
        ...toList(personaDesignJson.color_palette, 8),
        ...toList(personaDesignJson.silhouette, 8),
        ...toList(personaDesignJson.hair_design, 8),
        ...toList(personaDesignJson.outfit_elements, 8),
        ...toList(personaDesignJson.accessory_elements, 8),
        ...toList(personaDesignJson.texture_materials, 8),
        ...toList(personaDesignJson.symbolic_motifs, 8),
      ]).slice(0, 24)

      return {
        personaDesignJson,
        positivePrompt: promptPair.positivePrompt,
        negativePrompt: promptPair.negativePrompt,
        extractedPersonaTags,
        diagnosisResult: fallback.diagnosisResult,
        rolePack: fallback.rolePack,
        styleMode: fallback.styleMode,
        softenedInsectFeatures: toList(promptPair.softenedInsectFeatures ?? fallback.softenedInsectFeatures, 24),
        hostPlantAnchor: toText(promptPair.hostPlantAnchor ?? fallback.hostPlantAnchor),
        ratioConstraints: toList(promptPair.ratioConstraints ?? fallback.ratioConstraints, 12),
        stages: {
          visualMapping: visualStage,
          promptGeneration: promptStage,
        },
      }
    },
  }
}
