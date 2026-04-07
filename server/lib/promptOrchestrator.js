import { ApiError } from './errors.js'

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

const asRecord = (value) => (value && typeof value === 'object' ? value : {})

const mapHistoryMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return []
  }

  return messages
    .map((item) => {
      const record = asRecord(item)
      const content = toText(record.text ?? record.content)
      if (!content) {
        return null
      }

      return {
        role: record.role === 'spirit' || record.role === 'assistant' ? 'assistant' : 'user',
        content,
      }
    })
    .filter(Boolean)
    .slice(-12)
}

const buildRolePackSection = (rolePack) => {
  const source = asRecord(rolePack)
  const lines = [
    `id：${toText(source.id) || '未设置'}`,
    `名称：${toText(source.name) || '灵化助手'}`,
    `风格：${toText(source.style) || toText(source.tone) || '简洁、可执行'}`,
    `人设：${toText(source.persona) || toText(source.summary) || '校园植保陪伴助手'}`,
  ]

  const guardrails = toStringList(source.guardrails ?? source.rules ?? source.constraints, 12)
  if (guardrails.length > 0) {
    lines.push(`约束：${guardrails.join('；')}`)
  }

  return ['角色包', ...lines].join('\n')
}

const buildRoleIdentityContractSection = () =>
  [
    'Role Identity Contract',
    'You are the currently generated spirit persona itself, not a generic customer-service bot.',
    'Keep tone and language aligned with the persona design and current diagnosis context.',
    'Respond as in-character dialogue first, then provide practical plant-protection advice.',
    'If uncertainty is high, stay in character while clearly suggesting re-check actions.',
  ].join('\n')

const buildPersonaDesignSection = (personaDesign) => {
  const source = asRecord(personaDesign)
  const lines = [
    `coreConcept: ${toText(source.coreConcept ?? source.core_concept) || 'N/A'}`,
    `designDirection: ${toText(source.designDirection ?? source.design_direction) || 'N/A'}`,
    `colorPalette: ${toStringList(source.colorPalette ?? source.color_palette, 16).join(', ') || 'N/A'}`,
    `silhouette: ${toStringList(source.silhouette, 16).join(', ') || 'N/A'}`,
    `hairDesign: ${toStringList(source.hairDesign ?? source.hair_design, 16).join(', ') || 'N/A'}`,
    `outfitElements: ${toStringList(source.outfitElements ?? source.outfit_elements, 20).join(', ') || 'N/A'}`,
    `accessoryElements: ${toStringList(source.accessoryElements ?? source.accessory_elements, 16).join(', ') || 'N/A'}`,
    `textureMaterials: ${toStringList(source.textureMaterials ?? source.texture_materials, 16).join(', ') || 'N/A'}`,
    `symbolicMotifs: ${toStringList(source.symbolicMotifs ?? source.symbolic_motifs, 20).join(', ') || 'N/A'}`,
    `temperament: ${toStringList(source.temperament, 12).join(', ') || 'N/A'}`,
    `pose: ${toStringList(source.pose, 12).join(', ') || 'N/A'}`,
    `forbiddenElements: ${toStringList(source.forbiddenElements ?? source.forbidden_elements, 20).join(', ') || 'N/A'}`,
  ]

  return ['Persona Design', ...lines].join('\n')
}

const buildDiagnosisSection = (diagnosisContext) => {
  const source = asRecord(diagnosisContext)
  const lines = [
    `对象：${toText(source.identifyName ?? source.name) || '暂无'}`,
    `学名：${toText(source.scientificName) || '暂无'}`,
    `风险：${toText(source.riskLevel ?? source.risk) || 'unknown'}`,
    `摘要：${toText(source.summary) || '暂无'}`,
  ]

  const actionCards = toStringList(source.actionCards, 12)
  if (actionCards.length > 0) {
    lines.push(`行动卡：${actionCards.join('；')}`)
  }

  return ['诊断上下文', ...lines].join('\n')
}

const buildRetrievalSection = (retrievalContext) => {
  const source = asRecord(retrievalContext)
  const sourceIndex = Array.isArray(source.sourceIndex)
    ? source.sourceIndex
        .map((item) => {
          const record = asRecord(item)
          const title = toText(record.title)
          if (!title) {
            return ''
          }
          const snippet = toText(record.snippet)
          const confidence = toText(record.confidenceLabel ?? record.confidence)
          return `${title}${confidence ? `（可信度${confidence}）` : ''}${snippet ? `：${snippet}` : ''}`
        })
        .filter(Boolean)
        .slice(0, 4)
    : []

  const template = asRecord(source.treatmentTemplate)
  const immediateActions = toStringList(template.immediateActions, 8)
  const environmentAdjustments = toStringList(template.environmentAdjustments, 8)
  const followUpSchedule = toStringList(template.followUpSchedule, 8)

  const lines = [
    `来源索引：${sourceIndex.length > 0 ? sourceIndex.join('；') : '暂无'}`,
    `立即处理：${immediateActions.join('；') || '暂无'}`,
    `环境调整：${environmentAdjustments.join('；') || '暂无'}`,
    `复查节奏：${followUpSchedule.join('；') || '暂无'}`,
  ]

  return ['检索上下文', ...lines].join('\n')
}

const buildMemorySection = (memoryContext) => {
  const source = asRecord(memoryContext)
  const sessionSummary = toText(source.sessionSummary ?? source.summary)
  const longTermFacts = toStringList(source.longTermFacts ?? source.facts, 12)
  const userPreferences = toStringList(source.userPreferences ?? source.preferences, 8)

  const lines = [
    `会话摘要：${sessionSummary || '暂无'}`,
    `长期事实：${longTermFacts.join('；') || '暂无'}`,
    `用户偏好：${userPreferences.join('；') || '暂无'}`,
  ]

  return ['记忆上下文', ...lines].join('\n')
}

const deriveLegacyRolePack = (payload) => {
  const spirit = asRecord(payload?.spirit)
  const keywords = toStringList(spirit.keywords, 10)

  return {
    name: toText(spirit.name) || '灵化助手',
    style: '简洁、可执行',
    persona: [
      `学名：${toText(spirit.scientificName) || '未知'}`,
      `类型：${toText(spirit.typeLabel) || '未知'}`,
      `关键词：${keywords.join(' / ') || '暂无'}`,
      `摘要：${toText(spirit.summary) || '暂无'}`,
    ].join('；'),
  }
}

const deriveLegacyDiagnosis = (payload) => {
  const identify = asRecord(payload?.identify)
  const keywords = toStringList(identify.keywords, 10)

  return {
    identifyName: toText(identify.name),
    scientificName: toText(identify.scientificName),
    riskLevel: toText(payload?.riskLevel),
    summary: toText(identify.summary),
    actionCards: keywords,
  }
}

const buildSystemContext = (input, defaultSystemPolicy) => {
  const source = asRecord(input?.orchestration)
  const policyText = toText(source.systemPolicy) || toText(defaultSystemPolicy)
  const rolePack = Object.keys(asRecord(source.rolePack)).length > 0 ? source.rolePack : deriveLegacyRolePack(input)
  const personaDesign = asRecord(source.personaDesign)
  const diagnosisContext =
    Object.keys(asRecord(source.diagnosisContext)).length > 0 ? source.diagnosisContext : deriveLegacyDiagnosis(input)
  const retrievalContext = source.retrievalContext
  const memoryContext = source.memoryContext
  const intentText = toText(source.currentIntent) || toText(input?.question)

  const sections = [`系统策略\n${policyText || '你是校园植保助手，请输出可执行建议。'}`]
  sections.push(buildRoleIdentityContractSection())
  sections.push(buildRolePackSection(rolePack))
  if (Object.keys(personaDesign).length > 0) {
    sections.push(buildPersonaDesignSection(personaDesign))
  }
  sections.push(buildDiagnosisSection(diagnosisContext))
  sections.push(buildRetrievalSection(retrievalContext))
  sections.push(buildMemorySection(memoryContext))
  sections.push(`当前意图\n${intentText || '回答用户当前问题并给出下一步行动。'}`)

  return sections.join('\n\n')
}

export const createPromptOrchestrator = (options = {}) => {
  const defaultSystemPolicy =
    toText(options.defaultSystemPolicy) || '你是四季夏木校园植保助手，请提供可执行、可复查的建议。'

  return {
    resolveChatMessages(payload = {}) {
      const question = toText(payload?.question)
      if (!question) {
        throw new ApiError(400, 'question is required')
      }

      const history = mapHistoryMessages(payload?.messages)
      const systemContext = buildSystemContext(payload, defaultSystemPolicy)

      return [
        {
          role: 'system',
          content: systemContext,
        },
        ...history,
        {
          role: 'user',
          content: question,
        },
      ]
    },
  }
}
