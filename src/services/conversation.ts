const CID_KEY = 'nexa_conversation_id'

function read(): string | null {
  try {
    return sessionStorage.getItem(CID_KEY) ?? localStorage.getItem(CID_KEY)
  } catch {
    return null
  }
}

export function getStoredConversationId(): string | null {
  const v = read()
  return v && v.length > 0 ? v : null
}

export function setStoredConversationId(id: string): void {
  try {
    sessionStorage.setItem(CID_KEY, id)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(CID_KEY, id)
  } catch {
    /* ignore */
  }
}

export function clearStoredConversationId(): void {
  try {
    sessionStorage.removeItem(CID_KEY)
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(CID_KEY)
  } catch {
    /* ignore */
  }
}
