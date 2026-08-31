import { useCallback, useEffect, useState } from 'react'
import { skipLogin } from '@/services/authConfig'
import { clearToken, getToken } from '@/services/token'
import { fetchCurrentUser, isCurrentUserAvailable } from '@/services/userClient'
import type { CurrentUser } from '@/types/api'

type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

export function useAuth() {
  const [state, setState] = useState<AuthState>('loading')
  const [user, setUser] = useState<CurrentUser | null>(null)

  /** Best-effort: a failed profile load must never block a signed-in session. */
  const loadUser = useCallback(async () => {
    if (!isCurrentUserAvailable()) {
      setUser(null)
      return
    }
    try {
      setUser(await fetchCurrentUser())
    } catch {
      setUser(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (skipLogin()) {
      setState('authenticated')
      return
    }
    const t = await getToken()
    setState(t ? 'authenticated' : 'unauthenticated')
    if (t) void loadUser()
    else setUser(null)
  }, [loadUser])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await clearToken().catch(() => {})
    setUser(null)
    if (skipLogin()) {
      setState('authenticated')
      return
    }
    setState('unauthenticated')
  }, [])

  const setAuthenticated = useCallback(() => {
    setState('authenticated')
    void loadUser()
  }, [loadUser])

  return { state, user, setAuthenticated, refresh, logout }
}
