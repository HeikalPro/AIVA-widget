import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { resolveChatCorpusId } from '@/constants/chatCorpus'
import type { ChatRequest, ChatResponse, LoginResponse } from '@/types/api'
import { normalizeChatResponse } from '@/services/chatNormalize'
import { clearToken, getToken } from '@/services/token'
import { getAuthApiBase, usesAivaAuth } from '@/services/authConfig'
import {
  isAivaSessionChatEnabled,
  sendAivaSessionChatMessage,
} from '@/services/aivaSessionChatClient'
import {
  isHalanAgentChatEnabled,
  sendHalanChatMessage,
} from '@/services/halanChatClient'

export { isAivaSessionChatEnabled, isHalanAgentChatEnabled }

const baseURL = import.meta.env.VITE_API_BASE_URL

function useHaivaChat(): boolean {
  return import.meta.env.VITE_USE_HAIVA_CHAT === '1'
}

/** Used by UI to branch streaming vs single-shot assistant bubble. */
export function isHaivaChatEnabled(): boolean {
  return useHaivaChat()
}

/** Streaming assistant deltas (placeholder bubble + live updates). */
export function usesAssistantStreamPlaceholder(): boolean {
  if (isHalanAgentChatEnabled()) {
    return import.meta.env.VITE_HALAN_CHAT_SSE === '1'
  }
  if (isAivaSessionChatEnabled()) {
    return true
  }
  return useHaivaChat()
}

/** Normalize so axios gets a path starting with `/`. */
function apiPath(key: 'login' | 'chat'): string {
  const raw =
    key === 'login'
      ? (import.meta.env.VITE_API_LOGIN_PATH ?? '/login')
      : (import.meta.env.VITE_API_CHAT_PATH ?? '/chat/')
  return raw.startsWith('/') ? raw : `/${raw}`
}

const loginPath = apiPath('login')
const chatPath = apiPath('chat')

export const api = axios.create({
  baseURL: baseURL || undefined,
  timeout: 120_000,
})

/** For error messages — axios `baseURL` + relative `url`. */
function fullRequestUrl(config?: InternalAxiosRequestConfig): string {
  if (!config) return '(unknown)'
  const b = (config.baseURL ?? '').replace(/\/$/, '')
  const u = config.url ?? ''
  if (!b) return u || '(no base URL)'
  if (!u) return b
  return u.startsWith('/') ? `${b}${u}` : `${b}/${u}`
}

function onSessionExpired() {
  window.dispatchEvent(new CustomEvent('nexa:session-expired'))
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const url = (config.url ?? '').split('?')[0]
  const isLogin =
    (config.method ?? 'get').toLowerCase() === 'post' &&
    (url === loginPath || url.replace(/\/$/, '') === loginPath.replace(/\/$/, ''))
  if (!isLogin) {
    const token = await getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  } else {
    delete config.headers.Authorization
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err.response?.status
    const raw = err.response?.data
    const bodyStr = typeof raw === 'string' ? raw : ''
    const looksLikeNginxHtml =
      bodyStr.includes('<html') ||
      bodyStr.includes('<!DOCTYPE') ||
      bodyStr.toLowerCase().includes('nginx')

    if (looksLikeNginxHtml && (status === 404 || status === 502)) {
      const url = fullRequestUrl(err.config)
      err.message = [
        `No API route at this URL (nginx returned HTML ${status}).`,
        `Requested: ${url}`,
        `Fix: set VITE_API_BASE_URL to the path your reverse proxy uses for FastAPI (often https://host/api or https://host/api/v1), then restart dev or rebuild the app.`,
      ].join(' ')
    }

    if (status === 401 || status === 403) {
      await clearToken().catch(() => {})
      onSessionExpired()
    }
    return Promise.reject(err)
  }
)

export function assertApiBaseUrl(): void {
  if (isHalanAgentChatEnabled()) {
    if (!import.meta.env.VITE_CHAT_API_BASE?.trim()) {
      console.info(
        'halan_agent_chat: VITE_CHAT_API_BASE not set; using default http://127.0.0.1:8091',
      )
    }
    return
  }
  if (isAivaSessionChatEnabled()) {
    if (!import.meta.env.VITE_API_BASE_URL?.trim()) {
      console.warn('AIVA session chat: VITE_API_BASE_URL is not set (e.g. http://127.0.0.1:8000).')
    }
    if (!import.meta.env.VITE_AIVA_ACCOUNT_ID?.trim()) {
      console.info(
        'AIVA session chat: VITE_AIVA_ACCOUNT_ID not set; will use first account from GET /api/accounts.',
      )
    }
    return
  }
  if (!import.meta.env.VITE_API_BASE_URL) {
    console.warn('VITE_API_BASE_URL is not set. Set it in .env for production.')
  }
}

/**
 * Legacy JWT login (POST `VITE_API_LOGIN_PATH`, default `/login`).
 * Disabled for HAIVA / no-auth setups — use `VITE_SKIP_LOGIN=1` and do not call this.
 */
async function readLoginError(res: Response): Promise<string> {
  const raw = await res.text()
  try {
    const j = JSON.parse(raw) as { detail?: unknown; message?: string }
    if (typeof j.message === 'string') return j.message
    if (typeof j.detail === 'string') return j.detail
  } catch {
    /* keep */
  }
  return raw.slice(0, 500) || `Request failed (${res.status})`
}

export async function loginRequest(username: string, password: string): Promise<LoginResponse> {
  if (usesAivaAuth()) {
    const base = getAuthApiBase()
    if (!base) throw new Error('Set VITE_AUTH_API_BASE_URL or VITE_API_BASE_URL for AIVA login')
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: username.trim(), password }),
    })
    if (!res.ok) {
      const msg = await readLoginError(res)
      throw new Error(res.status === 404 ? `Login not found at ${base}/api/auth/login — is AIVA-V2 backend running? (${msg})` : msg)
    }
    return (await res.json()) as LoginResponse
  }

  const body = new URLSearchParams()
  if (import.meta.env.VITE_LOGIN_MINIMAL_BODY === '1') {
    body.set('username', username)
    body.set('password', password)
  } else {
    body.set('grant_type', 'password')
    body.set('username', username)
    body.set('password', password)
    body.set('scope', '')
  }
  const { data } = await api.post<LoginResponse>(loginPath, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data
}

function parseCommaSeparatedInts(raw: string | undefined): number[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;\s]+/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n))
}

function parseCommaSeparatedIds(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function haivaStreamMessagesUrl(conversationId: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  return `${base}/conversations/${encodeURIComponent(conversationId)}/messages/stream`
}

type HaivaSseEvent = {
  assistantDelta?: string
  streamConversationId?: string
}

function parseHaivaSseDataPayload(payload: string): HaivaSseEvent {
  if (!payload || payload === '[DONE]') return {}
  try {
    const j = JSON.parse(payload) as Record<string, unknown>
    const out: HaivaSseEvent = {}
    if (j.phase === 'accepted' && typeof j.conversation_id === 'string' && j.conversation_id) {
      out.streamConversationId = j.conversation_id
    }
    if (typeof j.delta === 'string' && j.delta.length > 0) {
      out.assistantDelta = j.delta
      return out
    }
    const nested = j.delta
    if (
      nested &&
      typeof nested === 'object' &&
      typeof (nested as { content?: unknown }).content === 'string'
    ) {
      const c = (nested as { content: string }).content
      if (c) out.assistantDelta = c
    }
    return out
  } catch {
    return {}
  }
}

/** Full-buffer fallback (e.g. no ReadableStream). */
function assistantTextFromSse(raw: string): string {
  let acc = ''
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const dataLines = block.split(/\r?\n/).filter((l) => l.startsWith('data:'))
    if (dataLines.length === 0) continue
    const payload = dataLines
      .map((l) => l.replace(/^data:\s?/, ''))
      .join('\n')
      .trim()
    const ev = parseHaivaSseDataPayload(payload)
    if (ev.assistantDelta) acc += ev.assistantDelta
  }
  return acc.trim()
}

function feedSseBuffer(
  carry: string,
  chunk: string,
  onDataLine: (payload: string) => void,
): string {
  let buf = carry + chunk
  for (;;) {
    const n = buf.indexOf('\n\n')
    const r = buf.indexOf('\r\n\r\n')
    let cut = -1
    let sepLen = 2
    if (n >= 0 && (r < 0 || n <= r)) {
      cut = n
      sepLen = 2
    } else if (r >= 0) {
      cut = r
      sepLen = 4
    }
    if (cut < 0) break
    const eventBlock = buf.slice(0, cut)
    buf = buf.slice(cut + sepLen)
    const lines = eventBlock.split(/\r?\n/)
    const merged = lines
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.replace(/^data:\s?/, ''))
      .join('\n')
      .trim()
    if (merged) onDataLine(merged)
  }
  return buf
}

export type SendChatMessageOptions = {
  /** HAIVA SSE: fired as token deltas arrive (accumulated assistant text). */
  onHaivaAssistantText?: (accumulated: string) => void
}

type HaivaStreamResult = {
  text: string
  streamConversationId?: string
}

async function haivaPostMessageStream(
  conversationId: string,
  body: Record<string, unknown>,
  onAssistantText?: (accumulated: string) => void,
): Promise<HaivaStreamResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  const token = await getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(haivaStreamMessagesUrl(conversationId), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const raw = await res.text()
    let msg = raw.slice(0, 500)
    try {
      const j = JSON.parse(raw) as { detail?: string; message?: string }
      msg = j.detail ?? j.message ?? msg
    } catch {
      /* keep slice */
    }
    throw new Error(msg || `Request failed (${res.status})`)
  }

  let accumulated = ''
  let streamConversationId: string | undefined
  const bump = (delta: string) => {
    accumulated += delta
    onAssistantText?.(accumulated)
  }

  const handlePayload = (payload: string) => {
    const ev = parseHaivaSseDataPayload(payload)
    if (ev.streamConversationId) streamConversationId = ev.streamConversationId
    if (ev.assistantDelta) bump(ev.assistantDelta)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    const raw = await res.text()
    const text = assistantTextFromSse(raw)
    onAssistantText?.(text)
    return { text, streamConversationId: undefined }
  }

  const dec = new TextDecoder()
  let carry = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      carry = feedSseBuffer(carry, dec.decode(), handlePayload)
      break
    }
    carry = feedSseBuffer(carry, dec.decode(value, { stream: true }), handlePayload)
  }
  if (carry.trim()) {
    for (const block of carry.split(/\r?\n\r?\n/)) {
      if (!block.trim()) continue
      const lines = block.split(/\r?\n/)
      const merged = lines
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.replace(/^data:\s?/, ''))
        .join('\n')
        .trim()
      if (merged) handlePayload(merged)
    }
  }

  return { text: accumulated, streamConversationId }
}

export async function sendChatMessage(
  payload: ChatRequest,
  options?: SendChatMessageOptions,
): Promise<ChatResponse> {
  if (isHalanAgentChatEnabled()) {
    return sendHalanChatMessage(payload, {
      onAssistantText: options?.onHaivaAssistantText,
    })
  }

  if (isAivaSessionChatEnabled()) {
    return sendAivaSessionChatMessage(payload, {
      onAssistantText: options?.onHaivaAssistantText,
    })
  }

  if (useHaivaChat()) {
    let conversationId = payload.conversation_id?.trim() ?? ''
    if (!conversationId) {
      const { data: created } = await api.post<{ conversation_id?: string }>('/conversations')
      conversationId = created.conversation_id?.trim() ?? ''
      if (!conversationId) {
        return { response: '', conversation_id: '' }
      }
    }

    const body: Record<string, unknown> = { message: payload.user_message }
    body.corpus_id = resolveChatCorpusId(payload.corpus_id)
    const route = import.meta.env.VITE_HAIVA_MESSAGE_ROUTE?.trim()
    if (route) body.route = route
    const searchQuery = import.meta.env.VITE_HAIVA_SEARCH_QUERY?.trim()
    if (searchQuery) body.search_query = searchQuery

    const stream = await haivaPostMessageStream(
      conversationId,
      body,
      options?.onHaivaAssistantText,
    )
    const finalId = stream.streamConversationId?.trim() || conversationId
    return {
      response: stream.text,
      conversation_id: finalId,
    }
  }

  const envFiles = parseCommaSeparatedIds(import.meta.env.VITE_CHAT_SELECTED_FILE_IDS)
  const selected_file_ids =
    payload.selected_file_ids !== undefined ? payload.selected_file_ids : envFiles

  const envChannels = parseCommaSeparatedInts(import.meta.env.VITE_CHAT_CHANNEL_PROMPT_IDS)
  const channel_prompt_ids =
    payload.channel_prompt_ids !== undefined ? payload.channel_prompt_ids : envChannels

  const model_provider =
    payload.model_provider ?? import.meta.env.VITE_CHAT_MODEL_PROVIDER?.trim() ?? undefined
  const system_message =
    payload.system_message ?? import.meta.env.VITE_CHAT_SYSTEM_MESSAGE?.trim() ?? undefined

  const body: Record<string, unknown> = {
    user_message: payload.user_message,
    selected_file_ids,
  }
  if (channel_prompt_ids.length > 0) {
    body.channel_prompt_ids = channel_prompt_ids
  }
  if (model_provider) {
    body.model_provider = model_provider
  }
  if (system_message) {
    body.system_message = system_message
  }
  // Omit when missing — empty string breaks some backends (new thread every time).
  if (payload.conversation_id) {
    body.conversation_id = payload.conversation_id
  }
  body.corpus_id = resolveChatCorpusId(payload.corpus_id)

  const { data } = await api.post<unknown>(chatPath, body, {
    headers: { 'Content-Type': 'application/json' },
  })
  return normalizeChatResponse(data)
}
