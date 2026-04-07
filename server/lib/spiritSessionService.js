import { randomUUID } from 'node:crypto'
import { buildSpiritCommunityDraft } from './spiritDraftBuilder.js'

const sessionTtlMs = 1000 * 60 * 60 * 24 * 7

const clone = (value) => JSON.parse(JSON.stringify(value))
const nowIso = () => new Date().toISOString()
const safeText = (value) => String(value ?? '').trim()

const normalizeKeywords = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => safeText(item))
    .filter(Boolean)
    .slice(0, 16)
}

const normalizeMessages = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
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
        id: safeText(item.id) || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        text,
      }
    })
    .filter(Boolean)
    .slice(0, 80)
}

const normalizeIdentify = (input) => {
  const source = input && typeof input === 'object' ? input : {}

  return {
    taskId: safeText(source.taskId),
    name: safeText(source.name),
    scientificName: safeText(source.scientificName),
    sourceRefs: normalizeKeywords(source.sourceRefs).slice(0, 20),
    keywords: normalizeKeywords(source.keywords),
    summary: safeText(source.summary),
    cover: safeText(source.cover),
    encyclopediaId: safeText(source.encyclopediaId),
    provider: safeText(source.provider),
    model: safeText(source.model),
  }
}

const normalizeGeneration = (input) => {
  const source = input && typeof input === 'object' ? input : {}

  return {
    taskId: safeText(source.taskId),
    status: safeText(source.status),
    imageUrl: safeText(source.imageUrl),
    promptId: safeText(source.promptId),
    prompt: safeText(source.prompt),
    negativePrompt: safeText(source.negativePrompt),
    durationMs: Number.isFinite(Number(source.durationMs)) ? Math.max(0, Number(source.durationMs)) : 0,
    presetId: safeText(source.presetId),
    workflowId: safeText(source.workflowId),
    workflowPath: safeText(source.workflowPath),
    workflowMode: safeText(source.workflowMode),
    workflowFallbackReason: safeText(source.workflowFallbackReason),
    routingRuleId: safeText(source.routingRuleId),
    routingRuleLabel: safeText(source.routingRuleLabel),
    routingMatchedKeywords: normalizeKeywords(source.routingMatchedKeywords).slice(0, 12),
  }
}

const removeExpiredSessions = (sessionStore, draftStore) => {
  const now = Date.now()

  for (const [sessionId, session] of sessionStore.entries()) {
    const updatedAt = Date.parse(session.updatedAt)
    if (Number.isFinite(updatedAt) && now - updatedAt > sessionTtlMs) {
      sessionStore.delete(sessionId)

      for (const [draftId, draft] of draftStore.entries()) {
        if (draft.sessionId === sessionId) {
          draftStore.delete(draftId)
        }
      }
    }
  }
}

export function createSpiritSessionService() {
  const sessions = new Map()
  const drafts = new Map()

  const touchSessionDraftState = (sessionId, touchedAt) => {
    const session = sessions.get(sessionId)
    if (!session) {
      return
    }

    const allDrafts = Array.from(drafts.values()).filter((draft) => draft.sessionId === sessionId)
    const latestDraft = allDrafts.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]

    session.draftCount = allDrafts.length
    session.lastDraftAt = latestDraft?.updatedAt ?? touchedAt ?? ''
    session.updatedAt = touchedAt || nowIso()
  }

  return {
    createSession(payload) {
      removeExpiredSessions(sessions, drafts)

      const id = randomUUID()
      const timestamp = nowIso()
      const identify = normalizeIdentify(payload?.identify)
      const generation = normalizeGeneration(payload?.generation)
      const messages = normalizeMessages(payload?.messages)

      const session = {
        id,
        createdAt: timestamp,
        updatedAt: timestamp,
        identify,
        generation,
        messages,
        draftCount: 0,
        lastDraftAt: '',
      }

      sessions.set(id, session)
      return clone(session)
    },

    getSession(sessionId) {
      removeExpiredSessions(sessions, drafts)
      const session = sessions.get(safeText(sessionId))
      if (!session) {
        return null
      }

      return clone(session)
    },

    listSessions(limit = 20) {
      removeExpiredSessions(sessions, drafts)

      const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20))
      return Array.from(sessions.values())
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, safeLimit)
        .map((session) => clone(session))
    },

    createCommunityDraft(payload) {
      removeExpiredSessions(sessions, drafts)

      const sessionId = safeText(payload?.sessionId)
      const session = sessions.get(sessionId)
      if (!session) {
        return null
      }

      const built = buildSpiritCommunityDraft(session, payload)
      const timestamp = nowIso()
      const draft = {
        id: randomUUID(),
        sessionId: session.id,
        title: built.title,
        content: built.content,
        markdown: built.markdown,
        image: built.image,
        topics: built.topics,
        mentions: built.mentions,
        status: 'draft',
        publishedPostId: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: '',
      }

      drafts.set(draft.id, draft)
      touchSessionDraftState(session.id, timestamp)

      return clone(draft)
    },

    getCommunityDraft(draftId) {
      removeExpiredSessions(sessions, drafts)
      const draft = drafts.get(safeText(draftId))
      if (!draft) {
        return null
      }

      return clone(draft)
    },

    listCommunityDrafts(limit = 50, status = '') {
      removeExpiredSessions(sessions, drafts)

      const normalizedStatus = safeText(status)
      const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50))
      return Array.from(drafts.values())
        .filter((draft) => (normalizedStatus ? draft.status === normalizedStatus : true))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, safeLimit)
        .map((draft) => clone(draft))
    },

    updateCommunityDraft(draftId, payload) {
      removeExpiredSessions(sessions, drafts)

      const normalizedId = safeText(draftId)
      const draft = drafts.get(normalizedId)
      if (!draft) {
        return null
      }

      if (draft.status === 'published') {
        return clone(draft)
      }

      const timestamp = nowIso()
      const nextTitle = safeText(payload?.title)
      const nextContent = safeText(payload?.content)
      const nextMarkdown = safeText(payload?.markdown)
      const nextImage = safeText(payload?.image)
      const nextTopics = Array.isArray(payload?.topics)
        ? payload.topics.map((item) => safeText(item)).filter(Boolean).slice(0, 8)
        : []
      const nextMentions = Array.isArray(payload?.mentions)
        ? payload.mentions.map((item) => safeText(item)).filter(Boolean).slice(0, 8)
        : []

      draft.title = nextTitle || draft.title
      draft.content = nextContent || draft.content
      draft.markdown = nextMarkdown || draft.markdown
      draft.image = nextImage || draft.image
      draft.topics = nextTopics.length > 0 ? nextTopics : draft.topics
      draft.mentions = nextMentions.length > 0 ? nextMentions : draft.mentions
      draft.updatedAt = timestamp

      touchSessionDraftState(draft.sessionId, timestamp)
      return clone(draft)
    },

    markCommunityDraftPublished(draftId, postId) {
      removeExpiredSessions(sessions, drafts)

      const normalizedId = safeText(draftId)
      const draft = drafts.get(normalizedId)
      if (!draft) {
        return null
      }

      const timestamp = nowIso()
      draft.status = 'published'
      draft.publishedPostId = safeText(postId)
      draft.publishedAt = timestamp
      draft.updatedAt = timestamp

      touchSessionDraftState(draft.sessionId, timestamp)
      return clone(draft)
    },
  }
}
