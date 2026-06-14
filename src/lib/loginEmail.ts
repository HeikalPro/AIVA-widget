export const LOGIN_EMAIL_DOMAIN = 'gochat247.com'

export function parseLoginLocalPart(value: string): string {
  const trimmed = value.trim()
  const at = trimmed.indexOf('@')
  if (at < 0) return trimmed
  return trimmed.slice(0, at)
}

export function buildLoginEmail(localPart: string): string {
  const local = parseLoginLocalPart(localPart).trim()
  if (!local) return ''
  return `${local}@${LOGIN_EMAIL_DOMAIN}`
}
