const riskMap = {
  high: '高',
  medium: '中',
  low: '低',
}

const safeText = (value, fallback = '') => {
  const output = String(value ?? fallback).trim()
  return output || fallback
}

const list = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item) => safeText(item)).filter(Boolean)
}

export const mapEncyclopediaRecord = (row) => {
  return {
    id: safeText(row.id),
    type: row.type === 'disease' ? 'disease' : 'insect',
    name: safeText(row.name),
    scientific_name: safeText(row.scientific_name),
    genus: safeText(row.genus),
    category_code: safeText(row.category_code),
    category: safeText(row.category_name),
    risk: riskMap[safeText(row.risk_level, 'medium')] ?? '中',
    season: safeText(row.season),
    host: safeText(row.host_range),
    summary: safeText(row.summary),
    morphology: safeText(row.morphology),
    symptoms: safeText(row.symptoms),
    image: safeText(row.image_url, '/images/community-post-fallback.svg'),
    control_tips: list(row.control_tips),
    placement_tips: list(row.placement_tips),
    references: list(row.references),
  }
}

const formatTimestamp = (value) => {
  if (!value) {
    return '刚刚'
  }

  const time = new Date(value)
  if (Number.isNaN(time.valueOf())) {
    return '刚刚'
  }

  return time.toLocaleString('zh-CN', {
    hour12: false,
  })
}

export const mapCommunityAnswer = (row) => {
  return {
    id: safeText(row.id),
    author: safeText(row.author_name, '匿名用户'),
    content: safeText(row.content),
    markdown: safeText(row.markdown),
    created_at: formatTimestamp(row.created_at),
    floor: Number(row.floor) || undefined,
    role: row.role === 'followup' ? 'followup' : 'answer',
    image: safeText(row.image_url),
    reply_to_floor: Number(row.reply_to_floor) || undefined,
    annotations: Array.isArray(row.annotations) ? row.annotations : [],
  }
}

export const mapCommunityPost = (row, answers) => {
  return {
    id: safeText(row.id),
    title: safeText(row.title),
    content: safeText(row.content),
    markdown: safeText(row.markdown),
    image: safeText(row.image_url),
    status: row.status === 'solved' ? 'solved' : 'open',
    author: safeText(row.author_name, '匿名用户'),
    owner_account: safeText(row.owner_account),
    created_at: formatTimestamp(row.created_at),
    likes: Number(row.likes) || 0,
    mentions: list(row.mentions),
    topics: list(row.topics),
    answers,
  }
}
