export const OTHER_EMAIL_DOMAIN = '__other__'

export const LOGIN_EMAIL_DOMAIN_OPTIONS = [
  { value: 'gmail.com', label: 'Gmail' },
  { value: 'yahoo.com', label: 'Yahoo' },
  { value: 'hotmail.com', label: 'Hotmail' },
  { value: 'outlook.com', label: 'Outlook' },
  { value: 'live.com', label: 'Live' },
  { value: 'icloud.com', label: 'iCloud' },
  { value: 'gochat247.com', label: 'GoChat247' },
  { value: 'goai247.com', label: 'GoAI247' },
  { value: OTHER_EMAIL_DOMAIN, label: 'Other' },
] as const

export const DEFAULT_LOGIN_EMAIL_DOMAIN = 'gmail.com'

export function usesEmailDomainPicker(): boolean {
  if (import.meta.env.VITE_LOGIN_EMAIL_PICKER === '0') return false
  if (import.meta.env.VITE_LOGIN_EMAIL_DOMAIN === '0') return false
  return true
}

export function resolveLoginDomain(domain: string, customDomain: string): string {
  if (domain === OTHER_EMAIL_DOMAIN) return customDomain.trim().toLowerCase()
  return domain
}

export function parsePastedEmail(value: string): {
  local: string
  domain: string
  customDomain: string
} {
  const trimmed = value.trim()
  const at = trimmed.indexOf('@')
  if (at < 0) {
    return { local: trimmed, domain: DEFAULT_LOGIN_EMAIL_DOMAIN, customDomain: '' }
  }
  const local = trimmed.slice(0, at)
  const host = trimmed.slice(at + 1).toLowerCase()
  const known = LOGIN_EMAIL_DOMAIN_OPTIONS.find((o) => o.value === host)
  if (known && known.value !== OTHER_EMAIL_DOMAIN) {
    return { local, domain: host, customDomain: '' }
  }
  return { local, domain: OTHER_EMAIL_DOMAIN, customDomain: host }
}

export function buildLoginEmail(
  localPart: string,
  domain: string,
  customDomain = '',
): string {
  const local = localPart.trim()
  if (!usesEmailDomainPicker()) return local
  const resolved = resolveLoginDomain(domain, customDomain)
  if (!local || !resolved) return ''
  return `${local}@${resolved}`
}
