const safeText = (value) => String(value ?? '').trim()

const toCount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0
}

const isMine = (post, account, profileName) => {
  const ownerAccount = safeText(post?.ownerAccount ?? post?.owner_account)
  const author = safeText(post?.author ?? post?.authorName ?? post?.author_name)

  if (account && ownerAccount === account) {
    return true
  }

  if (profileName && author === profileName) {
    return true
  }

  return false
}

export function createStatsService(service) {
  if (!service) {
    throw new Error('service is required')
  }

  return {
    async getMeStats(input = {}) {
      const account = safeText(input.account)
      const profileName = safeText(input.profileName)
      const favorite = toCount(input.favoriteCount)
      const identify = toCount(input.identifyCount)

      const posts =
        typeof service.listCommunityPosts === 'function' ? await service.listCommunityPosts('') : []

      const safePosts = Array.isArray(posts) ? posts : []

      const publish = safePosts.filter((post) => isMine(post, account, profileName)).length
      const answer = safePosts.reduce((total, post) => {
        const answers = Array.isArray(post?.answers) ? post.answers : []
        const current = answers.filter((reply) => {
          const author = safeText(reply?.author ?? reply?.author_name)
          if (profileName && author === profileName) {
            return true
          }

          return account && author === account
        }).length

        return total + current
      }, 0)

      return {
        publish,
        answer,
        favorite,
        identify,
        eventSummary: [
          { name: 'community_post_publish', count: publish },
          { name: 'community_reply_publish', count: answer },
          { name: 'favorite_toggle', count: favorite },
          { name: 'identify_submit', count: identify },
        ],
        generatedAt: new Date().toISOString(),
      }
    },
  }
}

