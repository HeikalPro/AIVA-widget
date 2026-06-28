import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { BrandLogo } from '@/components/BrandLogo'
import { Toast } from '@/components/Toast'
import { WindowChromeButtons } from '@/components/WindowChromeButtons'
import type { ChatMessage, KbSource } from '@/types/api'
import type { AccountUpdate } from '@/services/accountUpdatesClient'
import {
  assistantMarkdownSanitizeSchema,
  enhanceAssistantMarkdown,
} from '@/utils/enhanceAssistantMarkdown'
import {
  copyTextToClipboard,
  formatAsChat,
  formatAsEmail,
} from '@/utils/copyResponseFormats'

/** Speech bubble with plus — new conversation */
function IconNewChat({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M12 7v6M9 10h6" />
    </svg>
  )
}

/** Bell — account updates */
function IconUpdates({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

const headerIconBtn =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 outline-none transition-colors hover:border-gochat hover:bg-slate-50 hover:text-gochat focus-visible:ring-2 focus-visible:ring-gochat/30 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40'

const userBubbleClass =
  'user-chat-bubble max-w-[min(85vw,20rem)] rounded-2xl rounded-br-md border border-[#003D75] bg-[#0057A8] px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm'

function IconLogOut({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

function IconStop({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  )
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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

function IconExternalLink({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

function MessageKbSources({ sources }: { sources: KbSource[] }) {
  if (!sources.length) return null
  const sourceBtnClass =
    'no-drag inline-flex items-center gap-1.5 rounded-full border border-gochat/30 bg-[#0057A8]/10 px-3 py-1.5 text-[11px] font-semibold text-[#0057A8] shadow-sm transition-colors hover:border-gochat hover:bg-[#0057A8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gochat/40'
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-dashed border-gochat/25 bg-gochat/[0.04] px-2.5 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">KB source</span>
      {sources.map((s) => (
        <a
          key={s.parent_id}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open knowledge base article #${s.parent_id}\n${s.url}`}
          className={`${sourceBtnClass} group`}
        >
          <IconExternalLink className="shrink-0 opacity-90" />
          <span>Open article</span>
          <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-gochat group-hover:bg-white/20 group-hover:text-white">
            #{s.parent_id}
          </span>
        </a>
      ))}
    </div>
  )
}

function CopyFormatControls({ content }: { content: string }) {
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null,
  )

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(t)
  }, [toast])

  if (!content.trim()) return null

  async function handleCopy(kind: 'email' | 'chat') {
    const text = kind === 'email' ? formatAsEmail(content) : formatAsChat(content)
    try {
      await copyTextToClipboard(text)
      setToast({
        message: kind === 'email' ? 'Copied as email' : 'Copied as chat',
        variant: 'success',
      })
    } catch {
      setToast({ message: 'Could not copy to clipboard', variant: 'error' })
    }
  }

  const btnClass =
    'inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm transition-colors hover:border-gochat/40 hover:bg-slate-50 hover:text-gochat focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gochat/30 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Copy reply formats">
        <button type="button" className={btnClass} title="Copy with email formatting" onClick={() => void handleCopy('email')}>
          Copy as Email
        </button>
        <button type="button" className={btnClass} title="Copy with live-chat formatting" onClick={() => void handleCopy('chat')}>
          Copy as Chat
        </button>
      </div>
      <Toast message={toast?.message ?? null} variant={toast?.variant ?? 'info'} />
    </>
  )
}

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
    'inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35'
  const upActive = message.rating === 'up'
  const downActive = message.rating === 'down'

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div
        className="inline-flex items-center gap-0.5 rounded-full border-2 border-widget bg-white px-1 py-0.5 shadow-sm"
        aria-label="Rate this reply"
      >
        <button
          type="button"
          disabled={busy}
          title={upActive ? 'Rated helpful' : 'Helpful'}
          onClick={() => onThumbUp(mid)}
          className={`${baseBtn} ${
            upActive
              ? 'text-emerald-400 hover:bg-emerald-500/15'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <ThumbUpIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={busy}
          title={downActive ? 'Rated not helpful' : 'Not helpful'}
          onClick={() => onThumbDown(mid)}
          className={`${baseBtn} ${
            downActive
              ? 'text-rose-600 hover:bg-rose-50'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <ThumbDownIcon className="h-3.5 w-3.5" />
        </button>
        {busy && <span className="px-1 text-[10px] text-slate-500">…</span>}
      </div>
      {downActive && message.feedback?.trim() && (
        <details className="max-w-full text-right">
          <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-700">
            Your feedback
          </summary>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[10px] text-slate-600">
            {message.feedback}
          </p>
        </details>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border-2 border-widget bg-slate-50 px-3.5 py-2.5 shadow-sm">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-gochat-light/90"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-slate-600">Thinking…</span>
    </div>
  )
}

type Props = {
  messages: ChatMessage[]
  loading: boolean
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onNewConversation: () => void
  onLogout: () => void
  onCollapseChat: () => void
  ratingsEnabled?: boolean
  ratingBusyId?: number | null
  onThumbUp?: (messageId: number) => void
  onThumbDown?: (messageId: number) => void
  historyLoading?: boolean
  activeUpdateCount?: number
  accountUpdates?: AccountUpdate[]
  onViewUpdates?: () => void
}

export function ChatPanel({
  messages,
  loading,
  input,
  onInputChange,
  onSend,
  onStop,
  onNewConversation,
  onLogout,
  onCollapseChat,
  ratingsEnabled = false,
  ratingBusyId = null,
  onThumbUp = () => {},
  onThumbDown = () => {},
  historyLoading = false,
  activeUpdateCount = 0,
  accountUpdates = [],
  onViewUpdates = () => {},
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

  const canSend = !loading && input.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      title="Drag the header to move the window"
      className="flex h-full w-full min-w-0 flex-col rounded-2xl border border-widget-strong bg-white"
    >
      <header className="drag relative flex shrink-0 cursor-move select-none items-center gap-3 border-b border-widget-strong bg-white px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-widget-strong bg-white p-0.5">
            <BrandLogo className="h-full w-full object-contain" alt="" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900">GoChat247</p>
            <p className="truncate text-[10px] font-medium text-gochat">AI assistant</p>
          </div>
        </div>
        <div className="no-drag flex shrink-0 items-center gap-0.5">
          {activeUpdateCount > 0 && (
            <button
              type="button"
              onClick={onViewUpdates}
              title={`${activeUpdateCount} account update${activeUpdateCount === 1 ? '' : 's'}`}
              aria-label={`View ${activeUpdateCount} account update${activeUpdateCount === 1 ? '' : 's'}`}
              className={`${headerIconBtn} relative border-amber-400 bg-amber-50 text-amber-800 hover:border-amber-500 hover:bg-amber-100 hover:text-amber-900`}
            >
              <IconUpdates className="h-[18px] w-[18px] shrink-0" />
              <span
                className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
                aria-hidden
              >
                {activeUpdateCount > 9 ? '9+' : activeUpdateCount}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onNewConversation}
            disabled={loading}
            title="New chat"
            aria-label="Start new chat"
            className={headerIconBtn}
          >
            <IconNewChat className="h-[18px] w-[18px] shrink-0" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
            className={headerIconBtn}
          >
            <IconLogOut className="h-[18px] w-[18px] shrink-0 stroke-[1.75]" />
          </button>
          <div className="ml-0.5 border-l border-widget-strong pl-1">
            <WindowChromeButtons
              firstButtonAriaLabel="Minimize chat"
              onMinimize={onCollapseChat}
              onClose={onCollapseChat}
            />
          </div>
        </div>
      </header>

      <div className="no-drag relative min-h-0 flex-1 overflow-y-auto bg-white px-3.5 py-3 [scrollbar-color:rgba(148,163,184,0.6)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="relative space-y-3">
          {historyLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-gochat" />
              Loading conversation…
            </div>
          )}

          {!historyLoading && messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              {accountUpdates.length > 0 && (
                <div className="mb-4 w-full max-w-[18rem] space-y-2 text-left">
                  {accountUpdates.slice(0, 3).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={onViewUpdates}
                      className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition-colors hover:border-amber-300 hover:bg-amber-100/80"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        New update{u.account_name ? ` · ${u.account_name}` : ''}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{u.title}</p>
                    </button>
                  ))}
                  {activeUpdateCount > 3 && (
                    <button
                      type="button"
                      onClick={onViewUpdates}
                      className="w-full text-xs font-medium text-gochat hover:underline"
                    >
                      View {activeUpdateCount - 3} more update{activeUpdateCount - 3 === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
              )}
              <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-widget-strong bg-white p-1.5 shadow-sm">
                <BrandLogo className="h-full w-full object-contain" alt="" />
              </div>
              <p className="text-sm font-medium text-slate-800">How can I help?</p>
              <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-slate-600">
                Ask a question about your knowledge base or start a new topic.
              </p>
            </div>
          )}

          {messages.flatMap((m) => {
            const rowKey = m.messageId != null ? `mid-${m.messageId}` : m.id
            const isUser = m.role === 'user'
            if (isUser) {
              return [
                <div
                  key={rowKey}
                  className="ml-auto flex max-w-[min(92%,30rem)] flex-col items-end"
                >
                  <div className={userBubbleClass}>
                    <p className="whitespace-pre-wrap break-words text-white" dir="auto">
                      {m.content}
                    </p>
                  </div>
                </div>,
              ]
            }

            return [
              <div
                key={rowKey}
                className="mr-auto flex w-full max-w-[min(92%,30rem)] flex-col items-start"
              >
                <span className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  GoChat247
                </span>
                <div className="w-full rounded-2xl border border-widget bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
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
                </div>
                <div className="mt-1.5 flex w-full flex-col gap-1.5">
                  {m.sources && m.sources.length > 0 && <MessageKbSources sources={m.sources} />}
                  <div className="flex w-full flex-wrap items-center gap-2">
                    <CopyFormatControls content={m.content} />
                    <MessageRatingControls
                      message={m}
                      ratingsEnabled={ratingsEnabled}
                      ratingBusyId={ratingBusyId}
                      onThumbUp={onThumbUp}
                      onThumbDown={onThumbDown}
                    />
                  </div>
                </div>
              </div>,
            ]
          })}

          {loading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="mr-auto">
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="no-drag shrink-0 border-t border-widget-strong bg-white px-3 pb-3 pt-2.5">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-400 bg-white p-1.5 shadow-sm focus-within:border-gochat focus-within:outline-none">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Ask anything…"
            className="no-drag max-h-28 min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent px-2.5 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
          />
          {loading ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop response"
              aria-label="Stop response"
              className="login-primary-btn mb-0.5 inline-flex h-9 w-9 shrink-0 appearance-none items-center justify-center rounded-xl border border-rose-700 bg-rose-600 text-white shadow-sm outline-none transition-all hover:bg-rose-500"
            >
              <IconStop className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              title="Send (Enter)"
              className="login-primary-btn mb-0.5 inline-flex h-9 w-9 shrink-0 appearance-none items-center justify-center rounded-xl border border-gochat-dark bg-[#0057A8] text-white shadow-gochat outline-none transition-all hover:bg-gochat-light disabled:cursor-not-allowed disabled:border-slate-300 disabled:!bg-slate-200 disabled:!text-slate-400 disabled:shadow-none"
            >
              <IconSend className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-500">
          {loading ? 'Stop ends the stream on your side' : 'Enter to send · Shift+Enter for new line'}
        </p>
      </div>
    </motion.div>
  )
}
