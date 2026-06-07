/** Secure token access via preload → main (keytar). Never use localStorage for JWT. */

export type TokenBundle = {
  access_token: string
  refresh_token?: string
  token_type?: string
}

export async function getToken(): Promise<string | null> {
  return window.nexa.token.get()
}

export async function setToken(token: string): Promise<void> {
  await window.nexa.token.set(token)
}

export async function setTokens(tokens: TokenBundle): Promise<void> {
  await window.nexa.token.set(tokens.access_token)
  if (tokens.refresh_token) {
    await window.nexa.token.setRefresh(tokens.refresh_token)
  } else {
    await window.nexa.token.clearRefresh()
  }
}

export async function clearToken(): Promise<void> {
  await window.nexa.token.clear()
}
