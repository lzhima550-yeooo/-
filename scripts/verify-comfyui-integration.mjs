import { createServer } from 'node:http'
import { createApp } from '../server/app.js'

const baseService = {
  checkHealth: async () => ({ ok: true, provider: 'verify' }),
  listEncyclopedia: async () => [],
  listCommunityPosts: async () => [],
  createCommunityPost: async () => ({ id: 'verify-post' }),
  createCommunityReply: async () => ({ id: 'verify-reply' }),
}

const readJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

const ensure = (condition, message, details = '') => {
  if (!condition) {
    const detailText = String(details || '').trim()
    throw new Error(detailText ? `${message} | ${detailText}` : message)
  }
}

const resolveImageUrl = (apiBaseUrl, imageUrl) => {
  const raw = String(imageUrl ?? '').trim()
  if (!raw) {
    return ''
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw
  }

  const base = String(apiBaseUrl ?? '').replace(/\/+$/, '')
  if (!base) {
    return raw
  }

  return `${base}${raw.startsWith('/') ? '' : '/'}${raw}`
}

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const pollTask = async (baseUrl, taskId) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/spirit/generate/tasks/${encodeURIComponent(taskId)}`)
    const body = await readJson(response)

    ensure(response.status === 200, 'task detail endpoint returned non-200', response.status)

    const task = body?.data ?? {}
    const status = String(task.status ?? '').trim()

    if (status === 'succeeded' || status === 'failed') {
      return task
    }

    await sleep(1200)
  }

  throw new Error('task polling timeout')
}

const run = async () => {
  const app = createApp(baseService)
  const server = createServer(app)

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('verify server failed to bind random port')
  }

  const baseUrl = `http://127.0.0.1:${address.port}`
  const startedAt = Date.now()

  try {
    const runtimeResponse = await fetch(`${baseUrl}/api/spirit/runtime`)
    const runtimeBody = await readJson(runtimeResponse)
    const runtime = runtimeBody?.data ?? {}

    ensure(runtimeResponse.status === 200, 'runtime endpoint returned non-200', runtimeResponse.status)
    ensure(Boolean(runtime.comfyuiOnline), 'comfyui is offline', runtime.workflowReason)
    ensure(Number(runtime.checkpointCount ?? 0) > 0, 'checkpoint list is empty', runtime.workflowReason)

    const configResponse = await fetch(`${baseUrl}/api/spirit/config`)
    const configBody = await readJson(configResponse)
    const config = configBody?.data ?? {}
    const presets = Array.isArray(config.presets) ? config.presets : []
    const workflows = Array.isArray(config.workflows) ? config.workflows : []
    const defaultPresetId = String(config.defaultPresetId ?? '').trim() || String(presets[0]?.id ?? '').trim()
    const defaultWorkflowId = String(config.defaultWorkflowId ?? '').trim() || String(workflows[0]?.id ?? '').trim()

    ensure(configResponse.status === 200, 'config endpoint returned non-200', configResponse.status)
    ensure(Boolean(defaultPresetId), 'spirit config does not have default preset id')
    ensure(Boolean(defaultWorkflowId), 'spirit config does not have default workflow id')

    const taskPayload = {
      name: 'Ladybug',
      scientificName: 'Coccinella septempunctata',
      keywords: ['ladybug', 'beneficial insect', 'campus plant health'],
      presetId: defaultPresetId,
      workflowId: defaultWorkflowId,
      prompt: 'campus guardian, anime illustration, portrait, clean and bright',
    }

    const createTaskResponse = await fetch(`${baseUrl}/api/spirit/generate/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskPayload),
    })

    const createTaskBody = await readJson(createTaskResponse)
    const createdTask = createTaskBody?.data ?? {}
    const taskId = String(createdTask.id ?? '').trim()

    ensure(createTaskResponse.status === 202, 'create task endpoint returned non-202', createTaskResponse.status)
    ensure(Boolean(taskId), 'create task endpoint did not return task id', JSON.stringify(createTaskBody))

    const finishedTask = await pollTask(baseUrl, taskId)
    const finalStatus = String(finishedTask.status ?? '').trim()

    ensure(finalStatus === 'succeeded', 'task did not finish with succeeded', finalStatus)

    const generation = finishedTask.result ?? {}
    const imageUrl = String(generation.imageUrl ?? '').trim()
    const imageFetchUrl = resolveImageUrl(baseUrl, imageUrl)

    ensure(Boolean(imageUrl), 'finished task did not return imageUrl', JSON.stringify(finishedTask))
    ensure(Boolean(imageFetchUrl), 'finished task returned invalid imageUrl', JSON.stringify(finishedTask))

    const imageResponse = await fetch(imageFetchUrl)
    const imageBytes = (await imageResponse.arrayBuffer()).byteLength

    ensure(imageResponse.status === 200, 'generated image url returned non-200', imageResponse.status)
    ensure(imageBytes > 0, 'generated image payload is empty')

    const elapsedMs = Date.now() - startedAt

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          pass: true,
          elapsedMs,
          runtime: {
            ready: Boolean(runtime.ready),
            comfyuiOnline: Boolean(runtime.comfyuiOnline),
            checkpointCount: Number(runtime.checkpointCount ?? 0),
            weilinAvailable: Boolean(runtime.weilinAvailable),
            workflowModeCandidate: String(runtime.workflowModeCandidate ?? ''),
            workflowReason: String(runtime.workflowReason ?? ''),
          },
          config: {
            defaultPresetId,
            defaultWorkflowId,
            presetCount: presets.length,
            workflowCount: workflows.length,
          },
          task: {
            id: taskId,
            status: finalStatus,
            workflowMode: String(generation.workflowMode ?? ''),
            workflowFallbackReason: String(generation.workflowFallbackReason ?? ''),
          },
          generation: {
            imageUrl,
            imageFetchUrl,
            imageStatus: imageResponse.status,
            imageBytes,
          },
        },
        null,
        2,
      ),
    )
  } finally {
    await new Promise((resolve) => server.close(() => resolve()))
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[verify:comfyui] FAIL', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
