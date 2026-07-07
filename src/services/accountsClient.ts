import { fetchWithAuth } from '@/services/aivaAuthFetch'
import type { WidgetAccount } from '@/types/widgetFeatures'

function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!raw) return ''
  return raw.replace(/\/$/, '')
}

function apiUrl(path: string): string {
  const base = getApiBase()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

async function readErrorMessage(res: Response): Promise<string> {
  const raw = await res.text()
  try {
    const j = JSON.parse(raw) as { detail?: unknown; message?: string }
    if (typeof j.message === 'string') return j.message
    if (typeof j.detail === 'string') return j.detail
  } catch {
    /* keep slice */
  }
  return raw.slice(0, 800) || `Request failed (${res.status})`
}

type AccountApiRow = {
  id: number
  name: string
  widget_features?: WidgetAccount['widget_features']
}

export async function fetchWidgetAccounts(): Promise<WidgetAccount[]> {
  const env = import.meta.env.VITE_AIVA_ACCOUNT_ID?.trim()
  if (env) {
    const n = Number.parseInt(env, 10)
    if (!Number.isNaN(n) && n > 0) {
      const res = await fetchWithAuth(apiUrl(`/api/accounts/${n}`), {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(await readErrorMessage(res))
      const row = (await res.json()) as AccountApiRow
      return [{ id: row.id, name: row.name, widget_features: row.widget_features }]
    }
  }

  const res = await fetchWithAuth(apiUrl('/api/accounts'), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const rows = (await res.json()) as AccountApiRow[]
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No account assigned to your user.')
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    widget_features: row.widget_features,
  }))
}

const STORED_ACCOUNT_KEY = 'nexa_account_id'

export function getStoredAccountId(): number | null {
  try {
    const raw = localStorage.getItem(STORED_ACCOUNT_KEY) ?? sessionStorage.getItem(STORED_ACCOUNT_KEY)
    if (!raw) return null
    const n = Number.parseInt(raw, 10)
    return Number.isNaN(n) || n <= 0 ? null : n
  } catch {
    return null
  }
}

export function setStoredAccountId(accountId: number): void {
  const value = String(accountId)
  try {
    localStorage.setItem(STORED_ACCOUNT_KEY, value)
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(STORED_ACCOUNT_KEY, value)
  } catch {
    /* ignore */
  }
}

export function clearStoredAccountId(): void {
  try {
    localStorage.removeItem(STORED_ACCOUNT_KEY)
    sessionStorage.removeItem(STORED_ACCOUNT_KEY)
  } catch {
    /* ignore */
  }
}

export function pickDefaultAccountId(
  accounts: WidgetAccount[],
  preferredId?: number | null,
): number {
  if (preferredId != null && accounts.some((a) => a.id === preferredId)) {
    return preferredId
  }
  return accounts[0].id
}
