import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { networkInterfaces } from 'node:os'
import { spawn } from 'node:child_process'

const toText = (value) => String(value ?? '').trim()

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) {
      continue
    }

    const [rawKey, valueFromPair] = token.split('=')
    const key = rawKey.replace(/^--/, '').trim()
    if (!key) {
      continue
    }

    if (valueFromPair !== undefined) {
      out[key] = toText(valueFromPair) || 'true'
      continue
    }

    const next = args[index + 1]
    if (next && !next.startsWith('--')) {
      out[key] = toText(next) || 'true'
      index += 1
      continue
    }

    out[key] = 'true'
  }

  return out
}

const boolFlag = (value) => {
  const raw = toText(value).toLowerCase()
  if (!raw) {
    return false
  }
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

const sleep = (ms) =>
  new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms)
  })

const parseJsonSafe = (text) => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const runCommand = (name, command, commandArgs, options = {}) =>
  new Promise((resolveRun) => {
    const child = spawn(command, commandArgs, {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    if (child.stdout) {
      child.stdout.on('data', (buffer) => {
        const text = String(buffer)
        stdout += text
        if (options.streamOutput) {
          process.stdout.write(`[${name}] ${text}`)
        }
      })
    }

    if (child.stderr) {
      child.stderr.on('data', (buffer) => {
        const text = String(buffer)
        stderr += text
        if (options.streamOutput) {
          process.stderr.write(`[${name}] ${text}`)
        }
      })
    }

    child.on('error', (error) => {
      resolveRun({
        ok: false,
        code: null,
        signal: null,
        stdout,
        stderr: `${stderr}\n${error instanceof Error ? error.message : String(error)}`.trim(),
      })
    })

    child.on('close', (code, signal) => {
      resolveRun({
        ok: code === 0,
        code,
        signal: signal || '',
        stdout,
        stderr,
      })
    })
  })

const runNpmCommand = async (name, npmArgs, options = {}) => {
  if (process.platform === 'win32') {
    const commandText = `npm ${npmArgs.join(' ')}`
    return runCommand(name, 'cmd.exe', ['/d', '/s', '/c', commandText], options)
  }
  return runCommand(name, 'npm', npmArgs, options)
}

const killProcessTree = async (childProcess) => {
  if (!childProcess || !childProcess.pid) {
    return
  }

  if (process.platform === 'win32') {
    await runCommand('taskkill', 'cmd.exe', ['/c', `taskkill /PID ${childProcess.pid} /T /F`])
    return
  }

  try {
    process.kill(childProcess.pid, 'SIGTERM')
  } catch {
    // Ignore stop failures during cleanup.
  }
}

const waitForHttpOk = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return true
      }
    } catch {
      // retry until timeout
    }
    await sleep(900)
  }

  return false
}

const checkHttpReachable = async (url, timeoutMs = 1500) => {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    return response.ok
  } catch {
    return false
  }
}

const collectLanIpv4 = () => {
  const interfaces = networkInterfaces()
  for (const list of Object.values(interfaces)) {
    if (!Array.isArray(list)) {
      continue
    }

    for (const item of list) {
      if (!item || item.internal || item.family !== 'IPv4') {
        continue
      }
      return item.address
    }
  }
  return ''
}

const main = async () => {
  const args = parseArgs()
  const nodeCmd = process.execPath

  const modeRaw = toText(args.mode || 'dual').toLowerCase()
  const mode = ['real', 'offline', 'dual'].includes(modeRaw) ? modeRaw : 'dual'
  const skipBuild = boolFlag(args['skip-build'])
  const skipComfyui = boolFlag(args['skip-comfyui'])
  const requireComfyui = boolFlag(args['require-comfyui'])
  const keepRunning = boolFlag(args['keep-running'])

  const apiHost = toText(args['api-host'] || '127.0.0.1')
  const apiPort = Number(args['api-port'] || 8787)
  const webHost = toText(args['web-host'] || '0.0.0.0')
  const webPort = Number(args['web-port'] || 5173)
  const waitMs = Math.max(5_000, Number(args['wait-ms'] || 120_000) || 120_000)
  const reportPath = resolve(
    process.cwd(),
    toText(args.report || 'docs/release/p18-rehearsal-latest.json') || 'docs/release/p18-rehearsal-latest.json',
  )
  const apiBase = `http://${apiHost}:${apiPort}`
  const webBaseLocal = `http://127.0.0.1:${webPort}`
  const lanIp = collectLanIpv4()
  const webBaseLan = lanIp ? `http://${lanIp}:${webPort}` : ''

  const report = {
    pass: false,
    startedAt: new Date().toISOString(),
    elapsedMs: 0,
    mode,
    apiBase,
    webBaseLocal,
    webBaseLan,
    checks: [],
    warnings: [],
    nextActions: [],
  }

  const apiProcess = {
    child: null,
  }
  const webProcess = {
    child: null,
  }

  const record = (name, ok, detail = {}) => {
    report.checks.push({
      name,
      ok: Boolean(ok),
      ...detail,
    })
  }

  const startedAtMs = Date.now()

  try {
    if (!skipBuild) {
      const build = await runNpmCommand('build', ['run', 'build'], { streamOutput: true })
      record('build', build.ok, {
        code: build.code,
      })
      if (!build.ok) {
        throw new Error('build failed')
      }
    } else {
      record('build', true, { skipped: true })
    }

    const apiAlreadyInUse = await checkHttpReachable(`${apiBase}/api/health`)
    if (apiAlreadyInUse) {
      throw new Error(`api port is already in use: ${apiBase}`)
    }

    const webAlreadyInUse = await checkHttpReachable(webBaseLocal)
    if (webAlreadyInUse) {
      throw new Error(`web port is already in use: ${webBaseLocal}`)
    }

    apiProcess.child = spawn(nodeCmd, ['server/index.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        API_HOST: apiHost,
        API_PORT: String(apiPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })
    apiProcess.child.stdout?.on('data', (buffer) => {
      process.stdout.write(`[api] ${String(buffer)}`)
    })
    apiProcess.child.stderr?.on('data', (buffer) => {
      process.stderr.write(`[api] ${String(buffer)}`)
    })

    const apiReady = await waitForHttpOk(`${apiBase}/api/health`, waitMs)
    record('api-up', apiReady, { target: `${apiBase}/api/health` })
    if (!apiReady) {
      throw new Error('api health check timeout')
    }

    const webSpawn =
      process.platform === 'win32'
        ? spawn(
            'cmd.exe',
            ['/d', '/s', '/c', `npm run dev -- --host ${webHost} --port ${webPort} --strictPort`],
            {
              cwd: process.cwd(),
              env: process.env,
              stdio: ['ignore', 'pipe', 'pipe'],
              shell: false,
            },
          )
        : spawn('npm', ['run', 'dev', '--', '--host', webHost, '--port', String(webPort), '--strictPort'], {
            cwd: process.cwd(),
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: false,
          })

    webProcess.child = webSpawn
    webProcess.child.stdout?.on('data', (buffer) => {
      process.stdout.write(`[web] ${String(buffer)}`)
    })
    webProcess.child.stderr?.on('data', (buffer) => {
      process.stderr.write(`[web] ${String(buffer)}`)
    })

    const webReady = await waitForHttpOk(webBaseLocal, waitMs)
    record('web-up', webReady, { target: webBaseLocal })
    if (!webReady) {
      throw new Error('web dev server startup timeout')
    }

    const runDemoVerify = async (targetMode, required) => {
      const verify = await runCommand(
        `verify-final-demo-${targetMode}`,
        nodeCmd,
        ['scripts/verify-final-demo-chain.mjs', '--mode', targetMode, '--api-base', apiBase],
        {
          streamOutput: true,
        },
      )

      record(`verify-final-demo-${targetMode}`, verify.ok, {
        code: verify.code,
      })

      if (!verify.ok && required) {
        throw new Error(`verify-final-demo ${targetMode} failed`)
      }

      if (!verify.ok && !required) {
        report.warnings.push(`verify-final-demo ${targetMode} failed (non-blocking in current mode)`)
      }
    }

    if (mode === 'real') {
      await runDemoVerify('real', true)
    } else if (mode === 'offline') {
      await runDemoVerify('offline', true)
    } else {
      await runDemoVerify('real', false)
      await runDemoVerify('offline', true)
    }

    if (!skipComfyui) {
      const comfy = await runCommand('verify-comfyui', nodeCmd, ['scripts/verify-comfyui-integration.mjs'], {
        streamOutput: true,
      })
      record('verify-comfyui', comfy.ok, { code: comfy.code })

      if (!comfy.ok && requireComfyui) {
        throw new Error('verify-comfyui failed and --require-comfyui is set')
      }

      if (!comfy.ok && !requireComfyui) {
        report.warnings.push('verify-comfyui failed, fallback should use offline demo mode')
      }
    } else {
      record('verify-comfyui', true, { skipped: true })
    }

    report.pass = true
  } catch (error) {
    report.pass = false
    report.warnings.push(error instanceof Error ? error.message : String(error))
  } finally {
    report.elapsedMs = Date.now() - startedAtMs
    report.finishedAt = new Date().toISOString()
    report.nextActions = [
      `Demo URL (local): ${webBaseLocal}`,
      webBaseLan ? `Demo URL (LAN): ${webBaseLan}` : 'No usable LAN IPv4 address detected',
      `Verification command: npm run verify:final-demo -- --mode offline --api-base ${apiBase}`,
    ]

    mkdirSync(dirname(reportPath), { recursive: true })
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

    if (!keepRunning) {
      await killProcessTree(webProcess.child)
      await killProcessTree(apiProcess.child)
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2))

    if (!report.pass) {
      process.exitCode = 1
    }
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[rehearse:p18] FAIL', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
