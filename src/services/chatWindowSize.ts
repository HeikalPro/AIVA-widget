/** Collapsed assistant bubble — must match `BUBBLE` in `electron/main.ts`. */
export const ASSISTANT_BUBBLE_PX = 48

/** Persisted chat window geometry when expanded (move + resize). */
const KEY_BOUNDS = 'nexa-chat-window-bounds'
/** @deprecated legacy key — size only, position defaulted to bottom-right */
const KEY_LEGACY = 'nexa-chat-window-size'

export type ChatWindowBounds = { x: number; y: number; width: number; height: number }

export type StoredChatLayout =
  | { mode: 'bounds'; bounds: ChatWindowBounds }
  | { mode: 'size'; width: number; height: number }

export function getStoredChatLayout(): StoredChatLayout | null {
  try {
    const rawB = localStorage.getItem(KEY_BOUNDS)
    if (rawB) {
      const o = JSON.parse(rawB) as unknown
      if (
        typeof o === 'object' &&
        o !== null &&
        'x' in o &&
        'y' in o &&
        'width' in o &&
        'height' in o &&
        typeof (o as ChatWindowBounds).x === 'number' &&
        typeof (o as ChatWindowBounds).y === 'number' &&
        typeof (o as ChatWindowBounds).width === 'number' &&
        typeof (o as ChatWindowBounds).height === 'number'
      ) {
        return { mode: 'bounds', bounds: o as ChatWindowBounds }
      }
    }
    const rawS = localStorage.getItem(KEY_LEGACY)
    if (rawS) {
      const o = JSON.parse(rawS) as unknown
      if (
        typeof o === 'object' &&
        o !== null &&
        'width' in o &&
        'height' in o &&
        typeof (o as { width: number }).width === 'number' &&
        typeof (o as { height: number }).height === 'number'
      ) {
        return { mode: 'size', width: (o as { width: number }).width, height: (o as { height: number }).height }
      }
    }
  } catch {
    // ignore
  }
  return null
}

export function setStoredChatWindowBounds(bounds: ChatWindowBounds): void {
  try {
    localStorage.setItem(KEY_BOUNDS, JSON.stringify(bounds))
  } catch {
    // ignore
  }
}
