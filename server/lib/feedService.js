const safeText = (value) => String(value ?? '').trim()

const toCount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
}

const toIsoOrEmpty = (value) => {
  const text = safeText(value)
  if (!text) {
    return ''
  }

  const date = new Date(text)
  if (Number.isNaN(date.valueOf())) {
    return text
  }

  return date.toISOString()
}

const mapRiskLabel = (value) => {
  const normalized = safeText(value).toLowerCase()
  if (normalized === 'high' || value === '高') {
    return '高'
  }

  if (normalized === 'medium' || value === '中') {
    return '中'
  }

  return '低'
}

const mapAlert = (item) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const id = safeText(item.id)
  if (!id) {
    return null
  }

  return {
    id,
    name: safeText(item.name),
    risk: mapRiskLabel(item.risk ?? item.riskLevel ?? item.risk_level),
    summary: safeText(item.summary),
    image: safeText(item.image ?? item.imageUrl ?? item.image_url),
    season: safeText(item.season),
  }
}

const mapPick = (item) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const id = safeText(item.id)
  if (!id) {
    return null
  }

  return {
    id,
    title: safeText(item.title),
    author: safeText(item.author ?? item.authorName ?? item.author_name),
    image: safeText(item.image ?? item.imageUrl ?? item.image_url),
    likes: toCount(item.likes),
    status: safeText(item.status) || 'open',
    createdAt: toIsoOrEmpty(item.createdAt ?? item.created_at),
  }
}

const mapReminder = (item) => {
  if (!item || typeof item !== 'object') {
    return null
  }

  const id = safeText(item.id)
  if (!id) {
    return null
  }

  return {
    id,
    type: 'spirit_draft',
    title: safeText(item.title) || '灵化草稿待发布',
    status: safeText(item.status) || 'draft',
    sessionId: safeText(item.sessionId ?? item.session_id),
    updatedAt: toIsoOrEmpty(item.updatedAt ?? item.updated_at),
    publishedPostId: safeText(item.publishedPostId ?? item.published_post_id),
  }
}

const sortByLikesThenTime = (a, b) => {
  const likesA = toCount(a?.likes)
  const likesB = toCount(b?.likes)
  if (likesA !== likesB) {
    return likesB - likesA
  }

  return Date.parse(safeText(b?.createdAt)) - Date.parse(safeText(a?.createdAt))
}

const sortByUpdatedTime = (a, b) => Date.parse(safeText(b?.updatedAt)) - Date.parse(safeText(a?.updatedAt))

export function createFeedService(service) {
  if (!service) {
    throw new Error('service is required')
  }

  return {
    async getHomeFeed() {
      const encyclopediaItems =
        typeof service.listEncyclopedia === 'function' ? await service.listEncyclopedia('') : []
      const communityPosts =
        typeof service.listCommunityPosts === 'function' ? await service.listCommunityPosts('') : []
      const draftItems =
        typeof service.listSpiritCommunityDrafts === 'function'
          ? await service.listSpiritCommunityDrafts({ limit: 20, status: 'draft' })
          : []

      const alerts = Array.isArray(encyclopediaItems)
        ? encyclopediaItems
            .map((item) => mapAlert(item))
            .filter((item) => Boolean(item))
            .sort((a, b) => (a.risk === b.risk ? 0 : a.risk === '高' ? -1 : 1))
            .slice(0, 3)
        : []

      const picks = Array.isArray(communityPosts)
        ? communityPosts
            .map((item) => mapPick(item))
            .filter((item) => Boolean(item))
            .sort(sortByLikesThenTime)
            .slice(0, 4)
        : []

      const reminders = Array.isArray(draftItems)
        ? draftItems
            .map((item) => mapReminder(item))
            .filter((item) => Boolean(item))
            .sort(sortByUpdatedTime)
            .slice(0, 4)
        : []

      return {
        alerts,
        picks,
        reminders,
        generatedAt: new Date().toISOString(),
      }
    },
  }
}

