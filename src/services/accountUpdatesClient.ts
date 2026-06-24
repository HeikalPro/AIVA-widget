import { fetchWithAuth } from '@/services/aivaAuthFetch'

export type AccountUpdate = {
  id: number
  account_id: number
  account_name?: string | null
  title: string
  body: string
  is_active: boolean
  created_at?: string | null
}

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
  let msg = raw.slice(0, 800)
  try {
    const j = JSON.parse(raw) as { detail?: unknown; message?: string }
    if (typeof j.message === 'string') return j.message
    if (typeof j.detail === 'string') return j.detail
  } catch {
    /* keep slice */
  }
  return msg || `Request failed (${res.status})`
}

async function resolveAccountId(): Promise<number> {
  const env = import.meta.env.VITE_AIVA_ACCOUNT_ID?.trim()
  if (env) {
    const n = Number.parseInt(env, 10)
    if (!Number.isNaN(n) && n > 0) return n
    throw new Error('Invalid VITE_AIVA_ACCOUNT_ID')
  }

  const res = await fetchWithAuth(apiUrl('/api/accounts'), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const accounts = (await res.json()) as { id: number }[]
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('No account assigned to your user.')
  }
  return accounts[0].id
}

export async function fetchActiveAccountUpdates(accountId?: number): Promise<AccountUpdate[]> {
  const aid = accountId ?? (await resolveAccountId())
  const qs = new URLSearchParams({ account_id: String(aid) })
  const res = await fetchWithAuth(apiUrl(`/api/account-updates/active?${qs}`), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const rows = (await res.json()) as AccountUpdate[]
  return Array.isArray(rows) ? rows : []
}

export async function resolveWidgetAccountId(): Promise<number | null> {
  try {
    return await resolveAccountId()
  } catch {
    return null
  }
}
