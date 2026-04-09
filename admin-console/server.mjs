import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT_DIR = normalize(dirname(__filename))

const HOST = process.env.ADMIN_HOST || '127.0.0.1'
const PORT = Number(process.env.ADMIN_PORT || 6060)
const API_TARGET = (process.env.ADMIN_API_TARGET || 'http://127.0.0.1:8787').replace(/\/+$/, '')

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

const readRequestBody = async (request) =>
  new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })

const writeBufferResponse = (response, status, headers, buffer) => {
  response.writeHead(status, headers)
  response.end(buffer)
}

const sendJson = (response, status, payload) => {
  writeBufferResponse(response, status, { 'content-type': 'application/json; charset=utf-8' }, Buffer.from(JSON.stringify(payload)))
}

const proxyApi = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`)
  const upstreamUrl = `${API_TARGET}${url.pathname}${url.search}`

  try {
    const body =
      request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS' ? undefined : await readRequestBody(request)

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: Object.fromEntries(
        Object.entries(request.headers).filter(([name]) => !['host', 'content-length', 'connection'].includes(name.toLowerCase())),
      ),
      body,
    })

    const headers = Object.fromEntries(upstreamResponse.headers.entries())
    delete headers['content-encoding']
    const data = Buffer.from(await upstreamResponse.arrayBuffer())
    writeBufferResponse(response, upstreamResponse.status, headers, data)
  } catch (error) {
    sendJson(response, 502, {
      error: 'Admin API proxy failed',
      detail: error instanceof Error ? error.message : String(error),
      target: API_TARGET,
    })
  }
}

const getSafeFilePath = (pathname) => {
  const requestPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const resolved = normalize(join(ROOT_DIR, requestPath))
  if (!resolved.startsWith(ROOT_DIR)) {
    return null
  }
  return resolved
}

const serveStatic = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${HOST}:${PORT}`}`)
  const filePath = getSafeFilePath(url.pathname)

  if (!filePath) {
    sendJson(response, 403, { error: 'Forbidden path' })
    return
  }

  try {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }

    const ext = extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    response.writeHead(200, { 'content-type': contentType })
    createReadStream(filePath).pipe(response)
  } catch {
    sendJson(response, 404, { error: 'Not Found' })
  }
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: 'Missing request URL' })
    return
  }

  if (request.url.startsWith('/api/')) {
    await proxyApi(request, response)
    return
  }

  await serveStatic(request, response)
})

server.listen(PORT, HOST, () => {
  console.log(`[admin-console] ready on http://${HOST}:${PORT}`)
  console.log(`[admin-console] api proxy target: ${API_TARGET}`)
})
