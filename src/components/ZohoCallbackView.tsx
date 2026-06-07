import { useEffect, useState } from 'react'
import { parseZohoCallbackParams, zohoCallbackError } from '@/services/zohoAuth'
import { setTokens } from '@/services/token'

type Props = {
  onSuccess: () => void
  onError: (message: string) => void
}

export function ZohoCallbackView({ onSuccess, onError }: Props) {
  const [message, setMessage] = useState('Finishing Zoho authentication…')

  useEffect(() => {
    const params = parseZohoCallbackParams(window.location.search)
    const err = zohoCallbackError(params)
    if (err) {
      setMessage(err)
      onError(err)
      return
    }
    void setTokens({
      access_token: params.access_token!,
      refresh_token: params.refresh_token,
      token_type: params.token_type ?? 'bearer',
    })
      .then(() => onSuccess())
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e)
        setMessage(msg)
        onError(msg)
      })
  }, [onError, onSuccess])

  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-950/95 p-8">
      <div className="max-w-sm rounded-2xl border border-white/10 bg-slate-900/80 px-6 py-8 text-center shadow-glass">
        <h1 className="text-lg font-semibold text-white">Completing sign-in</h1>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
      </div>
    </div>
  )
}
