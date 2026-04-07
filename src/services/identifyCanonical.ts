import type { CanonicalIdentifySnapshot, RecognitionResult, SpiritProfile, SpiritQuickKey } from '../types/models'
import type { IdentifyTask } from './identifyTaskApi'

const toText = (value: unknown) => String(value ?? '').trim()

const toList = (value: unknown, max = 16) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => toText(item))
    .filter(Boolean)
    .slice(0, max)
}

const clampConfidence = (value: unknown) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  return Math.max(0, Math.min(1, num))
}

const normalizeRisk = (value: unknown): CanonicalIdentifySnapshot['riskLevel'] => {
  const risk = toText(value).toLowerCase()
  if (risk === 'low' || risk === 'high' || risk === 'critical') {
    return risk
  }
  return 'medium'
}

const normalizeTypeLabel = (value: unknown): CanonicalIdentifySnapshot['typeLabel'] => (toText(value) === '病害' ? '病害' : '昆虫')

const dedupe = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const riskLabel = (risk: CanonicalIdentifySnapshot['riskLevel']) => {
  if (risk === 'critical') {
    return '极高'
  }
  if (risk === 'high') {
    return '高'
  }
  if (risk === 'low') {
    return '低'
  }
  return '中'
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export interface SpiritRolePack {
  id: string
  name: string
  style: string
  persona: string
  guardrails: string[]
  visualKeywords: string[]
  negativeKeywords: string[]
  openingLines: string[]
  quickReplies: Record<SpiritQuickKey, string>
}

const insectRolePack: SpiritRolePack = {
  id: 'insect-guardian',
  name: '虫害观察员',
  style: '校园植保侦察',
  persona: '擅长快速定位虫害扩散路径，并把防治方案拆成可执行清单。',
  guardrails: ['先观察后处置', '优先生态手段', '不确定时先复核'],
  visualKeywords: [
    'species-accurate insect anatomy',
    'segmented arthropod limbs',
    'visible antennae',
    'elytra or abdomen silhouette',
    'field notebook',
    'campus greenhouse',
    'warning icon overlays',
  ],
  negativeKeywords: [
    'real photo',
    'watermark',
    'text',
    'multiple heads',
    'extra fingers',
    'generic human hairstyle',
    'plain school uniform',
    'missing antennae',
    'missing segmented arthropod limbs',
    'missing elytra',
  ],
  openingLines: ['我已同步你的识别结果，先从虫口密度和扩散点开始。', '给我两分钟，我把今天的处置顺序排好。'],
  quickReplies: {
    prevention: '优先保护天敌，再做局部隔离与物理清除，最后结合低风险药剂轮换，避免一次性高压处理。',
    habit: '该类虫害通常先在嫩梢和叶背聚集，随后沿连片植株快速扩散。',
    appearance: '重点看刺吸痕、虫体密度和叶背聚集区，这三项最能帮助快速复核。',
  },
}

const diseaseRolePack: SpiritRolePack = {
  id: 'disease-guardian',
  name: '病害诊断员',
  style: '症状追踪治理',
  persona: '擅长根据症状演变和环境因子制定分阶段治理节奏。',
  guardrails: ['先控环境再施药', '记录症状演化', '强调复查节奏'],
  visualKeywords: ['plant pathology motifs', 'lab notebook', 'spore particles', 'humidity indicators'],
  negativeKeywords: ['real photo', 'watermark', 'text', 'distorted anatomy', 'low quality'],
  openingLines: ['我已接管本轮病害诊断，先确定症状分布和湿度条件。', '先稳住环境变量，再安排治理动作，效果更稳定。'],
  quickReplies: {
    prevention: '建议先降低叶面湿度、加强通风和清理病残体，再安排分阶段治理。',
    habit: '病害常随湿度与通风波动加重，连续阴雨或郁闭环境下扩展更快。',
    appearance: '重点观察斑点边缘、叶背霉层和扩展速度，这些是判别关键。',
  },
}

export const resolveSpiritRolePack = (snapshot: CanonicalIdentifySnapshot): SpiritRolePack =>
  snapshot.typeLabel === '病害' ? diseaseRolePack : insectRolePack

export const toCanonicalIdentifySnapshot = (task: IdentifyTask, fallbackCover = ''): CanonicalIdentifySnapshot => {
  const identify = task?.identify ?? {}
  const name = toText(identify.name) || toText(task?.topResult?.name) || '未知对象'
  const confidence = clampConfidence(identify.confidence ?? task?.topResult?.confidence)
  const keywords = toList(identify.keywords, 16)
  const cover = toText(identify.cover) || fallbackCover

  return {
    taskId: toText(task?.id),
    name,
    scientificName: toText(identify.scientificName) || 'Unknown species',
    confidence,
    typeLabel: normalizeTypeLabel(identify.typeLabel),
    keywords: keywords.length > 0 ? keywords : ['待复核'],
    summary: toText(identify.summary) || '暂无稳定识别摘要，建议补充清晰图片后复核。',
    controlTips: toList(identify.controlTips, 6),
    cover,
    spiritPreview: toText(identify.spiritPreview) || cover,
    encyclopediaId: toText(identify.encyclopediaId),
    sourceRefs: toList(task?.sourceRefs, 24),
    riskLevel: normalizeRisk(task?.riskLevel),
    provider: toText(identify.provider),
    model: toText(identify.model),
  }
}

export const toRecognitionResult = (snapshot: CanonicalIdentifySnapshot): RecognitionResult => ({
  id: snapshot.taskId || `identify-${Date.now()}`,
  name: snapshot.name,
  confidence: snapshot.confidence,
  keywords: snapshot.keywords,
  type: snapshot.typeLabel,
  cover: snapshot.cover,
  riskLevel: snapshot.riskLevel,
})

export const buildSpiritGenerationPrompt = (snapshot: CanonicalIdentifySnapshot, rolePack: SpiritRolePack) => {
  const risk = riskLabel(snapshot.riskLevel)
  const parts = dedupe([
    'masterpiece',
    'best quality',
    'anime style',
    'single character portrait',
    'upper body',
    snapshot.typeLabel === '病害' ? 'campus plant protection diagnostician' : 'species-accurate insect guardian',
    snapshot.name,
    snapshot.scientificName,
    ...snapshot.keywords.slice(0, 8),
    `risk level ${risk}`,
    snapshot.typeLabel === '病害' ? 'disease warning motif' : 'insect scouting motif',
    ...rolePack.visualKeywords,
  ])

  return parts.join(', ')
}

export const buildSpiritGenerationNegativePrompt = (
  snapshot: CanonicalIdentifySnapshot,
  rolePack: SpiritRolePack,
  presetNegativePrompt = '',
) => {
  const base = [
    'worst quality',
    'lowres',
    'blurry',
    'text',
    'watermark',
    'logo',
    'deformed anatomy',
    'extra fingers',
    snapshot.typeLabel === '病害'
      ? 'cute insects main subject'
      : 'fungus lesions as main subject, generic human hairstyle, plain school uniform, missing antennae, missing segmented arthropod limbs',
  ]

  const merged = dedupe([...base, ...rolePack.negativeKeywords, ...toText(presetNegativePrompt).split(',').map((item) => toText(item))])
  return merged.join(', ')
}

export const buildSpiritProfileFromSnapshot = (
  snapshot: CanonicalIdentifySnapshot,
  rolePack: SpiritRolePack,
  options?: {
    portraitUrl?: string
    realPhotoUrl?: string
  },
): SpiritProfile => {
  const scientific = toText(snapshot.scientificName) || 'Unknown species'
  const genus = toText(scientific.split(/\s+/)[0]) || 'Unknown'
  const roleIdSeed = toText(snapshot.taskId) || toText(snapshot.name) || 'spirit'
  const roleId = slugify(roleIdSeed) || `spirit-${Date.now()}`
  const expertTags = dedupe([
    snapshot.typeLabel,
    `风险${riskLabel(snapshot.riskLevel)}`,
    ...snapshot.keywords.slice(0, 8),
    `${genus}属`,
  ])

  const openingLines = rolePack.openingLines.length > 0 ? rolePack.openingLines : ['识别结果已同步，我会按标签给出可执行建议。']
  const controlText = snapshot.controlTips.length > 0 ? snapshot.controlTips.join('；') : '暂无治理建议，请先复核图片后再试。'

  return {
    id: roleId,
    name: `${snapshot.name}·夏木`,
    englishName: scientific,
    scientificName: scientific,
    genus,
    keywords: snapshot.keywords,
    expertTags,
    avatar: snapshot.cover || '/images/community-post-fallback.svg',
    image: options?.portraitUrl || snapshot.spiritPreview || snapshot.cover || '/images/community-post-fallback.svg',
    realPhoto: options?.realPhotoUrl || snapshot.cover || '/images/community-post-fallback.svg',
    habits: [snapshot.summary, ...snapshot.controlTips.slice(0, 2)],
    chatLines: [...openingLines, `先执行重点：${controlText}`],
    quickReplies: {
      prevention: rolePack.quickReplies.prevention,
      habit: rolePack.quickReplies.habit,
      appearance: rolePack.quickReplies.appearance,
    },
  }
}
