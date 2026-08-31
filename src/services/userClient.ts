import { fetchWithAuth } from '@/services/aivaAuthFetch'
import { getAuthApiBase, skipLogin, usesAivaAuth } from '@/services/authConfig'
import type { CurrentUser } from '@/types/api'

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

/** Only AIVA-V2 auth exposes `/api/auth/me`; legacy/skip-login setups have no profile. */
export function isCurrentUserAvailable(): boolean {
  return !skipLogin() && usesAivaAuth() && !!getAuthApiBase()
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const base = getAuthApiBase()
  if (!base) throw new Error('Set VITE_AUTH_API_BASE_URL or VITE_API_BASE_URL to load your profile')
  const res = await fetchWithAuth(`${base}/api/auth/me`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return (await res.json()) as CurrentUser
}

/** "First Last" → "First" → email local-part. Empty string when nothing usable. */
export function displayNameFromUser(user: CurrentUser | null): string {
  if (!user) return ''
  const full = [user.first_name, user.last_name]
    .map((p) => p?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
  if (full) return full
  const local = (user.email ?? '').split('@')[0]?.trim() ?? ''
  return local
}

/** Short form for cramped chrome — first name only. */
export function firstNameFromUser(user: CurrentUser | null): string {
  return displayNameFromUser(user).split(' ')[0] ?? ''
}
