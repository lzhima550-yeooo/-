import type { CommunityAnswer, CommunityPost, EncyclopediaItem } from '../types/models'

const asText = (value: unknown, fallback = '') => {
  const normalized = String(value ?? fallback).trim()
  return normalized || fallback
}

const asStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => asText(item))
    .filter(Boolean)
}

const asRisk = (value: unknown): EncyclopediaItem['risk'] => {
  if (value === '高' || value === '中' || value === '低') {
    return value
  }
  return '中'
}

const normalizeImageUrl = (value: unknown, fallback = '/images/community-post-fallback.svg') => {
  const raw = asText(value, fallback)
  if (!raw || raw.startsWith('/')) {
    return raw || fallback
  }

  if (typeof window === 'undefined') {
    return raw
  }

  try {
    const target = new URL(raw)
    const currentHost = window.location.hostname
    const isLocalHost = target.hostname === 'localhost' || target.hostname === '127.0.0.1'

    if (currentHost && isLocalHost && target.hostname !== currentHost) {
      target.hostname = currentHost
    }

    return target.toString()
  } catch {
    return raw
  }
}
export const normalizeEncyclopediaRecord = (source: unknown, index = 0): EncyclopediaItem | null => {
  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>
  const name = asText(record.name)
  if (!name) {
    return null
  }

  const type = record.type === 'disease' ? 'disease' : 'insect'

  return {
    id: asText(record.id, `remote-${index + 1}`),
    type,
    name,
    scientificName: asText(record.scientificName ?? record.scientific_name),
    genus: asText(record.genus),
    categoryCode: asText(record.categoryCode ?? record.category_code, 'unknown'),
    category: asText(record.category, '未分类'),
    risk: asRisk(record.risk),
    season: asText(record.season, '全年'),
    host: asText(record.host, '待补充'),
    summary: asText(record.summary),
    morphology: asText(record.morphology),
    symptoms: asText(record.symptoms),
    image: normalizeImageUrl(record.image, '/images/community-post-fallback.svg'),
    controlTips: asStringList(record.controlTips ?? record.control_tips),
    placementTips: asStringList(record.placementTips ?? record.placement_tips),
    references: asStringList(record.references),
  }
}

const normalizeCommunityAnswer = (source: unknown, index = 0): CommunityAnswer | null => {
  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>
  const content = asText(record.content)
  if (!content) {
    return null
  }

  return {
    id: asText(record.id, `ans-${Date.now()}-${index + 1}`),
    author: asText(record.author, '匿名用户'),
    content,
    createdAt: asText(record.createdAt ?? record.created_at, '刚刚'),
    floor: Number(record.floor ?? index + 2),
    role: record.role === 'followup' ? 'followup' : 'answer',
    image: normalizeImageUrl(record.image, ''),
    replyToFloor: Number(record.replyToFloor ?? record.reply_to_floor) || undefined,
  }
}

export const normalizeCommunityPost = (source: unknown, index = 0): CommunityPost | null => {
  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>
  const title = asText(record.title)
  const content = asText(record.content)

  if (!title || !content) {
    return null
  }

  const rawAnswers = Array.isArray(record.answers) ? record.answers : []
  const answers = rawAnswers
    .map((entry, answerIndex) => normalizeCommunityAnswer(entry, answerIndex))
    .filter((answer): answer is CommunityAnswer => Boolean(answer))

  return {
    id: asText(record.id, `post-${index + 1}`),
    title,
    content,
    image: normalizeImageUrl(record.image, ''),
    status: record.status === 'solved' ? 'solved' : 'open',
    author: asText(record.author, '匿名用户'),
    ownerAccount: asText(record.ownerAccount ?? record.owner_account) || undefined,
    createdAt: asText(record.createdAt ?? record.created_at, '刚刚'),
    likes: Number(record.likes ?? 0),
    answers,
  }
}
