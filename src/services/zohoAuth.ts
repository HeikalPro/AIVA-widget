import { getAuthApiBase } from '@/services/authConfig'
import type { ZohoCallbackPayload } from '@/types/nexa-api'

/** Zoho OAuth UI is off unless `VITE_ENABLE_ZOHO_LOGIN=1` (code kept for optional re-enable). */
export function isZohoLoginAvailable(): boolean {
  if (import.meta.env.VITE_SKIP_LOGIN === '1') return false
  return import.meta.env.VITE_ENABLE_ZOHO_LOGIN === '1' && !!getAuthApiBase()
}

export function isZohoCallbackRoute(): boolean {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  return path === '/auth/zoho-callback' || path.endsWith('/auth/zoho-callback')
}

export function parseZohoCallbackParams(search: string): ZohoCallbackPayload {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  return {
    access_token: params.get('access_token') ?? undefined,
    refresh_token: params.get('refresh_token') ?? undefined,
    token_type: params.get('token_type') ?? undefined,
    error: params.get('error') ?? undefined,
    cancelled: params.get('cancelled') === '1',
  }
}

export function zohoCallbackError(payload: ZohoCallbackPayload): string | null {
  if (payload.cancelled) return null
  if (payload.error) return payload.error
  if (!payload.access_token) return 'Missing access token from Zoho callback'
  return null
}

export function isZohoLoginCancelled(payload: ZohoCallbackPayload): boolean {
  return !!payload.cancelled
}

export async function startZohoLogin(): Promise<void> {
  const base = getAuthApiBase()
  if (!base) throw new Error('Set VITE_AUTH_API_BASE_URL for Zoho login')
  const returnTo = `${window.location.origin}/auth/zoho-callback`
  const url = `${base}/api/auth/zoho/login?redirect=true&return_to=${encodeURIComponent(returnTo)}`
  await window.nexa.zoho.start(url)
}

export async function cancelZohoLogin(): Promise<void> {
  await window.nexa.zoho.cancel()
}
