import {
  DEFAULT_LOGIN_EMAIL_DOMAIN,
  LOGIN_EMAIL_DOMAIN_OPTIONS,
  OTHER_EMAIL_DOMAIN,
  parsePastedEmail,
  usesEmailDomainPicker,
} from '@/lib/loginEmail'

const fieldClass =
  'no-drag w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-gochat focus:outline-none focus:ring-0'

type Props = {
  localPart: string
  domain: string
  customDomain: string
  onLocalPartChange: (value: string) => void
  onDomainChange: (value: string) => void
  onCustomDomainChange: (value: string) => void
  showPicker: boolean
}

export function LoginEmailField({
  localPart,
  domain,
  customDomain,
  onLocalPartChange,
  onDomainChange,
  onCustomDomainChange,
  showPicker,
}: Props) {
  if (!showPicker || !usesEmailDomainPicker()) {
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

  function handleLocalChange(value: string) {
    if (value.includes('@')) {
      const parsed = parsePastedEmail(value)
      onLocalPartChange(parsed.local)
      onDomainChange(parsed.domain)
      onCustomDomainChange(parsed.customDomain)
      return
    }
    onLocalPartChange(value)
  }

  return (
    <div className="space-y-2">
      <div className="no-drag flex h-[42px] items-center overflow-hidden rounded-xl border border-slate-400 bg-white focus-within:border-gochat">
        <input
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          value={localPart}
          onChange={(e) => handleLocalChange(e.target.value)}
          placeholder="username"
          autoComplete="username"
          required
        />
        <span className="shrink-0 text-sm text-slate-400">@</span>
        <select
          value={domain}
          onChange={(e) => onDomainChange(e.target.value)}
          className="no-drag h-full max-w-[9.5rem] shrink-0 cursor-pointer border-0 bg-transparent py-2 pr-3 pl-1 text-sm font-medium text-slate-700 outline-none"
          aria-label="Email provider"
        >
          {LOGIN_EMAIL_DOMAIN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {domain === OTHER_EMAIL_DOMAIN ? (
        <input
          className={fieldClass}
          value={customDomain}
          onChange={(e) => onCustomDomainChange(e.target.value)}
          placeholder="yourdomain.com"
          required
          aria-label="Custom email domain"
        />
      ) : null}
    </div>
  )
}

export { DEFAULT_LOGIN_EMAIL_DOMAIN }
