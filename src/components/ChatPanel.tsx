import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { WindowChromeButtons } from '@/components/WindowChromeButtons'
import type { ChatMessage } from '@/types/api'
import {
  assistantMarkdownSanitizeSchema,
  enhanceAssistantMarkdown,
} from '@/utils/enhanceAssistantMarkdown'

function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
    </svg>
  )
}

function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  )
}

/** Shown only under assistant bubbles — separate from the bordered answer card. */
function MessageRatingControls({
  message,
  ratingsEnabled,
  ratingBusyId,
  onThumbUp,
  onThumbDown,
}: {
  message: ChatMessage
  ratingsEnabled: boolean
  ratingBusyId: number | null
  onThumbUp: (messageId: number) => void
  onThumbDown: (messageId: number) => void
}) {
  const mid = message.messageId
  if (!ratingsEnabled || mid == null || !message.content.trim()) return null

  const busy = ratingBusyId === mid

  const baseBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35'

  const upActive = message.rating === 'up'
  const downActive = message.rating === 'down'

  return (
    <div className="flex w-full flex-col items-end gap-1">
      <div
        className="inline-flex items-center gap-0.5 rounded-xl border border-white/[0.1] bg-zinc-900/65 px-1 py-0.5 shadow-sm backdrop-blur-sm"
        aria-label="Rate this reply"
      >
        {/* Thumb Up — green when selected; click again to switch */}
        <button
          type="button"
          disabled={busy}
          title={upActive ? 'Rated helpful — click to change' : 'Helpful'}
          onClick={() => onThumbUp(mid)}
          className={`${baseBtn} ${
            upActive
              ? 'text-green-400 hover:bg-green-500/20 hover:text-green-300'
              : 'text-zinc-400 hover:bg-zinc-600/50 hover:text-zinc-100'
          }`}
        >
          <ThumbUpIcon />
        </button>

        {/* Thumb Down — red when selected; click again to edit feedback */}
        <button
          type="button"
          disabled={busy}
          title={downActive ? 'Rated not helpful — click to edit' : 'Not helpful'}
          onClick={() => onThumbDown(mid)}
          className={`${baseBtn} ${
            downActive
              ? 'text-red-400 hover:bg-red-500/20 hover:text-red-300'
              : 'text-zinc-400 hover:bg-zinc-600/50 hover:text-zinc-100'
          }`}
        >
          <ThumbDownIcon />
        </button>

        {busy && <span className="px-1 text-[10px] text-zinc-400">…</span>}
      </div>

      {downActive && message.feedback?.trim() && (
        <details className="max-w-full text-right">
          <summary className="cursor-pointer text-[10px] text-zinc-500 hover:text-zinc-400">
            Your feedback (click to edit ↑)
          </summary>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] text-zinc-400">
            {message.feedback}
          </p>
        </details>
      )}
    </div>
  )
}

type Props = {
  messages: ChatMessage[]
  loading: boolean
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  /** Clear thread and history; next message starts a new conversation. */
  onNewConversation: () => void
  onLogout: () => void
  /** − button: collapse expanded chat back to the floating bubble (same as Escape). */
  onCollapseChat: () => void
  /** halan_agent_chat message ratings */
  ratingsEnabled?: boolean
  ratingBusyId?: number | null
  onThumbUp?: (messageId: number) => void
  onThumbDown?: (messageId: number) => void
  historyLoading?: boolean
}

export function ChatPanel({
  messages,
  loading,
  input,
  onInputChange,
  onSend,
  onNewConversation,
  onLogout,
  onCollapseChat,
  ratingsEnabled = false,
  ratingBusyId = null,
  onThumbUp = () => {},
  onThumbDown = () => {},
  historyLoading = false,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ type: 'spring', stiffness: 440, damping: 36 }}
      title="Drag the header to move. − closes chat, × quits the app."
      className="flex h-full w-full min-w-0 flex-col overflow-hidden border border-white/[0.08] bg-zinc-950/55 shadow-none backdrop-blur-2xl"
    >
      {/* `-webkit-app-region: drag` — move frameless window; buttons use `no-drag` */}
      <header className="drag flex shrink-0 cursor-move select-none items-center gap-3 border-b border-white/[0.08] bg-zinc-950/78 px-4 py-3 backdrop-blur-xl">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-zinc-100">
          Aiva
        </span>
        <div className="no-drag flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onNewConversation}
            disabled={loading}
            title="Start a new thread"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800/80 hover:text-zinc-200"
          >
            Log out
          </button>
          <WindowChromeButtons
            firstButtonAriaLabel="Close chat"
            onMinimize={onCollapseChat}
            onClose={() => void window.nexa.app.quit()}
          />
        </div>
      </header>

      <div className="no-drag min-h-0 flex-1 space-y-3 overflow-y-auto bg-zinc-950/25 px-3.5 py-3 [scrollbar-color:rgba(63,63,70,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-600/50 [&::-webkit-scrollbar-track]:bg-transparent">
        {historyLoading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-violet-400" />
            Loading conversation…
          </div>
        )}
        {messages.flatMap((m) => {
          const rowKey = m.messageId != null ? `mid-${m.messageId}` : m.id
          const isUser = m.role === 'user'
          const bubble = (
            <div
              key={rowKey}
              className={`flex max-w-[min(92%,30rem)] flex-col ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              <div
                className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  isUser
                    ? 'w-fit max-w-[min(85vw,20rem)] bg-violet-600/95 text-white backdrop-blur-sm'
                    : 'w-full border border-white/[0.1] bg-zinc-800/55 text-zinc-100 backdrop-blur-md'
                }`}
              >
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                ) : (
                  <div className="markdown-body break-words" dir="auto">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[
                        rehypeRaw,
                        [rehypeSanitize, assistantMarkdownSanitizeSchema],
                      ]}
                    >
                      {enhanceAssistantMarkdown(m.content)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )
          if (isUser) return [bubble]
          return [
            bubble,
            <div
              key={`${rowKey}-fb`}
              className="mr-auto flex w-full max-w-[min(92%,30rem)] justify-end"
            >
              <MessageRatingControls
                message={m}
                ratingsEnabled={ratingsEnabled}
                ratingBusyId={ratingBusyId}
                onThumbUp={onThumbUp}
                onThumbDown={onThumbDown}
              />
            </div>,
          ]
        })}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-500 border-t-violet-400" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Single composer block so input + Send read as one control */}
      <div className="no-drag shrink-0 border-t border-white/[0.08] bg-zinc-950/72 p-2 backdrop-blur-xl">
        <div className="overflow-hidden rounded-lg border border-white/[0.12] bg-zinc-900/72 backdrop-blur-xl">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Message… (Enter to send, Shift+Enter for newline)"
            className="no-drag min-h-[2.75rem] w-full resize-none border-0 bg-transparent px-2.5 py-2 text-sm leading-snug text-zinc-100 outline-none ring-0 placeholder:text-zinc-500 focus:ring-0"
          />
          <div className="border-t border-white/[0.1] bg-zinc-900/78 px-2 pb-1.5 pt-1 backdrop-blur-md">
            <button
              type="button"
              onClick={onSend}
              disabled={loading || !input.trim()}
              className="no-drag w-full rounded-md bg-violet-600 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
