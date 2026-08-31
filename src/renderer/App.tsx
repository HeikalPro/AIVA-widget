import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChatPanel } from '@/components/ChatPanel'
import { FloatingWidget } from '@/components/FloatingWidget'
import { LoginForm } from '@/components/LoginForm'
import { ZohoCallbackView } from '@/components/ZohoCallbackView'
import { isZohoCallbackRoute } from '@/services/zohoAuth'
import { MessageFeedbackModal } from '@/components/MessageFeedbackModal'
import { AccountUpdatePopup } from '@/components/AccountUpdatePopup'
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
  aivaFetchQueueAccess,
  aivaFetchSessionMessages,
  aivaSubmitRating,
  aivaUpdateSessionQueues,
  normalizeQueuesForAccess,
  type AivaQueueAccess,
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
import {
  fetchWidgetAccounts,
  getStoredAccountId,
  pickDefaultAccountId,
  setStoredAccountId,
} from '@/services/accountsClient'
import { displayNameFromUser } from '@/services/userClient'
import type { ChatMessage } from '@/types/api'
import {
  buildCalculatorProductSettingsMap,
  installmentCalculatorTypes,
  isInstallmentCalculatorEnabled,
  resolveBranding,
  resolveLocations,
} from '@/types/widgetFeatures'
import {
  fetchActiveAccountUpdates,
  filterUnseenAccountUpdates,
  markAccountUpdatesSeen,
  type AccountUpdate,
} from '@/services/accountUpdatesClient'
import type { WidgetAccount } from '@/types/widgetFeatures'

/** Poll for account announcements and widget config while logged in. */
const WIDGET_SYNC_POLL_MS = 15_000
/**
 * Random spread applied to each poll interval. Without it, widgets that start
 * together (shift login, backend restart reconnecting everyone) stay locked to
 * the same 15s cadence and hit the backend as one burst every tick. Measured:
 * the backend is healthy to ~50 concurrent requests but collapses past ~100,
 * so dispersing the herd matters more than the exact interval.
 */
const WIDGET_SYNC_JITTER = 0.2

/** 15s ±20%, resampled every tick so widgets drift apart rather than converge. */
function nextSyncDelayMs(): number {
  return Math.round(WIDGET_SYNC_POLL_MS * (1 + (Math.random() * 2 - 1) * WIDGET_SYNC_JITTER))
}

export function App() {
  const { state, user, setAuthenticated, logout } = useAuth()
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
  const [accountId, setAccountId] = useState<number | null>(null)
  const [widgetAccounts, setWidgetAccounts] = useState<WidgetAccount[]>([])
  const [queueAccess, setQueueAccess] = useState<AivaQueueAccess | null>(null)
  const [selectedQueues, setSelectedQueues] = useState<string[]>([])
  const [activeUpdates, setActiveUpdates] = useState<AccountUpdate[]>([])
  const [popupUpdates, setPopupUpdates] = useState<AccountUpdate[]>([])
  const [updatePopupOpen, setUpdatePopupOpen] = useState(false)
  /** Mirrors session/local storage so follow-up sends always reuse thread (axios + IPC timing). */
  const conversationIdRef = useRef<string | null>(null)
  const chatAbortRef = useRef<AbortController | null>(null)
  const selectedQueuesRef = useRef(selectedQueues)
  const chatOpenRef = useRef(chatOpen)
  useEffect(() => {
    selectedQueuesRef.current = selectedQueues
  }, [selectedQueues])
  useEffect(() => {
    chatOpenRef.current = chatOpen
  }, [chatOpen])

  const activeAccount = useMemo(
    () => widgetAccounts.find((a) => a.id === accountId) ?? widgetAccounts[0] ?? null,
    [widgetAccounts, accountId],
  )
  const showInstallmentCalculator = isInstallmentCalculatorEnabled(activeAccount?.widget_features)
  const calculatorTypes = installmentCalculatorTypes(activeAccount?.widget_features)
  const calculatorProductSettings = buildCalculatorProductSettingsMap(activeAccount?.widget_features)
  const branding = resolveBranding(activeAccount?.widget_features)
  const widgetLocations = resolveLocations(activeAccount?.widget_features)

  useEffect(() => {
    assertApiBaseUrl()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (state !== 'authenticated' || accountId == null) return

    if (isHalanAgentChatEnabled()) {
      const cid = getStoredConversationId(accountId)
      conversationIdRef.current = cid
      if (!cid) {
        setMessages([])
        return
      }

      let cancelled = false
      setHistoryLoading(true)
      void halanFetchMessages(cid)
        .then((rows) => {
          if (cancelled) return
          if (getStoredConversationId(accountId) !== cid) return
          setMessages(rows.map(halanHistoryRowToChatMessage))
        })
        .catch(() => {
          if (cancelled) return
          clearStoredConversationId(accountId)
          conversationIdRef.current = null
          setMessages([])
        })
        .finally(() => {
          if (!cancelled) setHistoryLoading(false)
        })

      return () => {
        cancelled = true
      }
    }

    if (!isAivaSessionChatEnabled()) return

    const sid = getStoredConversationId(accountId)
    conversationIdRef.current = sid
    if (!sid) {
      setMessages([])
      return
    }

    let cancelled = false
    setHistoryLoading(true)
    void aivaFetchSessionMessages(sid)
      .then((rows) => {
        if (cancelled) return
        if (getStoredConversationId(accountId) !== sid) return
        setMessages(rows)
      })
      .catch(() => {
        if (cancelled) return
        clearStoredConversationId(accountId)
        conversationIdRef.current = null
        setMessages([])
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [state, accountId])

  const unseenUpdates = useMemo(() => {
    if (accountId == null) return activeUpdates
    return filterUnseenAccountUpdates(accountId, activeUpdates)
  }, [accountId, activeUpdates])

  const refreshWidgetAccounts = useCallback(async () => {
    try {
      const accounts = await fetchWidgetAccounts()
      setWidgetAccounts(accounts)
      setAccountId((prev) => {
        if (prev != null && accounts.some((a) => a.id === prev)) return prev
        const id = pickDefaultAccountId(accounts, getStoredAccountId())
        setStoredAccountId(id)
        return id
      })
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[widget-accounts] refresh failed:', e)
      }
    }
  }, [])

  const refreshAccountUpdates = useCallback(async (aid?: number | null, opts?: { showPopupIfNew?: boolean }) => {
    const resolvedId = aid ?? accountId
    if (!resolvedId) {
      setActiveUpdates([])
      setQueueAccess(null)
      return
    }

    const loadUpdates = async () => {
      try {
        const active = await fetchActiveAccountUpdates(resolvedId)
        setActiveUpdates(active)
        const showPopup = opts?.showPopupIfNew !== false
        if (showPopup && active.length > 0) {
          const unseen = filterUnseenAccountUpdates(resolvedId, active)
          if (unseen.length > 0) {
            setPopupUpdates(unseen)
            setChatOpen(true)
            setUpdatePopupOpen(true)
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[account-updates] fetch failed:', e)
        }
        setActiveUpdates([])
      }
    }

    const loadQueues = async () => {
      if (!isAivaSessionChatEnabled()) return
      try {
        const access = await aivaFetchQueueAccess(resolvedId)
        setQueueAccess(access)
        const prev = selectedQueuesRef.current
        const normalized = normalizeQueuesForAccess(
          prev.length ? prev : access.default_active_queues,
          access,
        )
        setSelectedQueues(normalized)
        const sid = conversationIdRef.current ?? getStoredConversationId(resolvedId)
        if (sid && normalized.length > 0) {
          try {
            await aivaUpdateSessionQueues(sid, normalized)
          } catch (e) {
            if (import.meta.env.DEV) {
              console.warn('[kb-queues] could not sync session queues:', e)
            }
          }
        }
        if (import.meta.env.DEV) {
          console.info(
            '[kb-queues] loaded for account',
            resolvedId,
            access.available_queues.map((q) => q.key),
          )
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (import.meta.env.DEV) {
          console.warn('[kb-queues] fetch failed:', e)
        }
        setQueueAccess(null)
        if (/404|not found/i.test(msg)) {
          setToast(
            'KB queues are not available on this server. Use local backend (localhost:8000) or deploy the latest AIVA-V2.',
          )
        }
      }
    }

    await Promise.all([loadUpdates(), loadQueues(), refreshWidgetAccounts()])
  }, [accountId, refreshWidgetAccounts])

  useEffect(() => {
    if (state !== 'authenticated') {
      setAccountId(null)
      setWidgetAccounts([])
      setQueueAccess(null)
      setSelectedQueues([])
      setActiveUpdates([])
      setPopupUpdates([])
      setUpdatePopupOpen(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const accounts = await fetchWidgetAccounts()
        if (cancelled) return
        setWidgetAccounts(accounts)
        const id = pickDefaultAccountId(accounts, getStoredAccountId())
        setAccountId(id)
        setStoredAccountId(id)
        conversationIdRef.current = getStoredConversationId(id)
        await refreshAccountUpdates(id, { showPopupIfNew: true })
      } catch (e) {
        if (cancelled) return
        setToast(e instanceof Error ? e.message : 'Could not load accounts')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state, refreshAccountUpdates])

  useEffect(() => {
    if (state !== 'authenticated' || !chatOpen) return
    void refreshAccountUpdates(undefined, { showPopupIfNew: false })
  }, [state, chatOpen, refreshAccountUpdates])

  useEffect(() => {
    if (state !== 'authenticated') return
    // Self-rescheduling timeout rather than setInterval: the delay is
    // resampled after every poll, so any two widgets keep diverging instead of
    // sharing one fixed cadence.
    let timer = 0
    const tick = () => {
      void refreshAccountUpdates(undefined, { showPopupIfNew: true })
      timer = window.setTimeout(tick, nextSyncDelayMs())
    }
    timer = window.setTimeout(tick, nextSyncDelayMs())
    return () => window.clearTimeout(timer)
  }, [state, refreshAccountUpdates])

  useEffect(() => {
    if (state !== 'authenticated') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshAccountUpdates(undefined, { showPopupIfNew: true })
      }
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [state, refreshAccountUpdates])

  function handleDismissUpdates() {
    setUpdatePopupOpen(false)
    if (accountId != null && popupUpdates.length > 0) {
      markAccountUpdatesSeen(
        accountId,
        popupUpdates.map((u) => u.id),
      )
    }
  }

  function handleViewUpdates() {
    if (activeUpdates.length > 0) {
      setPopupUpdates(activeUpdates)
      setUpdatePopupOpen(true)
    }
  }

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
    if (state === 'authenticated' && accountId != null) {
      conversationIdRef.current = getStoredConversationId(accountId)
      return
    }
    if (state === 'unauthenticated') {
      clearStoredConversationId()
      conversationIdRef.current = null
      setMessages([])
      setChatOpen(false)
      void applyLoginMode()
    }
  }, [state, accountId, applyLoginMode])

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

    chatAbortRef.current?.abort()
    const abortController = new AbortController()
    chatAbortRef.current = abortController

    setInput('')
    setMessages((m) => (assistantPlaceholder ? [...m, userMsg, assistantPlaceholder] : [...m, userMsg]))
    setLoading(true)
    try {
      const cid = conversationIdRef.current ?? getStoredConversationId(accountId ?? undefined) ?? undefined
      const activeQueues = queueAccess
        ? normalizeQueuesForAccess(
            selectedQueues.length ? selectedQueues : queueAccess.default_active_queues,
            queueAccess,
          )
        : selectedQueues.length
          ? selectedQueues
          : undefined
      const res = await sendChatMessage(
        {
          user_message: text,
          conversation_id: cid,
        },
        streamUi
          ? {
              signal: abortController.signal,
              accountId: accountId ?? undefined,
              activeQueues,
              onHaivaAssistantText: (acc) => {
                setMessages((m) =>
                  m.map((x) => (x.id === assistantMsgId ? { ...x, content: acc } : x)),
                )
              },
            }
          : {
              signal: abortController.signal,
              accountId: accountId ?? undefined,
              activeQueues,
            },
      )
      if (res.conversation_id) {
        conversationIdRef.current = res.conversation_id
        setStoredConversationId(res.conversation_id, accountId ?? undefined)
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
      } else if (isAivaSessionChatEnabled()) {
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
                  id: uid != null ? `aiva-${uid}` : x.id,
                  messageId: uid ?? x.messageId,
                }
              }
              if (x.id === assistantMsgId) {
                return {
                  ...x,
                  id: aid != null ? `aiva-${aid}` : x.id,
                  messageId: aid ?? x.messageId,
                  content: replyText,
                  sources: res.sources,
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
                    id: uid != null ? `aiva-${uid}` : x.id,
                    messageId: uid ?? x.messageId,
                  }
                : x,
            ),
            {
              id: aid != null ? `aiva-${aid}` : crypto.randomUUID(),
              messageId: aid,
              role: 'assistant',
              content: replyText,
              sources: res.sources,
            },
          ])
        }
        if (res.conversation_id && (uid == null || aid == null)) {
          try {
            const rows = await aivaFetchSessionMessages(res.conversation_id)
            setMessages(rows)
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
      if (e instanceof DOMException && e.name === 'AbortError') {
        if (streamUi && assistantPlaceholder) {
          setMessages((m) =>
            m.map((x) =>
              x.id === assistantMsgId
                ? { ...x, content: x.content.trim() || '(Stopped)' }
                : x,
            ),
          )
        }
        return
      }
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
      if (chatAbortRef.current === abortController) {
        chatAbortRef.current = null
      }
      setLoading(false)
    }
  }

  function handleStop() {
    chatAbortRef.current?.abort()
  }

  async function handleThumbUp(messageId: number) {
    setRatingBusyId(messageId)
    try {
      if (isAivaSessionChatEnabled()) {
        await aivaSubmitRating(messageId, { rating: 'up' })
      } else {
        const cid = conversationIdRef.current ?? getStoredConversationId(accountId ?? undefined)
        if (!cid) return
        await halanSubmitRating(cid, messageId, { rating: 'up' })
      }
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
    if (mid == null) return
    setRatingModalSubmitting(true)
    try {
      const trimmed = feedback.trim()
      if (isAivaSessionChatEnabled()) {
        await aivaSubmitRating(mid, { rating: 'down', feedback: trimmed })
      } else {
        const cid = conversationIdRef.current ?? getStoredConversationId(accountId ?? undefined)
        if (!cid) return
        await halanSubmitRating(cid, mid, { rating: 'down', feedback: trimmed })
      }
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
    setMessages([])
    setUpdatePopupOpen(false)
    setChatOpen(true)
    setAuthenticated()
  }

  function handleAccountChange(nextAccountId: number) {
    if (nextAccountId === accountId) return
    setStoredAccountId(nextAccountId)
    setAccountId(nextAccountId)
    conversationIdRef.current = getStoredConversationId(nextAccountId)
    selectedQueuesRef.current = []
    setMessages([])
    setSelectedQueues([])
    setQueueAccess(null)
    setActiveUpdates([])
    setPopupUpdates([])
    setUpdatePopupOpen(false)
    void refreshAccountUpdates(nextAccountId, { showPopupIfNew: false })
  }

  async function handleLogout() {
    await window.nexa.app.logout()
  }

  function handleNewConversation() {
    if (accountId == null) return
    clearStoredConversationId(accountId)
    conversationIdRef.current = null
    setMessages([])
    if (isAivaSessionChatEnabled()) {
      const queues = selectedQueues.length
        ? selectedQueues
        : queueAccess?.default_active_queues
      void aivaCreateSession(accountId, queues)
        .then((sid) => {
          conversationIdRef.current = sid
          setStoredConversationId(sid, accountId)
        })
        .catch((e) => {
          setToast(e instanceof Error ? e.message : 'Could not start a new session')
        })
    }
  }

  async function handleQueueChange(keys: string[]) {
    if (keys.length === 0) return
    const normalized = queueAccess ? normalizeQueuesForAccess(keys, queueAccess) : keys
    if (normalized.length === 0) return
    setSelectedQueues(normalized)
    const sid = conversationIdRef.current ?? getStoredConversationId(accountId ?? undefined)
    if (!sid || !isAivaSessionChatEnabled()) return
    try {
      await aivaUpdateSessionQueues(sid, normalized)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not update queues')
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
    <div
      className={`relative box-border h-full w-full bg-transparent ${chatOpen ? 'p-2.5' : 'overflow-hidden'}`}
    >
      <AnimatePresence mode="wait">
        {chatOpen ? (
          <motion.div
            key="open"
            className="relative flex h-full min-h-0 w-full flex-col"
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
              onStop={handleStop}
              onNewConversation={handleNewConversation}
              onLogout={() => void handleLogout()}
              onCollapseChat={() => setChatOpen(false)}
              ratingsEnabled={isHalanAgentChatEnabled() || isAivaSessionChatEnabled()}
              ratingBusyId={ratingBusyId}
              onThumbUp={(id) => void handleThumbUp(id)}
              onThumbDown={(id) => {
                const existing = messages.find((x) => x.messageId === id)?.feedback ?? ''
                setRateDownInitialFeedback(existing)
                setRateDownMessageId(id)
              }}
              historyLoading={historyLoading}
              activeUpdateCount={activeUpdates.length}
              unseenUpdateCount={unseenUpdates.length}
              accountUpdates={activeUpdates}
              onViewUpdates={handleViewUpdates}
              accounts={widgetAccounts}
              accountId={accountId}
              accountName={activeAccount?.name ?? null}
              userName={displayNameFromUser(user)}
              onAccountChange={handleAccountChange}
              showInstallmentCalculator={showInstallmentCalculator}
              calculatorTypes={calculatorTypes}
              calculatorProductSettings={calculatorProductSettings}
              locations={widgetLocations}
              kbQueues={queueAccess?.available_queues}
              selectedKbQueues={
                selectedQueues.length
                  ? selectedQueues
                  : queueAccess?.default_active_queues ?? []
              }
              onKbQueuesChange={(keys) => void handleQueueChange(keys)}
              onRefreshWidgetConfig={() => void refreshWidgetAccounts()}
              branding={branding}
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
            <FloatingWidget
              onOpen={() => setChatOpen(true)}
              activeUpdateCount={
                activeUpdates.length > 0
                  ? unseenUpdates.length > 0
                    ? unseenUpdates.length
                    : activeUpdates.length
                  : 0
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AccountUpdatePopup
        open={updatePopupOpen && popupUpdates.length > 0}
        updates={popupUpdates}
        onDismiss={handleDismissUpdates}
      />
    </div>
  )
}
