import axios from 'axios'
import { useState } from 'react'
import { WindowChromeButtons } from '@/components/WindowChromeButtons'
import { loginRequest } from '@/services/api'
import { setToken } from '@/services/token'

type Props = {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await loginRequest(username.trim(), password)
      await setToken(res.access_token)
      onSuccess()
    } catch (err: unknown) {
      let msg = 'Login failed'
      if (axios.isAxiosError(err)) {
        const d = err.response?.data as { detail?: string; message?: string } | string | undefined
        if (typeof d === 'string') msg = d
        else if (d && typeof d === 'object') msg = d.detail ?? d.message ?? err.message
        else msg = err.message
      } else if (err instanceof Error) msg = err.message
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950/95 p-8 shadow-glass">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-glass backdrop-blur-xl">
        <div className="drag relative flex h-11 shrink-0 items-center border-b border-white/10 px-1">
          <h1 className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-semibold tracking-tight text-white">
            Aiva
          </h1>
          <div className="ml-auto">
            <WindowChromeButtons
              onMinimize={() => void window.nexa.window.minimize()}
              onClose={() => void window.nexa.app.quit()}
            />
          </div>
        </div>
        <div className="no-drag p-8 pt-6">
          <p className="mb-6 text-center text-sm text-slate-400">Sign in to your account</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Username</label>
              <input
                className="no-drag w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none ring-violet-500/30 placeholder:text-slate-600 focus:ring-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
              <input
                type="password"
                className="no-drag w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white outline-none ring-violet-500/30 placeholder:text-slate-600 focus:ring-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="no-drag w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
