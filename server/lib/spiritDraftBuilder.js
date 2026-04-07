const safeText = (value) => String(value ?? '').trim()

const normalizeTopics = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, 8)
}

const normalizeMentions = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, 8)
}

const normalizeMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const role = item.role === 'user' ? 'user' : 'spirit'
      const text = safeText(item.text)
      if (!text) {
        return null
      }

      return {
        role,
        text,
      }
    })
    .filter(Boolean)
}

const buildDraftTitle = (session, titleOverride = '') => {
  const trimmed = safeText(titleOverride)
  if (trimmed) {
    return trimmed
  }

  const name = safeText(session?.identify?.name) || '未知对象'
  return `【灵化记录】${name}识别与防治建议`
}

const buildDraftTopics = (session, topics = []) => {
  const explicit = normalizeTopics(topics)
  if (explicit.length > 0) {
    return explicit
  }

  const sourceKeywords = Array.isArray(session?.identify?.keywords) ? session.identify.keywords : []
  const fromKeywords = sourceKeywords.map((item) => safeText(item)).filter(Boolean).slice(0, 3)
  return Array.from(new Set(['灵化角色', '校园植保', ...fromKeywords])).slice(0, 8)
}

const buildDraftMentions = (mentions = []) => {
  return Array.from(new Set(normalizeMentions(mentions))).slice(0, 8)
}

const buildDraftContent = (session, extraContext = '') => {
  const identify = session?.identify ?? {}
  const generation = session?.generation ?? {}
  const messages = normalizeMessages(session?.messages)

  const name = safeText(identify.name) || '未知对象'
  const scientificName = safeText(identify.scientificName) || '待确认'
  const identifyTaskId = safeText(identify.taskId)
  const sourceRefs = Array.isArray(identify.sourceRefs) ? identify.sourceRefs.map((item) => safeText(item)).filter(Boolean).slice(0, 8) : []
  const summary = safeText(identify.summary) || '暂无概述'
  const keywords = Array.isArray(identify.keywords) ? identify.keywords.map((item) => safeText(item)).filter(Boolean) : []
  const keywordText = keywords.length > 0 ? keywords.join(' / ') : '暂无关键词'
  const generationTaskId = safeText(generation.taskId)
  const generationPromptId = safeText(generation.promptId)
  const generationPrompt = safeText(generation.prompt)
  const generationNegativePrompt = safeText(generation.negativePrompt)
  const generationPresetId = safeText(generation.presetId)
  const generationWorkflowId = safeText(generation.workflowId)
  const generationWorkflowPath = safeText(generation.workflowPath)
  const generationWorkflowMode = safeText(generation.workflowMode)
  const generationWorkflowFallbackReason = safeText(generation.workflowFallbackReason)
  const generationRoutingRuleLabel = safeText(generation.routingRuleLabel)
  const durationMs = Number.isFinite(Number(generation.durationMs)) ? Math.max(0, Number(generation.durationMs)) : 0
  const durationText = durationMs > 0 ? `${durationMs}ms` : '未记录'
  const extra = safeText(extraContext)

  const transcript = messages
    .slice(-4)
    .map((message, index) => `${index + 1}. ${message.role === 'user' ? '用户' : '灵化角色'}：${message.text}`)
    .join('\n')

  return [
    `识别对象：${name}（${scientificName}）`,
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
    `生图任务：${safeText(generation.status) || 'unknown'}，耗时 ${durationText}`,
    safeText(generation.imageUrl) ? `生图结果：${safeText(generation.imageUrl)}` : '生图结果：未生成图片链接',
    transcript ? `对话摘录：\n${transcript}` : '对话摘录：暂无',
    extra ? `补充说明：${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildSpiritCommunityDraft(session, input = {}) {
  const title = buildDraftTitle(session, input.title)
  const content = buildDraftContent(session, input.extraContext)
  const topics = buildDraftTopics(session, input.topics)
  const mentions = buildDraftMentions(input.mentions)
  const image =
    safeText(input.image) || safeText(session?.generation?.imageUrl) || safeText(session?.identify?.cover)

  return {
    title,
    content,
    markdown: content,
    image,
    topics,
    mentions,
  }
}
