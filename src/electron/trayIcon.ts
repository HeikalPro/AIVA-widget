import { Buffer } from 'node:buffer'

/**
 * Minimal valid 1×1 PNG (scaled by the OS for the tray).
 * Replace with a multi-resolution asset in /build when branding.
 */
export const TRAY_ICON_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
