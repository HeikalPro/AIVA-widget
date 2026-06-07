import { isAivaSessionChatEnabled } from '@/services/aivaSessionChatClient'

export function skipLogin(): boolean {
  return import.meta.env.VITE_SKIP_LOGIN === '1'
}

/** AIVA-V2 JWT login + Zoho (`/api/auth/*`). Separate from Halan chat base URL. */
export function usesAivaAuth(): boolean {
  if (skipLogin()) return false
  if (isAivaSessionChatEnabled()) return true
  if (import.meta.env.VITE_ENABLE_ZOHO_LOGIN === '1') return true
  if (import.meta.env.VITE_USE_AIVA_AUTH === '1') return true
  return !!import.meta.env.VITE_AUTH_API_BASE_URL?.trim()
}

/** Base URL for `/api/auth/login` and Zoho OAuth (defaults to `VITE_API_BASE_URL`). */
export function getAuthApiBase(): string {
  const auth = import.meta.env.VITE_AUTH_API_BASE_URL?.trim()
  if (auth) return auth.replace(/\/$/, '')
  const base = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!base) return ''
  return base.replace(/\/$/, '')
}
