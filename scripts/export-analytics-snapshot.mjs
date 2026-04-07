import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const toText = (value) => String(value ?? '').trim()

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) {
      continue
    }

    const [keyText, valueFromPair] = token.split('=')
    const key = keyText.replace(/^--/, '').trim()
    const value = valueFromPair === undefined ? toText(args[index + 1]) : toText(valueFromPair)
    if (!key) {
      continue
    }

    if (valueFromPair === undefined && args[index + 1] && !args[index + 1].startsWith('--')) {
      index += 1
    }

    out[key] = value || 'true'
  }

  return out
}

const loadDotEnv = () => {
  const envPath = resolve(process.cwd(), '.env')
  const out = {}
  if (!existsSync(envPath)) {
    return out
  }

  const raw = readFileSync(envPath, 'utf8')
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const index = line.indexOf('=')
      if (index <= 0) {
        return
      }

      const key = line.slice(0, index).trim()
      const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!key || value === '') {
        return
      }

      out[key] = value
    })

  return out
}

const parseJsonSafe = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const ensureParentDir = (filePath) => {
  const parent = dirname(filePath)
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true })
  }
}

const run = async () => {
  const args = parseArgs()
  const envFile = loadDotEnv()

  const apiHost = toText(args.host || process.env.API_HOST || envFile.API_HOST) || '127.0.0.1'
  const apiPort = Number(args.port || process.env.API_PORT || envFile.API_PORT || 8787)
  const apiBase =
    toText(args['api-base'] || args.apiBase || process.env.ANALYTICS_API_BASE || envFile.ANALYTICS_API_BASE) ||
    `http://${apiHost}:${apiPort}`
  const days = Math.max(1, Math.min(90, Number(args.days || 7) || 7))
  const limit = Math.max(1, Math.min(5000, Number(args.limit || 2000) || 2000))
  const taskLimit = Math.max(1, Math.min(200, Number(args['task-limit'] || args.taskLimit || 100) || 100))
  const taskOffset = Math.max(0, Number(args['task-offset'] || args.taskOffset || 0) || 0)
  const source = toText(args.source)
  const eventName = toText(args['event-name'] || args.eventName)
  const taskType = toText(args['task-type'] || args.taskType)
  const status = toText(args.status)
  const taskId = toText(args['task-id'] || args.taskId)
  const outputPath = resolve(
    process.cwd(),
    toText(args.out) || 'docs/release/analytics-snapshot-latest.json',
  )

  const searchParams = new URLSearchParams()
  searchParams.set('days', String(days))
  searchParams.set('limit', String(limit))
  searchParams.set('taskLimit', String(taskLimit))
  searchParams.set('taskOffset', String(taskOffset))
  if (source) {
    searchParams.set('source', source)
  }
  if (eventName) {
    searchParams.set('eventName', eventName)
  }
  if (taskType) {
    searchParams.set('taskType', taskType)
  }
  if (status) {
    searchParams.set('status', status)
  }
  if (taskId) {
    searchParams.set('taskId', taskId)
  }

  const endpoint = `${apiBase}/api/analytics/export?${searchParams.toString()}`
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  const raw = await response.text()
  const parsed = parseJsonSafe(raw)
  if (!response.ok) {
    throw new Error(`export request failed: ${response.status} ${raw}`)
  }

  const snapshot = parsed?.data ?? parsed ?? {}
  const artifact = {
    exportedAt: new Date().toISOString(),
    apiBase,
    endpoint,
    snapshot,
  }

  ensureParentDir(outputPath)
  writeFileSync(outputPath, JSON.stringify(artifact, null, 2), 'utf8')

  const eventsTotal = Number(snapshot?.eventsSummary?.total ?? 0) || 0
  const taskLogCount = Array.isArray(snapshot?.taskLogs?.items) ? snapshot.taskLogs.items.length : 0

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        eventsTotal,
        taskLogCount,
      },
      null,
      2,
    ),
  )
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[export:analytics] FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
