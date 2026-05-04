/** Window rect for assistant bubble / chat (DIP). */
export type NexaWindowBounds = { x: number; y: number; width: number; height: number }

/** IPC arg: legacy flat rect, or `{ bounds?, animate? }`, or flat + `animate` (parsed in main). */
export type NexaSetAssistantCollapsedArg =
  | undefined
  | NexaWindowBounds
  | { bounds: NexaWindowBounds; animate?: boolean }
  | (NexaWindowBounds & { animate?: boolean })

export type NexaSetAssistantExpandedArg =
  | undefined
  | { x?: number; y?: number; width: number; height: number }
  | { bounds: { x?: number; y?: number; width: number; height: number }; animate?: boolean }
  | ({ x?: number; y?: number; width: number; height: number } & { animate?: boolean })

/** Preload-exposed API (contextBridge) */
export type NexaAPI = {
  token: {
    get: () => Promise<string | null>
    set: (value: string) => Promise<void>
    clear: () => Promise<void>
  }
  window: {
    setLoginMode: () => Promise<void>
    getBounds: () => Promise<NexaWindowBounds | null>
    setAssistantCollapsed: (arg?: NexaSetAssistantCollapsedArg) => Promise<void>
    setAssistantExpanded: (arg?: NexaSetAssistantExpandedArg) => Promise<void>
    minimize: () => Promise<void>
    hide: () => Promise<void>
  }
  app: {
    quit: () => Promise<void>
    logout: () => Promise<void>
  }
  updater: {
    checkForUpdates: () => Promise<{ checked: boolean; message?: string }>
  }
  on: (channel: NexaFromMainChannel, listener: (...args: unknown[]) => void) => () => void
}

export type NexaFromMainChannel =
  | 'nexa:blur'
  | 'nexa:session-expired'
  | 'nexa:logout-request'
  | 'nexa:tray-open'
  | 'nexa:window-bounds'

export type NexaToMainChannel =
  | 'nexa:token:get'
  | 'nexa:token:set'
  | 'nexa:token:clear'
  | 'nexa:window:set-login'
  | 'nexa:window:set-assistant-collapsed'
  | 'nexa:window:set-assistant-expanded'
