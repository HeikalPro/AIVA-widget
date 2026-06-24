import { resolveChatCorpusId } from '@/constants/chatCorpus'
import { getToken } from '@/services/token'
import type { ChatMessage, ChatRequest, ChatResponse } from '@/types/api'

const DEFAULT_CHAT_BASE = 'http://127.0.0.1:8091'

export function getHalanChatApiBase(): string {
  const raw = import.meta.env.VITE_CHAT_API_BASE?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return DEFAULT_CHAT_BASE
}

export function isHalanAgentChatEnabled(): boolean {
  return import.meta.env.VITE_USE_HALAN_AGENT_CHAT === '1'
}

function useHalanSse(): boolean {
  return import.meta.env.VITE_HALAN_CHAT_SSE === '1'
}

export type HalanHistoryMessage = {
  message_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
  rating?: 'up' | 'down' | null
  feedback?: string | null
}

async function authHeaders(): Promise<HeadersInit> {
  const h: Record<string, string> = { Accept: 'application/json' }
  const token = await getToken()
  if (token) h.Authorization = `Bearer ${token}`
  return h
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
    /* keep */
  }
  return msg || `Request failed (${res.status})`
}

export async function halanCreateConversation(): Promise<string> {
  const base = getHalanChatApiBase()
  const headers = {
    ...(await authHeaders()),
    'Content-Type': 'application/json',
  }
  const res = await fetch(`${base}/conversations`, { method: 'POST', headers, body: '{}' })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const data = (await res.json()) as { conversation_id?: string }
  const id = data.conversation_id?.trim()
  if (!id) throw new Error('No conversation_id in POST /conversations response')
  return id
}

export function halanHistoryRowToChatMessage(m: HalanHistoryMessage): ChatMessage {
  return {
    id: `halan-${m.message_id}`,
    messageId: m.message_id,
    role: m.role,
    content: m.content,
    rating: m.rating ?? undefined,
    feedback: m.feedback ?? undefined,
  }
}

export async function halanFetchMessages(conversationId: string): Promise<HalanHistoryMessage[]> {
  const base = getHalanChatApiBase()
  const res = await fetch(
    `${base}/conversations/${encodeURIComponent(conversationId)}/messages`,
    { headers: await authHeaders() },
  )
  if (!res.ok) throw new Error(await readErrorMessage(res))
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) throw new Error('Expected array from GET /messages')
  return data as HalanHistoryMessage[]
}

type NonStreamBody = {
  reply?: string
  response?: string
  user_message_id?: number
  assistant_message_id?: number
  conversation_id?: string
}

export async function halanPostMessageNonStream(
  conversationId: string,
  userMessage: string,
  corpusId: string,
): Promise<NonStreamBody> {
  const base = getHalanChatApiBase()
  const headers = {
    ...(await authHeaders()),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const res = await fetch(`${base}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: userMessage, corpus_id: corpusId }),
  })
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return (await res.json()) as NonStreamBody
}

type SseAccum = {
  text: string
  userMessageId?: number
  assistantMessageId?: number
  streamConversationId?: string
}

function parseHalanSsePayload(payload: string, acc: SseAccum, onText?: (t: string) => void): void {
  if (!payload || payload === '[DONE]') return
  try {
    const j = JSON.parse(payload) as Record<string, unknown>
    if (j.phase === 'accepted' && typeof j.conversation_id === 'string' && j.conversation_id) {
      acc.streamConversationId = j.conversation_id
    }
    if (j.phase === 'done') {
      if (typeof j.user_message_id === 'number') acc.userMessageId = j.user_message_id
      if (typeof j.assistant_message_id === 'number') acc.assistantMessageId = j.assistant_message_id
      if (typeof j.conversation_id === 'string' && j.conversation_id) {
        acc.streamConversationId = j.conversation_id
      }
      return
    }
    let delta = ''
    if (typeof j.delta === 'string' && j.delta.length > 0) {
      delta = j.delta
    } else {
      const nested = j.delta
      if (
        nested &&
        typeof nested === 'object' &&
        typeof (nested as { content?: unknown }).content === 'string'
      ) {
        const c = (nested as { content: string }).content
        if (c) delta = c
      }
    }
    if (delta) {
      acc.text += delta
      onText?.(acc.text)
    }
  } catch {
    /* ignore bad chunk */
  }
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

async function halanPostMessageStream(
  conversationId: string,
  userMessage: string,
  corpusId: string,
  onAssistantText?: (accumulated: string) => void,
  signal?: AbortSignal,
): Promise<SseAccum> {
  const base = getHalanChatApiBase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  const token = await getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const url = `${base}/conversations/${encodeURIComponent(conversationId)}/messages/stream`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: userMessage, corpus_id: corpusId }),
    signal,
  })
  if (!res.ok) {
    const raw = await res.text()
    let msg = raw.slice(0, 500)
    try {
      const j = JSON.parse(raw) as { detail?: string; message?: string }
      msg = j.detail ?? j.message ?? msg
    } catch {
      /* keep */
    }
    throw new Error(msg || `Request failed (${res.status})`)
  }

  const acc: SseAccum = { text: '' }
  const handlePayload = (payload: string) => {
    parseHalanSsePayload(payload, acc, onAssistantText)
  }

  const reader = res.body?.getReader()
  if (!reader) {
    const raw = await res.text()
    for (const block of raw.split(/\r?\n\r?\n/)) {
      const lines = block.split(/\r?\n/)
      const merged = lines
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.replace(/^data:\s?/, ''))
        .join('\n')
        .trim()
      if (merged) handlePayload(merged)
    }
    return acc
  }

  const dec = new TextDecoder()
  let carry = ''
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {})
      break
    }
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

  return acc
}

export async function halanSubmitRating(
  conversationId: string,
  messageId: number,
  body: { rating: 'up' } | { rating: 'down'; feedback: string },
): Promise<void> {
  const base = getHalanChatApiBase()
  const headers = {
    ...(await authHeaders()),
    'Content-Type': 'application/json',
  }
  const res = await fetch(
    `${base}/conversations/${encodeURIComponent(conversationId)}/messages/${messageId}/rating`,
    { method: 'POST', headers, body: JSON.stringify(body) },
  )
  if (!res.ok) throw new Error(await readErrorMessage(res))
}

export type SendHalanChatMessageOptions = {
  onAssistantText?: (accumulated: string) => void
  signal?: AbortSignal
}

export async function sendHalanChatMessage(
  payload: ChatRequest,
  options?: SendHalanChatMessageOptions,
): Promise<ChatResponse> {
  const corpusId = resolveChatCorpusId(payload.corpus_id)
  let conversationId = payload.conversation_id?.trim() ?? ''
  if (!conversationId) {
    conversationId = await halanCreateConversation()
  }

  if (useHalanSse()) {
    const stream = await halanPostMessageStream(
      conversationId,
      payload.user_message,
      corpusId,
      options?.onAssistantText,
      options?.signal,
    )
    const finalId = stream.streamConversationId?.trim() || conversationId
    const reply = stream.text.trim() || '(Empty reply from stream.)'
    return {
      response: reply,
      conversation_id: finalId,
      user_message_id: stream.userMessageId,
      assistant_message_id: stream.assistantMessageId,
    }
  }

  const data = await halanPostMessageNonStream(conversationId, payload.user_message, corpusId)
  const finalId = data.conversation_id?.trim() || conversationId
  const reply =
    (typeof data.reply === 'string' && data.reply) ||
    (typeof data.response === 'string' && data.response) ||
    ''
  return {
    response: reply,
    conversation_id: finalId,
    user_message_id: data.user_message_id,
    assistant_message_id: data.assistant_message_id,
  }
}
