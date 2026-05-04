export type LoginResponse = {
  access_token: string
  token_type: string
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

export type ChatResponse = {
  response: string
  conversation_id: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}
