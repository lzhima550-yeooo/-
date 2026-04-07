import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn2Vh8AAAAASUVORK5CYII='
const defaultRealModeIdentifyImage = 'https://sf-maas-uat-prod.oss-cn-shanghai.aliyuncs.com/dog.png'

const toText = (value) => String(value ?? '').trim()

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) {
      continue
    }

    const [keyText, valueFromPair] = token.split('=')
    const key = keyText.replace(/^--/, '').trim()
    const value = valueFromPair === undefined ? toText(args[index + 1]) : toText(valueFromPair)
    if (!key) {
      continue
    }

    if (valueFromPair === undefined && args[index + 1] && !args[index + 1].startsWith('--')) {
      index += 1
    }

    out[key] = value || 'true'
  }

  return out
}

const loadDotEnv = () => {
  const envPath = resolve(process.cwd(), '.env')
  const out = {}
  if (!existsSync(envPath)) {
    return out
  }

  const raw = readFileSync(envPath, 'utf8')
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const index = line.indexOf('=')
      if (index <= 0) {
        return
      }
      const key = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!key || value === '') {
        return
      }
      out[key] = value
    })

  return out
}

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const parseJsonSafe = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const consumeSseBlock = (blockText) => {
  const lines = blockText.split(/\r?\n/)
  const dataLines = []
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }
  return dataLines.join('\n').trim()
}

const buildError = (message, details) => {
  const detailText = toText(details)
  return new Error(detailText ? `${message} | ${detailText}` : message)
}

const pickFirst = (arrayLike) => {
  const list = Array.isArray(arrayLike) ? arrayLike : []
  return list[0] ?? null
}

const run = async () => {
  const args = parseArgs()
  const envFile = loadDotEnv()

  const apiHost = toText(args.host || process.env.API_HOST || envFile.API_HOST) || '127.0.0.1'
  const apiPort = Number(args.port || process.env.API_PORT || envFile.API_PORT || 8787)
  const apiBase =
    toText(args['api-base'] || args.apiBase || process.env.DEMO_API_BASE_URL || `http://${apiHost}:${apiPort}`) ||
    `http://${apiHost}:${apiPort}`
  const mode = (toText(args.mode || process.env.DEMO_MODE) || 'real').toLowerCase() === 'offline' ? 'offline' : 'real'
  const identifyImageFromArgs = toText(args.image || process.env.DEMO_IDENTIFY_IMAGE_URL || envFile.DEMO_IDENTIFY_IMAGE_URL)
  const identifyImage =
    identifyImageFromArgs || (mode === 'real' ? defaultRealModeIdentifyImage : tinyPngDataUrl)
  const pollTimeoutMs = Math.max(5_000, Number(args.timeoutMs || process.env.DEMO_POLL_TIMEOUT_MS || 120_000) || 120_000)
  const pollIntervalMs = Math.max(500, Number(args.intervalMs || process.env.DEMO_POLL_INTERVAL_MS || 1500) || 1500)

  const startedAtMs = Date.now()
  const report = {
    pass: false,
    mode,
    apiBase,
    identifyImageSource: identifyImage.startsWith('http') ? 'url' : 'data-url',
    startedAt: new Date(startedAtMs).toISOString(),
    elapsedMs: 0,
    warnings: [],
    steps: [],
    artifacts: {},
  }

  const requestJson = async (method, pathname, body, headers = {}) => {
    const response = await fetch(`${apiBase}${pathname}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const raw = await response.text()
    const parsed = parseJsonSafe(raw)
    if (!response.ok) {
      throw buildError(`request failed ${method} ${pathname}`, `${response.status} ${raw}`)
    }

    return parsed ?? {}
  }

  const runStep = async (name, fn) => {
    const startedMs = Date.now()
    try {
      const data = await fn()
      report.steps.push({
        name,
        status: 'passed',
        durationMs: Date.now() - startedMs,
      })
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      report.steps.push({
        name,
        status: 'failed',
        durationMs: Date.now() - startedMs,
        message,
      })
      throw error
    }
  }

  const streamChat = async (payload) => {
    const response = await fetch(`${apiBase}/api/chat/stream`, {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok || !response.body) {
      const text = await response.text()
      throw buildError('chat stream request failed', `${response.status} ${text}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let reply = ''
    let donePayload = {}

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      while (true) {
        const boundary = buffer.indexOf('\n\n')
        if (boundary < 0) {
          break
        }

        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const dataText = consumeSseBlock(block)
        if (!dataText) {
          continue
        }

        if (dataText === '[DONE]') {
          return {
            reply,
            donePayload,
          }
        }

        const payloadRecord = parseJsonSafe(dataText)
        if (!payloadRecord || typeof payloadRecord !== 'object') {
          continue
        }

        const type = toText(payloadRecord.type)
        if (type === 'delta') {
          reply += toText(payloadRecord.text)
          continue
        }

        if (type === 'done') {
          donePayload = payloadRecord
          continue
        }

        if (type === 'error') {
          throw buildError('chat stream event error', toText(payloadRecord.message))
        }
      }
    }

    if (!reply) {
      throw buildError('chat stream ended without reply')
    }

    return {
      reply,
      donePayload,
    }
  }

  const findFallbackEntryId = async () => {
    const listBody = await requestJson('GET', '/api/encyclopedia?limit=1')
    const items = Array.isArray(listBody.items) ? listBody.items : []
    return toText(items[0]?.id)
  }

  try {
    await runStep('health', async () => {
      const body = await requestJson('GET', '/api/health')
      if (!body?.ok) {
        throw buildError('health check failed', JSON.stringify(body))
      }
      report.artifacts.healthProvider = toText(body.provider)
    })

    const identifyTask = await runStep('identify-task', async () => {
      const doIdentify = async () => {
        const createBody = await requestJson('POST', '/api/identify/tasks', {
          image: identifyImage,
          prompt: '识别图像中的校园植保风险对象，返回结构化结果。',
          hostPlant: '校园常见观赏植物',
        })
        const taskId = toText(createBody?.data?.id)
        if (!taskId) {
          throw buildError('identify task id missing', JSON.stringify(createBody))
        }
        report.artifacts.identifyTaskId = taskId

        const deadline = Date.now() + pollTimeoutMs
        while (Date.now() < deadline) {
          const detailBody = await requestJson('GET', `/api/identify/tasks/${encodeURIComponent(taskId)}`)
          const task = detailBody?.data ?? {}
          const status = toText(task.status)
          if (status === 'succeeded') {
            return task
          }
          if (status === 'failed') {
            throw buildError('identify task failed', task.failureReason || task.error || JSON.stringify(task))
          }
          await sleep(pollIntervalMs)
        }

        throw buildError('identify task polling timeout', `${pollTimeoutMs}ms`)
      }

      if (mode === 'real') {
        return doIdentify()
      }

      try {
        return await doIdentify()
      } catch (error) {
        report.warnings.push(`identify fallback used: ${error instanceof Error ? error.message : String(error)}`)
        const fallbackEntryId = (await findFallbackEntryId()) || 'disease-puccinia-striiformis-tritici'
        return {
          id: 'offline-identify-fallback',
          status: 'succeeded',
          riskLevel: 'high',
          topResult: {
            name: '离线演示对象',
            category: '病害',
            confidence: 0.86,
            evidenceTags: ['离线模式', '演示'],
          },
          identify: {
            name: '离线演示对象',
            scientificName: 'Offline demo species',
            confidence: 0.86,
            typeLabel: '病害',
            keywords: ['离线', '演示'],
            summary: '离线模式下使用本地演示识别结果。',
            controlTips: ['先隔离疑似病株', '记录病斑变化并复查'],
            cover: '',
            spiritPreview: '',
            encyclopediaId: fallbackEntryId,
            provider: 'offline',
            model: 'offline-demo',
          },
          actionCards: [
            {
              type: 'immediate',
              title: '立即处理',
              description: '先隔离并清理高风险部位。',
            },
            {
              type: 'encyclopedia',
              title: '图鉴查证',
              description: '查看图鉴详情和治理模板。',
            },
          ],
          encyclopediaRefs: [fallbackEntryId],
          sourceRefs: ['offline:fallback'],
        }
      }
    })

    const riskLevel = toText(identifyTask?.riskLevel) || 'unknown'
    report.artifacts.identifyRiskLevel = riskLevel
    report.artifacts.identifyActionCardCount = Array.isArray(identifyTask?.actionCards) ? identifyTask.actionCards.length : 0

    const encyclopediaDetail = await runStep('encyclopedia-detail', async () => {
      const refs = Array.isArray(identifyTask?.encyclopediaRefs) ? identifyTask.encyclopediaRefs : []
      const entryIdFromRef = toText(refs[0])
      const entryIdFromIdentify = toText(identifyTask?.identify?.encyclopediaId)
      const entryId = entryIdFromRef || entryIdFromIdentify || (await findFallbackEntryId())
      if (!entryId) {
        throw buildError('encyclopedia entry id is empty')
      }
      report.artifacts.encyclopediaEntryId = entryId

      const detailBody = await requestJson('GET', `/api/encyclopedia/${encodeURIComponent(entryId)}`)
      const data = detailBody?.data ?? {}
      if (!data?.entry?.id) {
        throw buildError('encyclopedia detail payload invalid', JSON.stringify(detailBody))
      }
      return data
    })

    report.artifacts.sourceIndexCount = Array.isArray(encyclopediaDetail.sourceIndex)
      ? encyclopediaDetail.sourceIndex.length
      : 0

    const chatStreamResult = await runStep('chat-stream', async () => {
      const payload = {
        question: '请给我今天可执行的处置与复查建议。',
        identify: {
          name: toText(identifyTask?.identify?.name) || toText(identifyTask?.topResult?.name) || '待识别对象',
          scientificName: toText(identifyTask?.identify?.scientificName),
          summary: toText(identifyTask?.identify?.summary),
          keywords: Array.isArray(identifyTask?.identify?.keywords) ? identifyTask.identify.keywords.slice(0, 6) : [],
          typeLabel: toText(identifyTask?.identify?.typeLabel) === '病害' ? '病害' : '昆虫',
        },
        orchestration: {
          rolePack: {
            id: 'ladybug-guide',
            name: '瓢虫学姐',
          },
          diagnosisContext: {
            identifyName: toText(identifyTask?.identify?.name),
            scientificName: toText(identifyTask?.identify?.scientificName),
            riskLevel,
            summary: toText(identifyTask?.identify?.summary),
            actionCards: Array.isArray(identifyTask?.actionCards)
              ? identifyTask.actionCards.map((card) => toText(card.title)).filter(Boolean).slice(0, 5)
              : [],
          },
          retrievalContext: {
            sourceIndex: Array.isArray(encyclopediaDetail.sourceIndex) ? encyclopediaDetail.sourceIndex.slice(0, 3) : [],
            treatmentTemplate: encyclopediaDetail.treatmentTemplate ?? {},
          },
          memoryContext: {
            sessionSummary: '联调脚本自动注入会话摘要',
            longTermFacts: ['用于验证 conversation_sessions + memory_summaries 持久化'],
          },
          currentIntent: 'demo_rehearsal',
        },
      }

      if (mode === 'real') {
        return streamChat(payload)
      }

      try {
        return await streamChat(payload)
      } catch (error) {
        report.warnings.push(`chat stream fallback used: ${error instanceof Error ? error.message : String(error)}`)
        return {
          reply: '离线模式：使用本地演示回复。',
          donePayload: {
            provider: 'offline',
            model: 'offline-demo',
            conversationSessionId: '',
            memorySummaryId: '',
            memoryHits: 0,
          },
        }
      }
    })

    report.artifacts.chatReplyLength = toText(chatStreamResult.reply).length
    report.artifacts.chatProvider = toText(chatStreamResult?.donePayload?.provider)
    report.artifacts.chatModel = toText(chatStreamResult?.donePayload?.model)
    report.artifacts.conversationSessionId = toText(chatStreamResult?.donePayload?.conversationSessionId)
    report.artifacts.memorySummaryId = toText(chatStreamResult?.donePayload?.memorySummaryId)
    report.artifacts.memoryHits = Number(chatStreamResult?.donePayload?.memoryHits ?? 0) || 0

    const spiritSession = await runStep('spirit-session', async () => {
      const sessionBody = await requestJson('POST', '/api/spirit/sessions', {
        identify: {
          name: toText(identifyTask?.identify?.name) || toText(identifyTask?.topResult?.name) || '联调对象',
          scientificName: toText(identifyTask?.identify?.scientificName),
          keywords: Array.isArray(identifyTask?.identify?.keywords) ? identifyTask.identify.keywords.slice(0, 8) : [],
          summary: toText(identifyTask?.identify?.summary) || '联调脚本自动生成',
          encyclopediaId: toText(report.artifacts.encyclopediaEntryId),
        },
        generation: {
          status: 'succeeded',
          imageUrl: '',
          promptId: 'demo-no-image',
          durationMs: 0,
          presetId: 'demo',
          workflowId: 'demo',
        },
        messages: [
          {
            role: 'user',
            text: '请给我一个今日执行计划。',
          },
          {
            role: 'spirit',
            text: toText(chatStreamResult.reply) || '离线模式：本条为演示消息。',
          },
        ],
      })

      const data = sessionBody?.data ?? {}
      if (!toText(data.id)) {
        throw buildError('spirit session id missing', JSON.stringify(sessionBody))
      }
      return data
    })
    report.artifacts.spiritSessionId = toText(spiritSession.id)

    const draft = await runStep('community-draft', async () => {
      const draftBody = await requestJson('POST', '/api/spirit/community-drafts', {
        sessionId: toText(spiritSession.id),
        extraContext: '这是 P12-2 脚本自动生成的发布前联调草稿。',
      })
      const data = draftBody?.data ?? {}
      if (!toText(data.id)) {
        throw buildError('community draft id missing', JSON.stringify(draftBody))
      }
      return data
    })
    report.artifacts.draftId = toText(draft.id)

    const publish = await runStep('draft-publish', async () => {
      const publishBody = await requestJson(
        'POST',
        `/api/spirit/community-drafts/${encodeURIComponent(toText(draft.id))}/publish`,
      )
      const data = publishBody?.data ?? {}
      if (!toText(data.postId)) {
        throw buildError('published post id missing', JSON.stringify(publishBody))
      }
      return data
    })
    report.artifacts.publishedPostId = toText(publish.postId)
    report.artifacts.publishReused = Boolean(publish.reused)

    report.pass = true
    report.elapsedMs = Date.now() - startedAtMs
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2))
  } catch (error) {
    report.pass = false
    report.elapsedMs = Date.now() - startedAtMs
    const message = error instanceof Error ? error.message : String(error)
    // eslint-disable-next-line no-console
    console.error('[verify:final-demo] FAIL', message)
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(report, null, 2))
    process.exitCode = 1
  }
}

run()
