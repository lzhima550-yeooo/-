import { ApiError } from './errors.js'

const toText = (value) => String(value ?? '').trim()

const asRecord = (value) => (value && typeof value === 'object' ? value : {})

const toStringList = (value, max = 16) => {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set()
  const output = []

  value.forEach((item) => {
    const text = toText(item)
    if (!text || seen.has(text)) {
      return
    }

    seen.add(text)
    output.push(text)
  })

  return output.slice(0, max)
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const splitSentences = (text) =>
  toText(text)
    .split(/[\n。；;！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean)

const actionPattern = /(隔离|剪除|清除|清理|喷施|施药|处理|移除|拔除)/i
const environmentPattern = /(通风|湿度|温度|密度|光照|摆放|排水|环境|降湿)/i
const followUpPattern = /(复查|监测|观察|记录|回访|追踪|48|24|72|每周|天后)/i
const cautionPattern = /(避免|谨慎|禁用|过量|混配|间隔|防护|注意)/i

const pickBestAnswer = (post) => {
  const answers = Array.isArray(post?.answers) ? post.answers : []
  if (answers.length === 0) {
    return null
  }

  return [...answers].sort((left, right) => {
    const leftText = toText(left?.content || left?.markdown)
    const rightText = toText(right?.content || right?.markdown)
    const lengthDiff = rightText.length - leftText.length
    if (lengthDiff !== 0) {
      return lengthDiff
    }

    return Number(left?.floor ?? 0) - Number(right?.floor ?? 0)
  })[0]
}

const deriveEntryHint = (post, answer) => {
  const postRecord = asRecord(post)
  const answerRecord = asRecord(answer)

  const direct = toText(postRecord.entryId || postRecord.entry_id)
  if (/^enc-[a-z0-9-]+$/i.test(direct)) {
    return direct
  }

  const topicHint = toStringList(postRecord.topics, 24).find((topic) => /^enc-[a-z0-9-]+$/i.test(topic))
  if (topicHint) {
    return topicHint
  }

  const mentionHint = toStringList(postRecord.mentions, 24).find((item) => /^enc-[a-z0-9-]+$/i.test(item))
  if (mentionHint) {
    return mentionHint
  }

  const answerText = `${toText(answerRecord.content)} ${toText(answerRecord.markdown)}`
  const matched = answerText.match(/\b(enc-[a-z0-9-]+)\b/i)
  return matched ? matched[1] : ''
}

const calcQualityScore = (post, answer) => {
  const likes = Number(post?.likes) || 0
  const answerText = toText(answer?.content || answer?.markdown)
  const title = toText(post?.title)
  const solvedBonus = toText(post?.status) === 'solved' ? 25 : 0
  const likeScore = clamp(likes * 5, 0, 35)
  const answerLengthScore = clamp(Math.floor(answerText.length / 18), 0, 25)
  const titleScore = clamp(Math.floor(title.length / 6), 0, 8)
  const actionScore = actionPattern.test(answerText) ? 7 : 0
  const environmentScore = environmentPattern.test(answerText) ? 5 : 0

  return clamp(solvedBonus + likeScore + answerLengthScore + titleScore + actionScore + environmentScore, 0, 100)
}

const extractTreatmentTemplate = (text) => {
  const items = splitSentences(text)
  const immediateActions = []
  const environmentAdjustments = []
  const followUpSchedule = []
  const cautionNotes = []

  items.forEach((item) => {
    if (immediateActions.length < 4 && actionPattern.test(item)) {
      immediateActions.push(item)
      return
    }
    if (environmentAdjustments.length < 4 && environmentPattern.test(item)) {
      environmentAdjustments.push(item)
      return
    }
    if (followUpSchedule.length < 4 && followUpPattern.test(item)) {
      followUpSchedule.push(item)
      return
    }
    if (cautionNotes.length < 4 && cautionPattern.test(item)) {
      cautionNotes.push(item)
    }
  })

  return {
    immediateActions: toStringList(immediateActions, 4),
    environmentAdjustments: toStringList(environmentAdjustments, 4),
    followUpSchedule: toStringList(followUpSchedule, 4),
    cautionNotes: toStringList(cautionNotes, 4),
  }
}

const buildSourceIndexCandidate = (post, answer, qualityScore, entryHint) => {
  const postId = toText(post?.id)
  const answerId = toText(answer?.id)
  const title = toText(post?.title) || '社区经验候选'
  const answerText = toText(answer?.content || answer?.markdown)
  const snippet = answerText.slice(0, 220)
  const confidenceScore = clamp(Math.round(45 + qualityScore * 0.5), 45, 95)

  return {
    candidateType: 'source_index',
    sourcePostId: postId,
    sourceAnswerId: answerId,
    title: `${title}（社区经验）`,
    snippet,
    entryHint,
    qualityScore,
    proposedPayload: {
      sourceIndex: {
        sourceType: 'community',
        sourceTitle: title,
        sourceUrl: `/community/${postId}`,
        snippet,
        confidenceScore,
      },
    },
  }
}

const buildTreatmentTemplateCandidate = (post, answer, qualityScore, entryHint) => {
  const template = extractTreatmentTemplate(toText(answer?.content || answer?.markdown))
  const actionCount =
    template.immediateActions.length +
    template.environmentAdjustments.length +
    template.followUpSchedule.length +
    template.cautionNotes.length
  if (actionCount === 0) {
    return null
  }

  const title = toText(post?.title) || '治理模板候选'
  const snippet = toText(answer?.content || answer?.markdown).slice(0, 220)

  return {
    candidateType: 'treatment_template',
    sourcePostId: toText(post?.id),
    sourceAnswerId: toText(answer?.id),
    title: `${title}（治理模板）`,
    snippet,
    entryHint,
    qualityScore,
    proposedPayload: {
      treatmentTemplate: template,
    },
  }
}

export const buildKnowledgeBackflowCandidates = ({ posts = [], minQualityScore = 60, limit = 20 } = {}) => {
  const normalizedLimit = clamp(Number(limit) || 20, 1, 100)
  const normalizedMinScore = clamp(Number(minQualityScore) || 60, 0, 100)
  const candidates = []

  posts.forEach((post) => {
    if (toText(post?.status) !== 'solved') {
      return
    }

    const answer = pickBestAnswer(post)
    if (!answer) {
      return
    }

    const qualityScore = calcQualityScore(post, answer)
    if (qualityScore < normalizedMinScore) {
      return
    }

    const entryHint = deriveEntryHint(post, answer)
    candidates.push(buildSourceIndexCandidate(post, answer, qualityScore, entryHint))

    const templateCandidate = buildTreatmentTemplateCandidate(post, answer, qualityScore, entryHint)
    if (templateCandidate) {
      candidates.push(templateCandidate)
    }
  })

  return candidates.sort((left, right) => right.qualityScore - left.qualityScore).slice(0, normalizedLimit)
}

export const createKnowledgeBackflowService = ({ dataService } = {}) => {
  return {
    async generateCandidates(input = {}) {
      if (dataService && typeof dataService.generateKnowledgeBackflowCandidates === 'function') {
        return dataService.generateKnowledgeBackflowCandidates(input)
      }

      if (dataService && typeof dataService.listCommunityPosts === 'function') {
        const posts = await dataService.listCommunityPosts('')
        return buildKnowledgeBackflowCandidates({
          posts,
          minQualityScore: Number(input?.minQualityScore) || 60,
          limit: Number(input?.limit) || 20,
        })
      }

      throw new ApiError(501, 'knowledge backflow generate is not implemented')
    },

    async listCandidates(input = {}) {
      if (dataService && typeof dataService.listKnowledgeBackflowCandidates === 'function') {
        return dataService.listKnowledgeBackflowCandidates(input)
      }

      return []
    },

    async approveCandidate(candidateId, input = {}) {
      if (dataService && typeof dataService.approveKnowledgeBackflowCandidate === 'function') {
        return dataService.approveKnowledgeBackflowCandidate(candidateId, input)
      }

      throw new ApiError(501, 'knowledge backflow approve is not implemented')
    },

    async rejectCandidate(candidateId, input = {}) {
      if (dataService && typeof dataService.rejectKnowledgeBackflowCandidate === 'function') {
        return dataService.rejectKnowledgeBackflowCandidate(candidateId, input)
      }

      throw new ApiError(501, 'knowledge backflow reject is not implemented')
    },

    async rollbackCandidate(candidateId, input = {}) {
      if (dataService && typeof dataService.rollbackKnowledgeBackflowCandidate === 'function') {
        return dataService.rollbackKnowledgeBackflowCandidate(candidateId, input)
      }

      throw new ApiError(501, 'knowledge backflow rollback is not implemented')
    },

    async listReviews(input = {}) {
      if (dataService && typeof dataService.listKnowledgeBackflowReviews === 'function') {
        return dataService.listKnowledgeBackflowReviews(input)
      }

      return []
    },
  }
}
