import { useCallback, useEffect, useState } from 'react'
import { clearToken, getToken } from '@/services/token'

type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

function skipLogin(): boolean {
  return import.meta.env.VITE_SKIP_LOGIN === '1'
}

export function useAuth() {
  const [state, setState] = useState<AuthState>('loading')

  const refresh = useCallback(async () => {
    if (skipLogin()) {
      setState('authenticated')
      return
    }
    const t = await getToken()
    setState(t ? 'authenticated' : 'unauthenticated')
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await clearToken().catch(() => {})
    if (skipLogin()) {
      setState('authenticated')
      return
    }
    setState('unauthenticated')
  }, [])

  return { state, setAuthenticated: () => setState('authenticated'), refresh, logout }
}
