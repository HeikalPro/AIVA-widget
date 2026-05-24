/** Default `corpus_id` for chat POST bodies. Override with `VITE_HAIVA_CORPUS_ID`, `VITE_CHAT_CORPUS_ID`, or `ChatRequest.corpus_id`. */
export const CHAT_DEFAULT_CORPUS_ID = '2702A1FDE062414B8DAC1FF4347338F1'

/** Same resolution for legacy `/chat/`, HAIVA, and halan_agent_chat POST bodies. */
export function resolveChatCorpusId(corpus_id?: string): string {
  return (
    corpus_id?.trim() ||
    import.meta.env.VITE_HAIVA_CORPUS_ID?.trim() ||
    import.meta.env.VITE_CHAT_CORPUS_ID?.trim() ||
    CHAT_DEFAULT_CORPUS_ID
  )
}
