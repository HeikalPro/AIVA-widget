import { type ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { envFlag, readWidgetEnv } from './readEnvFile'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0'])
const DEFAULT_STARTUP_TIMEOUT_MS = 90_000

let managedProcess: ChildProcess | null = null
let startedByWidget = false

function widgetRootFromMain(): string {
  return path.join(__dirname, '..')
}

function resolveBackendBaseUrl(env: Record<string, string>): string {
  if (envFlag(env.VITE_USE_AIVA_SESSION_CHAT)) {
    return env.VITE_API_BASE_URL?.trim() ?? ''
  }
  if (envFlag(env.VITE_ENABLE_ZOHO_LOGIN) || envFlag(env.VITE_USE_AIVA_AUTH)) {
    return (
      env.VITE_AUTH_API_BASE_URL?.trim() ||
      env.VITE_API_BASE_URL?.trim() ||
      ''
    )
  }
  const api = env.VITE_API_BASE_URL?.trim() ?? ''
  if (api && isLocalBackendUrl(api)) return api
  return ''
}

function isLocalBackendUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return LOCAL_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

function autoStartEnabled(env: Record<string, string>): boolean {
  const explicit = env.NEXA_AUTO_START_BACKEND?.trim()
  if (explicit === '0') return false
  if (explicit === '1') return true
  // Default: on when using a local AIVA backend URL.
  const base = resolveBackendBaseUrl(env)
  return !!base && isLocalBackendUrl(base)
}

function resolveAivaRoot(env: Record<string, string>): string | null {
  const explicit = env.NEXA_AIVA_ROOT?.trim() || process.env.NEXA_AIVA_ROOT?.trim()
  if (explicit && fs.existsSync(path.join(explicit, 'backend', 'main.py'))) {
    return path.resolve(explicit)
  }

  const widgetRoot = widgetRootFromMain()
  const candidates = [
    path.join(widgetRoot, '..', 'AIVA-V2'),
    path.join(widgetRoot, '..', '..', 'AIVA-V2'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'backend', 'main.py'))) {
      return path.resolve(candidate)
    }
  }
  return null
}

function resolvePythonCommand(): { command: string; prefixArgs: string[] } {
  const explicit = process.env.NEXA_PYTHON?.trim()
  if (explicit) return { command: explicit, prefixArgs: [] }
  if (process.platform === 'win32') return { command: 'py', prefixArgs: ['-3'] }
  return { command: 'python3', prefixArgs: [] }
}

async function isBackendHealthy(baseUrl: string, timeoutMs = 2_500): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, '')}/health`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return false
    const body = (await res.json()) as { status?: string }
    return body.status === 'ok'
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

async function waitForBackend(baseUrl: string, timeoutMs: number): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await isBackendHealthy(baseUrl)) return true
    if (managedProcess && managedProcess.exitCode != null) return false
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

function pipeBackendLogs(proc: ChildProcess, label: string) {
  proc.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[${label}] ${chunk.toString()}`)
  })
  proc.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[${label}] ${chunk.toString()}`)
  })
}

function spawnBackend(aivaRoot: string): Promise<ChildProcess> {
  const { command, prefixArgs } = resolvePythonCommand()
  const args = [...prefixArgs, '-m', 'backend.main']
  console.info(`[aiva-backend] starting: ${command} ${args.join(' ')} (cwd=${aivaRoot})`)

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: aivaRoot,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    proc.once('error', (err) => {
      reject(err)
    })
    proc.once('spawn', () => {
      pipeBackendLogs(proc, 'aiva-backend')
      proc.on('exit', (code, signal) => {
        if (managedProcess === proc) {
          managedProcess = null
          startedByWidget = false
        }
        console.info(`[aiva-backend] exited code=${code ?? 'null'} signal=${signal ?? 'null'}`)
      })
      resolve(proc)
    })
  })
}

export type BackendEnsureResult =
  | { status: 'already_running'; baseUrl: string }
  | { status: 'started'; baseUrl: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; baseUrl: string; reason: string }

/** Ensure local AIVA-V2 backend is up; start it only when health check fails. */
export async function ensureAivaBackendRunning(): Promise<BackendEnsureResult> {
  const env = readWidgetEnv(widgetRootFromMain())
  const baseUrl = resolveBackendBaseUrl(env)

  if (!autoStartEnabled(env)) {
    return { status: 'skipped', reason: 'Auto-start disabled (NEXA_AUTO_START_BACKEND=0).' }
  }

  if (!baseUrl) {
    return { status: 'skipped', reason: 'No local AIVA backend URL configured in .env.' }
  }

  if (!isLocalBackendUrl(baseUrl)) {
    return { status: 'skipped', reason: `Remote backend (${baseUrl}) — not auto-starting.` }
  }

  if (await isBackendHealthy(baseUrl)) {
    console.info(`[aiva-backend] already running at ${baseUrl}`)
    return { status: 'already_running', baseUrl }
  }

  const aivaRoot = resolveAivaRoot(env)
  if (!aivaRoot) {
    return {
      status: 'failed',
      baseUrl,
      reason: 'AIVA-V2 folder not found. Set NEXA_AIVA_ROOT in .env (e.g. D:\\AIVA\\AIVA-V2).',
    }
  }

  const timeoutMs = Number.parseInt(env.NEXA_BACKEND_STARTUP_TIMEOUT_MS ?? '', 10) || DEFAULT_STARTUP_TIMEOUT_MS

  try {
    managedProcess = await spawnBackend(aivaRoot)
    startedByWidget = true
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return { status: 'failed', baseUrl, reason: `Could not spawn backend: ${reason}` }
  }

  const ready = await waitForBackend(baseUrl, timeoutMs)
  if (ready) {
    console.info(`[aiva-backend] ready at ${baseUrl}`)
    return { status: 'started', baseUrl }
  }

  stopManagedBackend()
  return {
    status: 'failed',
    baseUrl,
    reason: `Backend did not respond on ${baseUrl}/health within ${timeoutMs / 1000}s.`,
  }
}

/** Stop backend only if the widget started it (leave pre-existing servers running). */
export function stopManagedBackend(): void {
  if (!managedProcess || !startedByWidget) return
  const proc = managedProcess
  managedProcess = null
  startedByWidget = false

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true })
  } else {
    proc.kill('SIGTERM')
  }
}
