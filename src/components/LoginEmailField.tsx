import { LOGIN_EMAIL_DOMAIN, parseLoginLocalPart } from '@/lib/loginEmail'

const fieldClass =
  'no-drag w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-gochat focus:outline-none focus:ring-0'

type Props = {
  localPart: string
  onLocalPartChange: (value: string) => void
  showGoChatDomain: boolean
}

export function LoginEmailField({ localPart, onLocalPartChange, showGoChatDomain }: Props) {
  function handleChange(value: string) {
    onLocalPartChange(parseLoginLocalPart(value))
  }

  if (!showGoChatDomain) {
    return (
      <input
        className={fieldClass}
        value={localPart}
        onChange={(e) => onLocalPartChange(e.target.value)}
        autoComplete="username"
        placeholder="Enter your email"
        required
      />
    )
  }

  return (
    <div className="no-drag flex h-[42px] items-center overflow-hidden rounded-xl border border-slate-400 bg-white focus-within:border-gochat">
      <input
        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        value={localPart}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="username"
        autoComplete="username"
        required
      />
      <span className="shrink-0 pr-3 text-sm font-medium text-slate-600">@{LOGIN_EMAIL_DOMAIN}</span>
    </div>
  )
}
