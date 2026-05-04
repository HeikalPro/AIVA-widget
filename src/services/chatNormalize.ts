/**
 * FastAPI `/chat/` often returns undocumented JSON. Map common shapes so UI + thread id work.
 */

export type NormalizedChat = {
  response: string
  conversation_id: string
}

const TEXT_KEYS = [
  'response',
  'message',
  'answer',
  'content',
  'assistant_message',
  'assistantMessage',
  'reply',
  'text',
  'output',
  'result',
]

const CONV_KEYS = [
  'conversation_id',
  'conversationId',
  'conversation_uuid',
  'conversationUuid',
  'chat_id',
  'chatId',
]

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return undefined
}

function pickConversationId(obj: Record<string, unknown>): string | undefined {
  for (const k of CONV_KEYS) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'number' && !Number.isNaN(v)) return String(v)
  }
  return undefined
}

function walkForString(root: unknown, keys: string[], depth = 0): string | undefined {
  if (depth > 4 || !root || typeof root !== 'object') return undefined
  const o = root as Record<string, unknown>
  const direct = pickString(o, keys)
  if (direct !== undefined) return direct
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') {
      const found = walkForString(v, keys, depth + 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function walkForConversationId(root: unknown, depth = 0): string | undefined {
  if (depth > 4 || !root || typeof root !== 'object') return undefined
  const o = root as Record<string, unknown>
  const direct = pickConversationId(o)
  if (direct !== undefined) return direct
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object') {
      const found = walkForConversationId(v, depth + 1)
      if (found !== undefined) return found
    }
  }
  return undefined
}

export function normalizeChatResponse(raw: unknown): NormalizedChat {
  if (raw === null || raw === undefined) {
    return { response: '', conversation_id: '' }
  }

  if (typeof raw === 'string') {
    return { response: raw, conversation_id: '' }
  }

  if (typeof raw !== 'object') {
    return { response: String(raw), conversation_id: '' }
  }

  const o = raw as Record<string, unknown>

  let response =
    pickString(o, TEXT_KEYS) ??
    walkForString(raw, TEXT_KEYS) ??
    ''

  // Some APIs nest assistant text
  if (!response && typeof o.messages === 'object' && o.messages !== null) {
    const msgs = o.messages as unknown
    if (Array.isArray(msgs) && msgs.length > 0) {
      const last = msgs[msgs.length - 1]
      if (last && typeof last === 'object') {
        const lm = last as Record<string, unknown>
        response =
          pickString(lm, ['content', 'text', 'message', 'body']) ??
          (typeof lm.content === 'string' ? lm.content : '')
      }
    }
  }

  let conversation_id =
    pickConversationId(o) ??
    walkForConversationId(raw) ??
    ''

  if (!conversation_id && typeof o.conversation === 'object' && o.conversation !== null) {
    const c = o.conversation as Record<string, unknown>
    conversation_id =
      pickConversationId(c) ?? pickString(c, ['id', 'conversation_id', 'conversationId']) ?? ''
  }

  return {
    response: response.trim(),
    conversation_id: conversation_id ? String(conversation_id) : '',
  }
}
