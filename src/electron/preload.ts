import { contextBridge, ipcRenderer } from 'electron'
import type { NexaFromMainChannel, NexaSetAssistantCollapsedArg, NexaSetAssistantExpandedArg } from '../types/nexa-api'

const validFromMain: NexaFromMainChannel[] = [
  'nexa:blur',
  'nexa:session-expired',
  'nexa:logout-request',
  'nexa:tray-open',
  'nexa:window-bounds',
]

function on(channel: NexaFromMainChannel, listener: (...args: unknown[]) => void): () => void {
  if (!validFromMain.includes(channel)) {
    throw new Error(`Invalid channel: ${channel}`)
  }
  const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

contextBridge.exposeInMainWorld('nexa', {
  token: {
    get: () => ipcRenderer.invoke('nexa:token:get'),
    set: (value: string) => ipcRenderer.invoke('nexa:token:set', value),
    clear: () => ipcRenderer.invoke('nexa:token:clear'),
  },
  window: {
    setLoginMode: () => ipcRenderer.invoke('nexa:window:set-login'),
    getBounds: () => ipcRenderer.invoke('nexa:window:get-bounds'),
    setAssistantCollapsed: (arg?: NexaSetAssistantCollapsedArg) =>
      ipcRenderer.invoke('nexa:window:set-assistant-collapsed', arg),
    setAssistantExpanded: (arg?: NexaSetAssistantExpandedArg) =>
      ipcRenderer.invoke('nexa:window:set-assistant-expanded', arg),
    minimize: () => ipcRenderer.invoke('nexa:window:minimize'),
    hide: () => ipcRenderer.invoke('nexa:window:hide'),
  },
  app: {
    quit: () => ipcRenderer.invoke('nexa:app:quit'),
    logout: () => ipcRenderer.invoke('nexa:app:logout'),
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('nexa:updater:check'),
  },
  on,
})
