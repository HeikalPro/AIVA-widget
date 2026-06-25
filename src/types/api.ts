export type LoginResponse = {
  access_token: string
  token_type: string
  refresh_token?: string
}

export type ChatRequest = {
  user_message: string
  conversation_id?: string
  /** Knowledge-base corpus UUID; falls back to env then `CHAT_DEFAULT_CORPUS_ID`. */
  corpus_id?: string
  /** Omit to use `VITE_CHAT_SELECTED_FILE_IDS` when set. */
  selected_file_ids?: string[]
  system_message?: string
  /** Omit to use `VITE_CHAT_CHANNEL_PROMPT_IDS` (comma-separated ints) when set. */
  channel_prompt_ids?: number[]
  /** Omit to use `VITE_CHAT_MODEL_PROVIDER` when set. */
  model_provider?: string
}

export type KbSource = {
  parent_id: string
  url: string
}

export type ChatResponse = {
  response: string
  conversation_id: string
  /** halan_agent_chat: from non-stream POST or SSE `phase: done`. */
  user_message_id?: number
  assistant_message_id?: number
  sources?: KbSource[]
}

export type MessageRating = 'up' | 'down'

export type ChatMessage = {
  /** Stable React key; prefer `halan-${messageId}` when `messageId` is set. */
  id: string
  /** Server message id (halan_agent_chat); required for ratings. */
  messageId?: number
  role: 'user' | 'assistant'
  content: string
  /** From GET history or after successful rating. */
  rating?: MessageRating | null
  feedback?: string | null
  /** KB article links (external_parent_id) for assistant replies. */
  sources?: KbSource[]
}
