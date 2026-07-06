import { fetchWithAuth } from '@/services/aivaAuthFetch'
import type { ChatMessage, ChatRequest, ChatResponse, KbSource } from '@/types/api'

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
  rating?: 'up' | 'down' | null
  feedback?: string | null
  sources?: KbSource[]
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
    messageId: m.id,
    role,
    content: m.message_text,
    rating: m.rating ?? undefined,
    feedback: m.feedback ?? undefined,
    sources: m.sources?.length ? m.sources : undefined,
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

export type AivaQueueAccess = {
  account_id: number
  available_queues: { key: string; label: string }[]
  allowed_queues: string[]
  default_active_queues: string[]
}

export async function aivaFetchQueueAccess(accountId: number): Promise<AivaQueueAccess> {
  const res = await fetchWithAuth(
    apiUrl(`/api/chat/queue-access?account_id=${accountId}`),
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return (await res.json()) as AivaQueueAccess
}

export async function aivaUpdateSessionQueues(
  sessionId: string,
  activeQueues: string[],
): Promise<void> {
  const res = await fetchWithAuth(
    apiUrl(`/api/chat/sessions/${encodeURIComponent(sessionId)}/queues`),
    {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ active_queues: activeQueues }),
    },
  )
  if (!res.ok) throw new Error(await readErrorMessage(res))
}

export async function aivaCreateSession(
  accountId?: number,
  activeQueues?: string[],
): Promise<string> {
  const aid = accountId ?? (await resolveAccountId())
  const body: { account_id: number; active_queues?: string[] } = { account_id: aid }
  if (activeQueues?.length) body.active_queues = activeQueues
  const res = await fetchWithAuth(apiUrl('/api/chat/sessions'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
  signal?: AbortSignal
  accountId?: number
  activeQueues?: string[]
}

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true
}

function parseTopK(): number {
  const raw = import.meta.env.VITE_AIVA_CHAT_TOP_K?.trim()
  if (!raw) return 10
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1 || n > 50) return 10
  return n
}

function buildStreamResponse(accumulated: string, streamError?: string): string {
  const text = accumulated.trim()
  if (text && streamError) return `${text}\n\nError: ${streamError}`
  if (text) return text
  if (streamError) return `Error: ${streamError}`
  return '(Empty reply from stream.)'
}

export async function sendAivaSessionChatMessage(
  payload: ChatRequest,
  options?: SendAivaSessionChatMessageOptions,
): Promise<ChatResponse> {
  let sessionId = payload.conversation_id?.trim() ?? ''
  if (!sessionId) {
    sessionId = await aivaCreateSession(options?.accountId, options?.activeQueues)
  }

  const signal = options?.signal

  let res: Response
  try {
    res = await fetchWithAuth(
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
        signal,
      },
    )
  } catch (e) {
    if (isAborted(signal) || (e instanceof DOMException && e.name === 'AbortError')) {
      return {
        response: '(Stopped)',
        conversation_id: sessionId,
      }
    }
    throw e
  }

  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }

  let accumulated = ''
  let streamError: string | undefined
  let userMessageId: number | undefined
  let assistantMessageId: number | undefined
  let sources: KbSource[] | undefined
  const bump = (delta: string) => {
    accumulated += delta
    options?.onAssistantText?.(accumulated)
  }

  type StreamEvent = {
    type?: string
    text?: string
    message?: string
    user_message_id?: number
    assistant_message_id?: number
    sources?: KbSource[]
  }

  const parseEvent = (ev: StreamEvent) => {
    if (ev.type === 'token' && ev.text) bump(ev.text)
    if (ev.type === 'error' && ev.message) {
      streamError = ev.message
      const display = accumulated.trim()
        ? `${accumulated}\n\nError: ${ev.message}`
        : `Error: ${ev.message}`
      options?.onAssistantText?.(display)
    }
    if (ev.type === 'done') {
      if (typeof ev.user_message_id === 'number') userMessageId = ev.user_message_id
      if (typeof ev.assistant_message_id === 'number') assistantMessageId = ev.assistant_message_id
      if (Array.isArray(ev.sources) && ev.sources.length > 0) sources = ev.sources
    }
  }

  const finish = (): ChatResponse => ({
    response: buildStreamResponse(accumulated, streamError),
    conversation_id: sessionId,
    user_message_id: userMessageId,
    assistant_message_id: assistantMessageId,
    sources,
  })

  try {
    const reader = res.body?.getReader()
    if (!reader) {
      const raw = await res.text()
      for (const line of raw.split(/\r?\n/)) {
        if (!line.startsWith('data: ')) continue
        try {
          parseEvent(JSON.parse(line.slice(6)) as StreamEvent)
        } catch {
          /* ignore */
        }
      }
      if (streamError && !accumulated.trim()) {
        throw new Error(streamError)
      }
      return finish()
    }

    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      if (isAborted(signal)) {
        await reader.cancel().catch(() => {})
        break
      }
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          parseEvent(JSON.parse(line.slice(6)) as StreamEvent)
        } catch {
          /* ignore malformed SSE */
        }
      }
    }

    if (streamError && !accumulated.trim()) {
      throw new Error(streamError)
    }
    return finish()
  } catch (e) {
    if (isAborted(signal) || (e instanceof DOMException && e.name === 'AbortError')) {
      if (accumulated.trim()) return finish()
      return {
        response: '(Stopped)',
        conversation_id: sessionId,
        user_message_id: userMessageId,
        assistant_message_id: assistantMessageId,
        sources,
      }
    }
    throw e
  }
}

export async function aivaSubmitRating(
  messageId: number,
  body: { rating: 'up' } | { rating: 'down'; feedback: string },
): Promise<void> {
  const res = await fetchWithAuth(apiUrl(`/api/chat/messages/${messageId}/rating`), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
}
