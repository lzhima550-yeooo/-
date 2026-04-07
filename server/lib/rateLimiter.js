const now = () => Date.now()

const toInteger = (value, fallback) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.max(1, Math.floor(number))
}

const normalizeClientId = (value) => {
  const text = String(value ?? '').trim()
  return text || 'anonymous'
}

const normalizePath = (value) => String(value ?? '').trim()

export function createRateLimiter({ rules = {} } = {}) {
  const buckets = new Map()

  const getBucketKey = ({ method, path, clientId }) =>
    `${String(method ?? 'GET').toUpperCase()} ${normalizePath(path)} :: ${normalizeClientId(clientId)}`

  const shouldLimit = ({ method, path }) => {
    const key = `${String(method ?? 'GET').toUpperCase()} ${normalizePath(path)}`
    return rules[key] ?? null
  }

  const cleanupExpired = () => {
    const current = now()
    for (const [key, value] of buckets.entries()) {
      if (value.resetAt <= current) {
        buckets.delete(key)
      }
    }
  }

  return {
    check({ method, path, clientId }) {
      cleanupExpired()

      const rule = shouldLimit({ method, path })
      if (!rule) {
        return {
          allowed: true,
          limit: 0,
          remaining: 0,
          retryAfterMs: 0,
          resetAt: 0,
        }
      }

      const limit = toInteger(rule.limit, 30)
      const windowMs = toInteger(rule.windowMs, 60_000)
      const current = now()
      const bucketKey = getBucketKey({ method, path, clientId })
      const currentBucket = buckets.get(bucketKey)

      if (!currentBucket || currentBucket.resetAt <= current) {
        const next = {
          count: 1,
          resetAt: current + windowMs,
        }
        buckets.set(bucketKey, next)
        return {
          allowed: true,
          limit,
          remaining: Math.max(0, limit - next.count),
          retryAfterMs: 0,
          resetAt: next.resetAt,
        }
      }

      if (currentBucket.count >= limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterMs: Math.max(0, currentBucket.resetAt - current),
          resetAt: currentBucket.resetAt,
        }
      }

      currentBucket.count += 1
      buckets.set(bucketKey, currentBucket)
      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - currentBucket.count),
        retryAfterMs: 0,
        resetAt: currentBucket.resetAt,
      }
    },
  }
}

