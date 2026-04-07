import { createInMemoryQueue } from '../lib/queue.js'

// P6 worker entry: reserved for future split-process execution.
// For now it runs a no-op queue loop so deployment scripts can attach health checks.
const queue = createInMemoryQueue({
  worker: async (payload) => payload,
})

const startedAt = new Date().toISOString()

// eslint-disable-next-line no-console
console.log(`[summer-wood-worker] started at ${startedAt}`)

process.on('SIGINT', () => {
  queue.close()
  process.exit(0)
})

process.on('SIGTERM', () => {
  queue.close()
  process.exit(0)
})

