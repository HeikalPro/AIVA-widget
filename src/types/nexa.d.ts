import type { NexaAPI } from './nexa-api'

declare global {
  interface Window {
    nexa: NexaAPI
  }
}

export {}
