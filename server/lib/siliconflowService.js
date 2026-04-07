import OpenAI from 'openai'
import { ApiError } from './errors.js'
import { createPromptOrchestrator } from './promptOrchestrator.js'

const toText = (value) => String(value ?? '').trim()

const toStringList = (value, max = 16) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, max)
}

const defaultIdentifyPrompt = [
  '你是校园植保识别助手。请根据图片输出 JSON。',
  '字段必须包含：name, scientificName, confidence, typeLabel, keywords, summary, controlTips, cover, spiritPreview, encyclopediaId。',
  '约束：typeLabel 只能是“昆虫”或“病害”；confidence 范围 0~1；keywords 2~6 个；controlTips 1~3 条。',
  '无法确定时输出“未知对象”并降低 confidence。',
].join('\n')

const defaultChatSystemPrompt = [
  '你是“四季夏木”校园植保助手。',
  '请给出可执行建议（观察 -> 处置 -> 复查）。',
  '不要夸大结论，不确定时提示复核。',
  '用简洁中文回复，输出纯文本。',
].join('\n')

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
        if (!item || typeof item !== 'object') {
          return ''
        }
        if (item.type !== 'text') {
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

const normalizeIdentifyResult = (raw, fallbackImage) => {
  const source = raw && typeof raw === 'object' ? raw : {}
  const typeLabel = source.typeLabel === '病害' ? '病害' : '昆虫'
  const confidenceRaw = Number(source.confidence)
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.5
  const controlTips = toStringList(source.controlTips, 3)
  const keywords = toStringList(source.keywords, 6)

  return {
    name: toText(source.name) || '未知对象',
    scientificName: toText(source.scientificName) || 'Unknown species',
    confidence,
    typeLabel,
    keywords: keywords.length > 0 ? keywords : ['待复核'],
    summary: toText(source.summary) || '暂未获得稳定识别结论，建议补充更清晰图像后复核。',
    controlTips: controlTips.length > 0 ? controlTips : ['建议先记录虫口密度并持续观察，必要时请老师复核。'],
    cover: toText(source.cover) || fallbackImage,
    spiritPreview: toText(source.spiritPreview) || fallbackImage,
    encyclopediaId: toText(source.encyclopediaId),
  }
}

export const createSiliconflowService = (options = {}) => {
  const baseURL = toText(options.baseURL ?? process.env.SILICONFLOW_BASE_URL) || 'https://api.siliconflow.cn/v1'
  const apiKey = toText(options.apiKey ?? process.env.SILICONFLOW_API_KEY)
  const visionModel = toText(options.visionModel ?? process.env.SILICONFLOW_VISION_MODEL) || 'Qwen/Qwen3-VL-32B-Instruct'
  const chatModel = toText(options.chatModel ?? process.env.SILICONFLOW_CHAT_MODEL) || 'deepseek-ai/DeepSeek-V3'
  const timeoutRaw = Number(options.timeout ?? process.env.SILICONFLOW_TIMEOUT_MS)
  const timeoutMs = Number.isFinite(timeoutRaw) ? Math.max(3_000, Math.floor(timeoutRaw)) : 45_000
  const promptOrchestrator =
    options.promptOrchestrator ??
    createPromptOrchestrator({
      defaultSystemPolicy: defaultChatSystemPrompt,
    })
  const injectedClient = options.client && typeof options.client === 'object' ? options.client : null

  const client =
    injectedClient ??
    (apiKey.length > 0
      ? new OpenAI({
          apiKey,
          baseURL,
          timeout: timeoutMs,
          maxRetries: 1,
        })
      : null)

  const ensureConfigured = () => {
    if (!client) {
      throw new ApiError(503, 'siliconflow api is not configured')
    }
  }

  return {
    async identifyImage(payload) {
      ensureConfigured()
      const image = toText(payload?.image)
      const prompt = toText(payload?.prompt) || defaultIdentifyPrompt

      try {
        const completion = await client.chat.completions.create({
          model: visionModel,
          temperature: 0.2,
          messages: [
            { role: 'system', content: '你必须输出 JSON，不要输出额外说明。' },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
        })

        const rawText = extractMessageText(completion.choices?.[0]?.message)
        const parsed = parseJsonFromText(rawText)

        return {
          ...normalizeIdentifyResult(parsed, image),
          provider: 'siliconflow',
          model: toText(completion.model) || visionModel,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'siliconflow identify failed'
        throw new ApiError(502, message)
      }
    },

    async chat(payload) {
      ensureConfigured()

      try {
        const completion = await client.chat.completions.create({
          model: chatModel,
          temperature: 0.4,
          messages: promptOrchestrator.resolveChatMessages(payload),
        })

        const reply = extractMessageText(completion.choices?.[0]?.message)
        if (!reply) {
          throw new Error('empty chat reply')
        }

        return {
          reply,
          provider: 'siliconflow',
          model: toText(completion.model) || chatModel,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'siliconflow chat failed'
        throw new ApiError(502, message)
      }
    },

    async chatStream(payload, handlers = {}) {
      ensureConfigured()
      let reply = ''
      let resolvedModel = chatModel

      try {
        const stream = await client.chat.completions.create({
          model: chatModel,
          temperature: 0.4,
          messages: promptOrchestrator.resolveChatMessages(payload),
          stream: true,
        })

        for await (const chunk of stream) {
          resolvedModel = toText(chunk?.model) || resolvedModel
          const delta = toText(chunk?.choices?.[0]?.delta?.content)
          if (!delta) {
            continue
          }

          reply += delta
          if (typeof handlers.onDelta === 'function') {
            await handlers.onDelta(delta)
          }
        }

        if (!reply) {
          throw new Error('empty chat stream reply')
        }

        const donePayload = {
          reply,
          provider: 'siliconflow',
          model: resolvedModel,
        }

        if (typeof handlers.onDone === 'function') {
          await handlers.onDone(donePayload)
        }

        return donePayload
      } catch (error) {
        const message = error instanceof Error ? error.message : 'siliconflow chat stream failed'
        throw new ApiError(502, message)
      }
    },
  }
}
