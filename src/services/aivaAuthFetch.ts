import { getAuthApiBase } from '@/services/authConfig'
import { clearToken, getRefreshToken, getToken, setTokens } from '@/services/token'
import type { LoginResponse } from '@/types/api'

let refreshPromise: Promise<boolean> | null = null

export async function tryRefreshAccessToken(): Promise<boolean> {
  const refresh = await getRefreshToken()
  if (!refresh) return false

  const base = getAuthApiBase()
  if (!base) return false

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${base}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        })
        if (!res.ok) return false
        const tokens = (await res.json()) as LoginResponse
        if (!tokens.access_token) return false
        await setTokens(tokens)
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent('nexa:session-expired'))
}

/** Authenticated fetch with one automatic token refresh on 401. */
export async function fetchWithAuth(
  url: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = await getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...init, headers })

  if (res.status === 401 && retry) {
    const ok = await tryRefreshAccessToken()
    if (ok) return fetchWithAuth(url, init, false)
    await clearToken().catch(() => {})
    notifySessionExpired()
  }

  return res
}
