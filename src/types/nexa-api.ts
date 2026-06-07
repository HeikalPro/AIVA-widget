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
export type ZohoCallbackPayload = {
  access_token?: string
  refresh_token?: string
  token_type?: string
  error?: string
  cancelled?: boolean
}

export type NexaAPI = {
  token: {
    get: () => Promise<string | null>
    set: (value: string) => Promise<void>
    setRefresh: (value: string) => Promise<void>
    clearRefresh: () => Promise<void>
    clear: () => Promise<void>
  }
  zoho: {
    start: (loginUrl: string) => Promise<void>
    cancel: () => Promise<void>
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
  | 'nexa:zoho-callback'

export type NexaToMainChannel =
  | 'nexa:token:get'
  | 'nexa:token:set'
  | 'nexa:token:set-refresh'
  | 'nexa:token:clear-refresh'
  | 'nexa:token:clear'
  | 'nexa:zoho:start'
  | 'nexa:zoho:cancel'
  | 'nexa:window:set-login'
  | 'nexa:window:set-assistant-collapsed'
  | 'nexa:window:set-assistant-expanded'
