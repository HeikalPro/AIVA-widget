const CID_KEY = 'nexa_conversation_id'
const LEGACY_CID_KEY = CID_KEY

function storageKey(accountId?: number | null): string {
  if (accountId != null && accountId > 0) return `${CID_KEY}_${accountId}`
  return LEGACY_CID_KEY
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key)
  } catch {
    return null
  }
}

export function getStoredConversationId(accountId?: number | null): string | null {
  const key = storageKey(accountId)
  let v = read(key)
  if (!v && accountId != null && key !== LEGACY_CID_KEY) {
    v = read(LEGACY_CID_KEY)
  }
  return v && v.length > 0 ? v : null
}

export function setStoredConversationId(id: string, accountId?: number | null): void {
  const key = storageKey(accountId)
  try {
    sessionStorage.setItem(key, id)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, id)
  } catch {
    /* ignore */
  }
}

export function clearStoredConversationId(accountId?: number | null): void {
  const keys = new Set<string>([storageKey(accountId), LEGACY_CID_KEY])
  for (const key of keys) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
