import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatPanel } from '@/components/ChatPanel'
import { FloatingWidget } from '@/components/FloatingWidget'
import { LoginForm } from '@/components/LoginForm'
import { ZohoCallbackView } from '@/components/ZohoCallbackView'
import { isZohoCallbackRoute } from '@/services/zohoAuth'
import { MessageFeedbackModal } from '@/components/MessageFeedbackModal'
import { Toast } from '@/components/Toast'
import { useAuth } from '@/hooks/useAuth'
import {
  assertApiBaseUrl,
  isAivaSessionChatEnabled,
  isHalanAgentChatEnabled,
  sendChatMessage,
  usesAssistantStreamPlaceholder,
} from '@/services/api'
import {
  aivaCreateSession,
  aivaFetchSessionMessages,
} from '@/services/aivaSessionChatClient'
import {
  halanFetchMessages,
  halanHistoryRowToChatMessage,
  halanSubmitRating,
} from '@/services/halanChatClient'
import {
  ASSISTANT_BUBBLE_PX,
  getStoredChatLayout,
  setStoredChatWindowBounds,
} from '@/services/chatWindowSize'
import {
  clearStoredConversationId,
  getStoredConversationId,
  setStoredConversationId,
} from '@/services/conversation'
import type { ChatMessage } from '@/types/api'

export function App() {
  const { state, setAuthenticated, logout } = useAuth()
  const authRef = useRef(state)
  useEffect(() => {
    authRef.current = state
  }, [state])

  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ratingBusyId, setRatingBusyId] = useState<number | null>(null)
  const [rateDownMessageId, setRateDownMessageId] = useState<number | null>(null)
  const [rateDownInitialFeedback, setRateDownInitialFeedback] = useState<string>('')
  const [ratingModalSubmitting, setRatingModalSubmitting] = useState(false)
  /** Mirrors session/local storage so follow-up sends always reuse thread (axios + IPC timing). */
  const conversationIdRef = useRef<string | null>(null)
  const chatOpenRef = useRef(chatOpen)
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  useEffect(() => {
    assertApiBaseUrl()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (state !== 'authenticated') return

    if (isHalanAgentChatEnabled()) {
      const cid = getStoredConversationId()
      conversationIdRef.current = cid
      if (!cid) return

      let cancelled = false
      setHistoryLoading(true)
      void halanFetchMessages(cid)
        .then((rows) => {
          if (cancelled) return
          if (getStoredConversationId() !== cid) return
          setMessages(rows.map(halanHistoryRowToChatMessage))
        })
        .catch(() => {
          if (cancelled) return
          clearStoredConversationId()
          conversationIdRef.current = null
        })
        .finally(() => {
          if (!cancelled) setHistoryLoading(false)
        })

      return () => {
        cancelled = true
      }
    }

    if (!isAivaSessionChatEnabled()) return

    const sid = getStoredConversationId()
    conversationIdRef.current = sid
    if (!sid) return

    let cancelled = false
    setHistoryLoading(true)
    void aivaFetchSessionMessages(sid)
      .then((rows) => {
        if (cancelled) return
        if (getStoredConversationId() !== sid) return
        setMessages(rows)
      })
      .catch(() => {
        if (cancelled) return
        clearStoredConversationId()
        conversationIdRef.current = null
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [state])

  const applyAssistantCollapsed = useCallback(async () => {
    const cur = await window.nexa.window.getBounds()
    if (!cur) {
      await window.nexa.window.setAssistantCollapsed()
      return
    }
    const isExpanded =
      cur.width > ASSISTANT_BUBBLE_PX + 8 || cur.height > ASSISTANT_BUBBLE_PX + 8
    if (isExpanded) {
      const x = cur.x + cur.width - ASSISTANT_BUBBLE_PX
      const y = cur.y + cur.height - ASSISTANT_BUBBLE_PX
      await window.nexa.window.setAssistantCollapsed({
        bounds: { x, y, width: ASSISTANT_BUBBLE_PX, height: ASSISTANT_BUBBLE_PX },
        animate: true,
      })
    } else {
      await window.nexa.window.setAssistantCollapsed()
    }
  }, [])

  const applyAssistantExpanded = useCallback(async () => {
    const cur = await window.nexa.window.getBounds()
    const layout = getStoredChatLayout()
    const defaultW = 400
    const defaultH = 620
    let w = defaultW
    let h = defaultH
    if (layout?.mode === 'bounds') {
      w = layout.bounds.width
      h = layout.bounds.height
    } else if (layout?.mode === 'size') {
      w = layout.width
      h = layout.height
    }

    const isBubble =
      cur != null &&
      cur.width <= ASSISTANT_BUBBLE_PX + 8 &&
      cur.height <= ASSISTANT_BUBBLE_PX + 8

    if (isBubble && cur) {
      const x = cur.x + cur.width - w
      const y = cur.y + cur.height - h
      await window.nexa.window.setAssistantExpanded({
        bounds: { x, y, width: w, height: h },
        animate: true,
      })
      return
    }

    if (layout?.mode === 'bounds') {
      await window.nexa.window.setAssistantExpanded({ bounds: layout.bounds, animate: false })
    } else if (layout?.mode === 'size') {
      if (cur && (cur.width > ASSISTANT_BUBBLE_PX + 8 || cur.height > ASSISTANT_BUBBLE_PX + 8)) {
        const x = cur.x + cur.width - layout.width
        const y = cur.y + cur.height - layout.height
        await window.nexa.window.setAssistantExpanded({
          bounds: { x, y, width: layout.width, height: layout.height },
          animate: false,
        })
      } else {
        await window.nexa.window.setAssistantExpanded({
          width: layout.width,
          height: layout.height,
          animate: false,
        })
      }
    } else {
      await window.nexa.window.setAssistantExpanded()
    }
  }, [])

  const applyLoginMode = useCallback(async () => {
    await window.nexa.window.setLoginMode()
  }, [])

  useEffect(() => {
    if (state === 'authenticated') {
      conversationIdRef.current = getStoredConversationId()
      void applyAssistantCollapsed()
    }
  }, [state, applyAssistantCollapsed])

  useEffect(() => {
    if (state !== 'authenticated') return
    if (chatOpen) {
      void applyAssistantExpanded()
    } else {
      void applyAssistantCollapsed()
    }
  }, [chatOpen, state, applyAssistantCollapsed, applyAssistantExpanded])

  useEffect(() => {
    const unLogout = window.nexa.on('nexa:logout-request', async () => {
      clearStoredConversationId()
      conversationIdRef.current = null
      setMessages([])
      await logout()
      setChatOpen(false)
      await applyLoginMode()
    })
    const unTray = window.nexa.on('nexa:tray-open', () => {
      if (authRef.current === 'authenticated') {
        setChatOpen(true)
      }
    })
    return () => {
      unLogout()
      unTray()
    }
  }, [applyLoginMode, logout])

  useEffect(() => {
    const onSession = () => {
      void (async () => {
        clearStoredConversationId()
        conversationIdRef.current = null
        setMessages([])
        await logout()
        setChatOpen(false)
        await applyLoginMode()
      })()
    }
    window.addEventListener('nexa:session-expired', onSession)
    return () => window.removeEventListener('nexa:session-expired', onSession)
  }, [applyLoginMode, logout])

  useEffect(() => {
    if (!chatOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChatOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatOpen])

  /** Persist chat window position + size when moved or resized (main process → IPC). */
  useEffect(() => {
    const un = window.nexa.on('nexa:window-bounds', (...args: unknown[]) => {
      if (!chatOpenRef.current) return
      const b = args[0] as { x: number; y: number; width: number; height: number }
      if (!b || typeof b.width !== 'number' || typeof b.height !== 'number') return
      // Ignore collapsed bubble / login-sized windows
      if (b.width < 260 || b.height < 340) return
      setStoredChatWindowBounds(b)
    })
    return un
  }, [])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    const streamUi = usesAssistantStreamPlaceholder()
    const halan = isHalanAgentChatEnabled()
    const userTempId = crypto.randomUUID()
    const assistantMsgId = streamUi ? crypto.randomUUID() : ''
    const assistantPlaceholder: ChatMessage | null = streamUi
      ? { id: assistantMsgId, role: 'assistant', content: '' }
      : null

    const userMsg: ChatMessage = { id: userTempId, role: 'user', content: text }

    setInput('')
    setMessages((m) => (assistantPlaceholder ? [...m, userMsg, assistantPlaceholder] : [...m, userMsg]))
    setLoading(true)
    try {
      const cid = conversationIdRef.current ?? getStoredConversationId() ?? undefined
      const res = await sendChatMessage(
        {
          user_message: text,
          conversation_id: cid,
        },
        streamUi
          ? {
              onHaivaAssistantText: (acc) => {
                setMessages((m) =>
                  m.map((x) => (x.id === assistantMsgId ? { ...x, content: acc } : x)),
                )
              },
            }
          : undefined,
      )
      if (res.conversation_id) {
        conversationIdRef.current = res.conversation_id
        setStoredConversationId(res.conversation_id)
      }
      const reply =
        res.response ||
        '(No assistant text in JSON — open DevTools → Network → /chat/ response.)'

      if (halan) {
        const uid = res.user_message_id
        const aid = res.assistant_message_id
        const replyText =
          reply ||
          (streamUi ? '(Empty reply from stream.)' : '(Empty reply.)')
        if (streamUi && assistantPlaceholder) {
          setMessages((m) =>
            m.map((x) => {
              if (x.id === userTempId) {
                return {
                  ...x,
                  id: uid != null ? `halan-${uid}` : x.id,
                  messageId: uid ?? x.messageId,
                }
              }
              if (x.id === assistantMsgId) {
                return {
                  ...x,
                  id: aid != null ? `halan-${aid}` : x.id,
                  messageId: aid ?? x.messageId,
                  content: replyText,
                }
              }
              return x
            }),
          )
        } else {
          setMessages((m) => [
            ...m.map((x) =>
              x.id === userTempId
                ? {
                    ...x,
                    id: uid != null ? `halan-${uid}` : x.id,
                    messageId: uid ?? x.messageId,
                  }
                : x,
            ),
            {
              id: aid != null ? `halan-${aid}` : crypto.randomUUID(),
              messageId: aid,
              role: 'assistant',
              content: replyText,
            },
          ])
        }

        if (
          res.conversation_id &&
          (res.assistant_message_id == null || res.user_message_id == null)
        ) {
          try {
            const rows = await halanFetchMessages(res.conversation_id)
            setMessages(rows.map(halanHistoryRowToChatMessage))
          } catch {
            /* keep messages from send response */
          }
        }
      } else if (streamUi && assistantPlaceholder) {
        setMessages((m) =>
          m.map((x) => (x.id === assistantMsgId ? { ...x, content: reply } : x)),
        )
      } else {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }])
      }
    } catch (e) {
      const errText = `Error: ${e instanceof Error ? e.message : 'Request failed'}`
      if (streamUi && assistantPlaceholder) {
        setMessages((m) =>
          m.map((x) => (x.id === assistantMsgId ? { ...x, content: errText } : x)),
        )
      } else {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: errText,
          },
        ])
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleThumbUp(messageId: number) {
    const cid = conversationIdRef.current ?? getStoredConversationId()
    if (!cid) return
    setRatingBusyId(messageId)
    try {
      await halanSubmitRating(cid, messageId, { rating: 'up' })
      setMessages((m) =>
        m.map((x) =>
          x.messageId === messageId ? { ...x, rating: 'up', feedback: null } : x,
        ),
      )
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not save rating')
    } finally {
      setRatingBusyId(null)
    }
  }

  async function handleDownModalSubmit(feedback: string) {
    const mid = rateDownMessageId
    const cid = conversationIdRef.current ?? getStoredConversationId()
    if (mid == null || !cid) return
    setRatingModalSubmitting(true)
    try {
      const trimmed = feedback.trim()
      await halanSubmitRating(cid, mid, { rating: 'down', feedback: trimmed })
      setMessages((m) =>
        m.map((x) =>
          x.messageId === mid ? { ...x, rating: 'down', feedback: trimmed } : x,
        ),
      )
      setRateDownMessageId(null)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not save feedback')
    } finally {
      setRatingModalSubmitting(false)
    }
  }

  function handleLoginSuccess() {
    clearStoredConversationId()
    conversationIdRef.current = null
    setMessages([])
    setAuthenticated()
  }

  async function handleLogout() {
    await window.nexa.app.logout()
  }

  function handleNewConversation() {
    clearStoredConversationId()
    conversationIdRef.current = null
    setMessages([])
    if (isAivaSessionChatEnabled()) {
      void aivaCreateSession()
        .then((sid) => {
          conversationIdRef.current = sid
          setStoredConversationId(sid)
        })
        .catch((e) => {
          setToast(e instanceof Error ? e.message : 'Could not start a new session')
        })
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  if (state === 'unauthenticated') {
    if (isZohoCallbackRoute()) {
      return (
        <ZohoCallbackView
          onSuccess={handleLoginSuccess}
          onError={() => {
            window.history.replaceState({}, '', '/')
          }}
        />
      )
    }
    return <LoginForm onSuccess={handleLoginSuccess} />
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <AnimatePresence mode="wait">
        {chatOpen ? (
          <motion.div
            key="open"
            className="relative flex h-full w-full flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ChatPanel
              messages={messages}
              loading={loading}
              input={input}
              onInputChange={setInput}
              onSend={() => void handleSend()}
              onNewConversation={handleNewConversation}
              onLogout={() => void handleLogout()}
              onCollapseChat={() => setChatOpen(false)}
              ratingsEnabled={isHalanAgentChatEnabled()}
              ratingBusyId={ratingBusyId}
              onThumbUp={(id) => void handleThumbUp(id)}
              onThumbDown={(id) => {
                const existing = messages.find((x) => x.messageId === id)?.feedback ?? ''
                setRateDownInitialFeedback(existing)
                setRateDownMessageId(id)
              }}
              historyLoading={historyLoading}
            />
            <MessageFeedbackModal
              open={rateDownMessageId != null}
              submitting={ratingModalSubmitting}
              initialFeedback={rateDownInitialFeedback}
              onClose={() => !ratingModalSubmitting && setRateDownMessageId(null)}
              onSubmit={(fb) => void handleDownModalSubmit(fb)}
            />
            <Toast message={toast} />
          </motion.div>
        ) : (
          <motion.div
            key="closed"
            className="h-full w-full overflow-hidden rounded-full bg-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <FloatingWidget onOpen={() => setChatOpen(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
