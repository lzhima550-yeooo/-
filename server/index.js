import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { createApp } from './app.js'
import { createSupabaseService } from './lib/supabaseService.js'

const loadDotEnv = () => {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return
  }

  const text = readFileSync(envPath, 'utf8')
  text
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

      if (!key || process.env[key] !== undefined) {
        return
      }

      process.env[key] = value
    })
}

loadDotEnv()

const port = Number(process.env.API_PORT ?? 8787)
const host = process.env.API_HOST ?? '0.0.0.0'

const service = createSupabaseService()
const app = createApp(service)
const server = createServer(app)

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[summer-wood-api] listening on http://${host}:${port}`)
})