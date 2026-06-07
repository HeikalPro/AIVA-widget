import { fetchWithAuth } from '@/services/aivaAuthFetch'
import type { ChatMessage, ChatRequest, ChatResponse } from '@/types/api'

/** AIVA-V2 session RAG chat (`/api/chat/*`). Enable with `VITE_USE_AIVA_SESSION_CHAT=1`. */
export function isAivaSessionChatEnabled(): boolean {
  return import.meta.env.VITE_USE_AIVA_SESSION_CHAT === '1'
}

type AivaSessionOut = {
  id: number
  account_id: number
}

type AivaMessageOut = {
  id: number
  sender_type: string
  message_text: string
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
    if (Array.isArray(j.detail) && j.detail[0] && typeof (j.detail[0] as { msg?: string }).msg === 'string') {
      return (j.detail[0] as { msg: string }).msg
    }
  } catch {
    /* keep slice */
  }
  return msg || `Request failed (${res.status})`
}

export function aivaMessageRowToChatMessage(m: AivaMessageOut): ChatMessage {
  const role = String(m.sender_type).toUpperCase() === 'USER' ? 'user' : 'assistant'
  return {
    id: `aiva-${m.id}`,
    role,
    content: m.message_text,
  }
}

async function resolveAccountId(): Promise<number> {
  const env = import.meta.env.VITE_AIVA_ACCOUNT_ID?.trim()
  if (env) {
    const n = Number.parseInt(env, 10)
    if (!Number.isNaN(n) && n > 0) return n
    throw new Error('Invalid VITE_AIVA_ACCOUNT_ID — must be a positive integer')
  }

  // GET /api/accounts returns only accounts assigned to the logged-in user (agents/supervisors).
  const res = await fetchWithAuth(apiUrl('/api/accounts'), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const accounts = (await res.json()) as { id: number }[]
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error(
      'No account assigned to your user. Ask an admin to assign you to an account in AIVA.',
    )
  }
  return accounts[0].id
}

export async function aivaCreateSession(accountId?: number): Promise<string> {
  const aid = accountId ?? (await resolveAccountId())
  const res = await fetchWithAuth(apiUrl('/api/chat/sessions'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: aid }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const data = (await res.json()) as AivaSessionOut
  if (!data?.id) throw new Error('No session id in POST /api/chat/sessions response')
  return String(data.id)
}

export async function aivaFetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetchWithAuth(apiUrl(`/api/chat/sessions/${encodeURIComponent(sessionId)}`), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new Error('Expected array from GET /api/chat/sessions/:id')
  return (data as AivaMessageOut[]).map(aivaMessageRowToChatMessage)
}

export type SendAivaSessionChatMessageOptions = {
  onAssistantText?: (accumulated: string) => void
}

function parseTopK(): number {
  const raw = import.meta.env.VITE_AIVA_CHAT_TOP_K?.trim()
  if (!raw) return 10
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1 || n > 50) return 10
  return n
}

export async function sendAivaSessionChatMessage(
  payload: ChatRequest,
  options?: SendAivaSessionChatMessageOptions,
): Promise<ChatResponse> {
  let sessionId = payload.conversation_id?.trim() ?? ''
  if (!sessionId) {
    sessionId = await aivaCreateSession()
  }

  const res = await fetchWithAuth(
    apiUrl(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`),
    {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_text: payload.user_message,
        top_k: parseTopK(),
      }),
    },
  )

  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }

  let accumulated = ''
  const bump = (delta: string) => {
    accumulated += delta
    options?.onAssistantText?.(accumulated)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    const raw = await res.text()
    for (const line of raw.split(/\r?\n/)) {
      if (!line.startsWith('data: ')) continue
      try {
        const ev = JSON.parse(line.slice(6)) as { type?: string; text?: string }
        if (ev.type === 'token' && ev.text) bump(ev.text)
      } catch {
        /* ignore */
      }
    }
    return {
      response: accumulated.trim() || '(Empty reply from stream.)',
      conversation_id: sessionId,
    }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const ev = JSON.parse(line.slice(6)) as { type?: string; text?: string }
        if (ev.type === 'token' && ev.text) bump(ev.text)
      } catch {
        /* ignore malformed SSE */
      }
    }
  }

  return {
    response: accumulated.trim() || '(Empty reply from stream.)',
    conversation_id: sessionId,
  }
}
