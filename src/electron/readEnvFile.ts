import fs from 'node:fs'
import path from 'node:path'

/** Parse simple KEY=VALUE lines from a `.env` file (no variable expansion). */
export function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {}
  const out: Record<string, string> = {}
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

export function readWidgetEnv(widgetRoot: string): Record<string, string> {
  return readEnvFile(path.join(widgetRoot, '.env'))
}

export function envFlag(value: string | undefined): boolean {
  return value?.trim() === '1'
}
