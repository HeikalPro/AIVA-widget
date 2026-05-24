/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** If `1`, skip token gate and open chat (HAIVA has no login). */
  readonly VITE_SKIP_LOGIN?: string
  /** If `1`, use halan_agent_chat on `VITE_CHAT_API_BASE` (default http://127.0.0.1:8091). */
  readonly VITE_USE_HALAN_AGENT_CHAT?: string
  /** Base URL for halan_agent_chat (no trailing slash). */
  readonly VITE_CHAT_API_BASE?: string
  /** If `1`, halan chat uses POST …/messages/stream (SSE); else JSON POST …/messages */
  readonly VITE_HALAN_CHAT_SSE?: string
  /** If `1`, use HAIVA routes: POST /conversations, POST /conversations/:id/messages */
  readonly VITE_USE_HAIVA_CHAT?: string
  /** Optional corpus for HAIVA message body (`corpus_id`). */
  readonly VITE_HAIVA_CORPUS_ID?: string
  /** Optional corpus for legacy `/chat/` POST (`corpus_id`). */
  readonly VITE_CHAT_CORPUS_ID?: string
  /** Optional HAIVA `route` (e.g. kb_search, general, auto). */
  readonly VITE_HAIVA_MESSAGE_ROUTE?: string
  /** Optional HAIVA `search_query` when using kb_search route. */
  readonly VITE_HAIVA_SEARCH_QUERY?: string
  /** Default `/login` */
  readonly VITE_API_LOGIN_PATH?: string
  /** Default `/chat/` */
  readonly VITE_API_CHAT_PATH?: string
  /** If `1`, login POST body is only username + password (no grant_type/scope). */
  readonly VITE_LOGIN_MINIMAL_BODY?: string
  /** Chat: e.g. `openai` — sent as `model_provider` when not set on `ChatRequest`. */
  readonly VITE_CHAT_MODEL_PROVIDER?: string
  /** Chat: comma-separated prompt ids, e.g. `213` or `213,214` — sent as `channel_prompt_ids`. */
  readonly VITE_CHAT_CHANNEL_PROMPT_IDS?: string
  /** Chat: default `system_message` when not set on `ChatRequest`. */
  readonly VITE_CHAT_SYSTEM_MESSAGE?: string
  /** Chat: comma-separated file UUIDs — used as `selected_file_ids` when the request omits that field. */
  readonly VITE_CHAT_SELECTED_FILE_IDS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
