/** Secure token access via preload → main (keytar). Never use localStorage for JWT. */

export async function getToken(): Promise<string | null> {
  return window.nexa.token.get()
}

export async function setToken(token: string): Promise<void> {
  await window.nexa.token.set(token)
}

export async function clearToken(): Promise<void> {
  await window.nexa.token.clear()
}
