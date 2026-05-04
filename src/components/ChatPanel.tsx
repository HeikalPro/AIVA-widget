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
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'ml-auto w-fit max-w-[min(85%,20rem)] bg-violet-600/95 text-white backdrop-blur-sm'
                : 'mr-auto max-w-[min(92%,30rem)] border border-white/[0.1] bg-zinc-800/55 text-zinc-100 backdrop-blur-md'
            }`}
          >
            {m.role === 'user' ? (
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
        ))}
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
