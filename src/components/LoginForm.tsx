import axios from 'axios'
import { useEffect, useState } from 'react'
import { BrandLogo } from '@/components/BrandLogo'
import { LoginEmailField } from '@/components/LoginEmailField'
import { WindowChromeButtons } from '@/components/WindowChromeButtons'
import { loginRequest } from '@/services/api'
import { usesAivaAuth } from '@/services/authConfig'
import { buildLoginEmail } from '@/lib/loginEmail'
import { setTokens } from '@/services/token'
import type { ZohoCallbackPayload } from '@/types/nexa-api'
import {
  cancelZohoLogin,
  isZohoLoginCancelled,
  isZohoLoginAvailable,
  startZohoLogin,
  zohoCallbackError,
} from '@/services/zohoAuth'

type Props = {
  onSuccess: () => void
}

const fieldClass =
  'no-drag w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-gochat focus:outline-none focus:ring-0'

const primaryBtnClass =
  'login-primary-btn no-drag w-full appearance-none rounded-xl border border-gochat-dark bg-[#0057A8] px-3 py-2.5 text-sm font-semibold text-white shadow-sm outline-none transition-colors hover:bg-gochat-light disabled:cursor-not-allowed disabled:opacity-60'

export function LoginForm({ onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [zohoPending, setZohoPending] = useState(false)
  const zohoAvailable = isZohoLoginAvailable()
  const useGoChatEmail = usesAivaAuth()

  useEffect(() => {
    if (!zohoAvailable) return
    const un = window.nexa.on('nexa:zoho-callback', (...args: unknown[]) => {
      const payload = (args[0] ?? {}) as ZohoCallbackPayload
      setZohoPending(false)
      setBusy(false)
      if (isZohoLoginCancelled(payload)) {
        return
      }
      const err = zohoCallbackError(payload)
      if (err) {
        setError(err)
        return
      }
      void setTokens({
        access_token: payload.access_token!,
        refresh_token: payload.refresh_token,
        token_type: payload.token_type ?? 'bearer',
      })
        .then(() => onSuccess())
        .catch((e) => {
          setError(e instanceof Error ? e.message : String(e))
        })
    })
    return un
  }, [onSuccess, zohoAvailable])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await loginRequest(
        useGoChatEmail ? buildLoginEmail(username) : username,
        password,
      )
      await setTokens({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
        token_type: res.token_type,
      })
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="drag relative flex h-10 shrink-0 items-center justify-end bg-white px-2">
        <WindowChromeButtons
          onMinimize={() => void window.nexa.window.minimize()}
          onClose={() => void window.nexa.app.quit()}
        />
      </div>
      <div className="no-drag flex min-h-0 flex-1 flex-col justify-center px-8 py-6">
        <div className="mb-5 flex justify-center">
          <BrandLogo className="h-16 w-auto max-w-[12rem] object-contain" />
        </div>
        <p className="mb-6 text-center text-sm text-slate-600">Sign in to your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                {usesAivaAuth() ? 'Email' : 'Username'}
              </label>
              <LoginEmailField
                localPart={username}
                onLocalPartChange={setUsername}
                showGoChatDomain={useGoChatEmail}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Password</label>
              <input
                type="password"
                className={fieldClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtnClass}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            {zohoAvailable && (
              <>
                <div className="relative flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-slate-300" />
                  <span className="text-xs text-slate-500">or</span>
                  <div className="h-px flex-1 bg-slate-300" />
                </div>
                <button
                  type="button"
                  disabled={busy && !zohoPending}
                  onClick={() => {
                    setError(null)
                    setBusy(true)
                    setZohoPending(true)
                    void startZohoLogin().catch((e) => {
                      setError(e instanceof Error ? e.message : String(e))
                      setBusy(false)
                      setZohoPending(false)
                    })
                  }}
                  className="no-drag w-full appearance-none rounded-xl border border-widget-strong bg-white py-2.5 text-sm font-medium text-slate-800 outline-none transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {zohoPending ? 'Waiting for Zoho…' : 'Sign in with Zoho'}
                </button>
                {zohoPending && (
                  <button
                    type="button"
                    className="no-drag w-full text-center text-xs text-slate-500 underline hover:text-slate-800"
                    onClick={() => {
                      void cancelZohoLogin()
                    }}
                  >
                    Cancel Zoho sign-in
                  </button>
                )}
              </>
            )}
          </form>
      </div>
    </div>
  )
}
