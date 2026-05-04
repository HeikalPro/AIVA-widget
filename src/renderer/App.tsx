import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatPanel } from '@/components/ChatPanel'
import { FloatingWidget } from '@/components/FloatingWidget'
import { LoginForm } from '@/components/LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { assertApiBaseUrl, isHaivaChatEnabled, sendChatMessage } from '@/services/api'
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
  /** Mirrors session/local storage so follow-up sends always reuse thread (axios + IPC timing). */
  const conversationIdRef = useRef<string | null>(null)
  const chatOpenRef = useRef(chatOpen)
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  useEffect(() => {
    assertApiBaseUrl()
  }, [])

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
    const unBlur = window.nexa.on('nexa:blur', () => {
      setChatOpen(false)
    })
    const unLogout = window.nexa.on('nexa:logout-request', async () => {
      clearStoredConversationId()
      conversationIdRef.current = null
      setMessages([])
      setChatOpen(false)
      await logout()
      await applyLoginMode()
    })
    const unTray = window.nexa.on('nexa:tray-open', () => {
      if (authRef.current === 'authenticated') {
        setChatOpen(true)
      }
    })
    return () => {
      unBlur()
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
        setChatOpen(false)
        await logout()
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
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    const haiva = isHaivaChatEnabled()
    const assistantMsgId = haiva ? crypto.randomUUID() : ''
    const assistantPlaceholder: ChatMessage | null = haiva
      ? { id: assistantMsgId, role: 'assistant', content: '' }
      : null

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
        haiva
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
      if (haiva && assistantPlaceholder) {
        setMessages((m) =>
          m.map((x) => (x.id === assistantMsgId ? { ...x, content: reply } : x)),
        )
      } else {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply }])
      }
    } catch (e) {
      const errText = `Error: ${e instanceof Error ? e.message : 'Request failed'}`
      if (haiva && assistantPlaceholder) {
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
  }

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  if (state === 'unauthenticated') {
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
            />
          </motion.div>
        ) : (
          <motion.div
            key="closed"
            className="flex h-full w-full items-center justify-center bg-transparent"
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
