import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import keytar from 'keytar'
import { TRAY_ICON_BUFFER } from './trayIcon'
import { ensureAivaBackendRunning, stopManagedBackend } from './backendManager'

const KEYTAR_SERVICE = 'Aiva'
const KEYTAR_ACCOUNT = 'auth-token'
const KEYTAR_REFRESH_ACCOUNT = 'auth-refresh-token'

let zohoWindow: BrowserWindow | null = null
let zohoReturnPrefix: string | null = null

const LOGIN_W = 440
const LOGIN_H = 560
const BUBBLE = 48
/** Default chat window size (user can resize; bounds clamped in handlers). */
const EXPANDED_W = 380
const EXPANDED_H = 540
const CHAT_MIN_W = 280
const CHAT_MIN_H = 360

/** Horizontal strips approximating a circle for `BrowserWindow.setShape` (Windows/Linux). */
function circleShape(diameter: number): Electron.Rectangle[] {
  const rects: Electron.Rectangle[] = []
  const r = diameter / 2
  for (let y = 0; y < diameter; y++) {
    const dy = y + 0.5 - r
    const half = Math.sqrt(Math.max(0, r * r - dy * dy))
    const x = Math.ceil(r - half)
    const w = Math.floor(half * 2)
    if (w > 0) rects.push({ x, y, width: w, height: 1 })
  }
  return rects
}

function applyBubbleWindowChrome(win: BrowserWindow) {
  if (process.platform === 'win32') {
    win.setThickFrame(false)
  }
  if (process.platform === 'win32' || process.platform === 'linux') {
    win.setShape(circleShape(BUBBLE))
  }
}

function applyRectWindowChrome(win: BrowserWindow, resizable: boolean) {
  if (process.platform === 'win32' || process.platform === 'linux') {
    win.setShape([])
  }
  if (process.platform === 'win32') {
    win.setThickFrame(resizable)
  }
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** When true, the main window `close` event should quit instead of hiding to tray. */
let isQuitting = false

function getWorkArea() {
  return screen.getPrimaryDisplay().workArea
}

function bottomRightBounds(width: number, height: number) {
  const wa = getWorkArea()
  return {
    x: Math.round(wa.x + wa.width - width),
    y: Math.round(wa.y + wa.height - height),
    width,
    height,
  }
}

function centerBounds(width: number, height: number) {
  const wa = getWorkArea()
  return {
    x: Math.round(wa.x + (wa.width - width) / 2),
    y: Math.round(wa.y + (wa.height - height) / 2),
    width,
    height,
  }
}

function clampRectToWorkArea(rect: Electron.Rectangle): Electron.Rectangle {
  const wa = getWorkArea()
  const w = rect.width
  const h = rect.height
  const x = Math.round(Math.min(Math.max(wa.x, rect.x), wa.x + wa.width - w))
  const y = Math.round(Math.min(Math.max(wa.y, rect.y), wa.y + wa.height - h))
  return { x, y, width: w, height: h }
}

const BOUNDS_ANIM_MS = 220

let boundsAnimationTimer: ReturnType<typeof setTimeout> | null = null

function cancelBoundsAnimation() {
  if (boundsAnimationTimer != null) {
    clearTimeout(boundsAnimationTimer)
    boundsAnimationTimer = null
  }
}

function animateWindowTo(target: Electron.Rectangle, durationMs: number): Promise<void> {
  cancelBoundsAnimation()
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      resolve()
      return
    }
    const start = mainWindow.getBounds()
    const targetClamped = clampRectToWorkArea(target)
    const t0 = Date.now()
    const tick = () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        boundsAnimationTimer = null
        resolve()
        return
      }
      const elapsed = Date.now() - t0
      const t = Math.min(1, elapsed / durationMs)
      const e = 1 - (1 - t) ** 3
      const x = Math.round(start.x + (targetClamped.x - start.x) * e)
      const y = Math.round(start.y + (targetClamped.y - start.y) * e)
      const w = Math.round(start.width + (targetClamped.width - start.width) * e)
      const h = Math.round(start.height + (targetClamped.height - start.height) * e)
      mainWindow.setBounds({ x, y, width: w, height: h })
      if (t < 1) {
        boundsAnimationTimer = setTimeout(tick, 16) as ReturnType<typeof setTimeout>
      } else {
        mainWindow.setBounds(targetClamped)
        boundsAnimationTimer = null
        resolve()
      }
    }
    tick()
  })
}

function parseAssistantCollapsedArg(arg: unknown): { bounds?: Electron.Rectangle; animate: boolean } {
  if (arg == null) return { animate: false }
  if (typeof arg !== 'object' || arg === null) return { animate: false }
  const o = arg as Record<string, unknown>
  if ('animate' in o || 'bounds' in o) {
    const animate = !!o.animate
    if (o.bounds && typeof o.bounds === 'object') {
      return { bounds: o.bounds as Electron.Rectangle, animate }
    }
    const { animate: _a, bounds: _b, ...rest } = o
    const hasDim = typeof rest.width === 'number' && typeof rest.height === 'number'
    return { bounds: hasDim ? (rest as unknown as Electron.Rectangle) : undefined, animate }
  }
  return { bounds: arg as Electron.Rectangle, animate: false }
}

function parseAssistantExpandedArg(arg: unknown): { bounds?: Electron.Rectangle; animate: boolean } {
  if (arg == null) return { animate: false }
  if (typeof arg !== 'object' || arg === null) return { animate: false }
  const o = arg as Record<string, unknown>
  if ('animate' in o || 'bounds' in o) {
    const animate = !!o.animate
    if (o.bounds && typeof o.bounds === 'object') {
      return { bounds: o.bounds as Electron.Rectangle, animate }
    }
    const { animate: _a, bounds: _b, ...rest } = o
    const hasDim = typeof rest.width === 'number' || typeof rest.height === 'number'
    return { bounds: hasDim ? (rest as unknown as Electron.Rectangle) : undefined, animate }
  }
  return { bounds: arg as Electron.Rectangle, animate: false }
}

/** Last collapsed (bubble) window bounds so reopening chat does not reset position. */
let savedCollapsedBounds: Electron.Rectangle | null = null

/** Official Electron branding PNG (OpenJS / electronjs.org style asset). */
function resolveElectronIconPath(): string | undefined {
  const distIcon = path.join(__dirname, '../dist/electron-icon.png')
  const publicIcon = path.join(__dirname, '../../public/electron-icon.png')
  if (fs.existsSync(distIcon)) return distIcon
  if (fs.existsSync(publicIcon)) return publicIcon
  return undefined
}

function createWindow() {
  const iconPath = resolveElectronIconPath()
  const devUrl = process.env.VITE_DEV_SERVER_URL
  const isDev = Boolean(devUrl)
  mainWindow = new BrowserWindow({
    width: LOGIN_W,
    height: LOGIN_H,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    resizable: false,
    minimizable: true,
    /** Thick frame only when chat is expanded; bubble uses a circular `setShape` instead. */
    thickFrame: false,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Packaged app loads file://; allow HTTPS API calls without browser CORS blocking.
      webSecurity: isDev,
    },
  })

  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  let boundsBroadcastTimer: NodeJS.Timeout | undefined
  const scheduleBoundsBroadcast = () => {
    if (boundsBroadcastTimer) clearTimeout(boundsBroadcastTimer)
    boundsBroadcastTimer = setTimeout(() => {
      boundsBroadcastTimer = undefined
      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.webContents.send('nexa:window-bounds', mainWindow.getBounds())
    }, 400)
  }
  mainWindow.on('moved', scheduleBoundsBroadcast)
  mainWindow.on('resized', scheduleBoundsBroadcast)

  /** After minimize, `skipTaskbar` was cleared so the taskbar shows the app; restore assistant modes. */
  mainWindow.on('restore', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const b = mainWindow.getBounds()
    const isLogin =
      Math.abs(b.width - LOGIN_W) <= 32 && Math.abs(b.height - LOGIN_H) <= 32
    mainWindow.setSkipTaskbar(!isLogin)
  })
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Open Assistant',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('nexa:tray-open')
        }
      },
    },
    {
      label: 'Logout',
      click: () => {
        void keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
        void keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_REFRESH_ACCOUNT)
        mainWindow?.webContents.send('nexa:logout-request')
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])
}

function createTray() {
  const iconPath = resolveElectronIconPath()
  const img = iconPath
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createFromBuffer(TRAY_ICON_BUFFER)
  tray = new Tray(img)
  tray.setToolTip('Aiva')
  tray.setContextMenu(buildTrayMenu())
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('nexa:tray-open')
    }
  })
}

function closeZohoWindow(sendCancelled = false) {
  if (zohoWindow && !zohoWindow.isDestroyed()) {
    zohoWindow.close()
  }
  zohoWindow = null
  zohoReturnPrefix = null
  if (sendCancelled && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('nexa:zoho-callback', { cancelled: true })
  }
}

function handleZohoNavigation(url: string) {
  if (!zohoReturnPrefix || !mainWindow || mainWindow.isDestroyed()) return
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  const prefix = zohoReturnPrefix.replace(/\/$/, '')
  const current = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '')
  if (current !== prefix) return

  const payload: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    payload[key] = value
  })
  mainWindow.webContents.send('nexa:zoho-callback', payload)
  closeZohoWindow(false)
}

function registerIpc() {
  ipcMain.handle('nexa:token:get', async () => {
    return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
  })
  ipcMain.handle('nexa:token:get-refresh', async () => {
    return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_REFRESH_ACCOUNT)
  })
  ipcMain.handle('nexa:token:set', async (_e, token: unknown) => {
    if (typeof token !== 'string' || !token) throw new Error('Invalid token')
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token)
  })
  ipcMain.handle('nexa:token:set-refresh', async (_e, token: unknown) => {
    if (typeof token !== 'string' || !token) throw new Error('Invalid refresh token')
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_REFRESH_ACCOUNT, token)
  })
  ipcMain.handle('nexa:token:clear-refresh', async () => {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_REFRESH_ACCOUNT)
  })
  ipcMain.handle('nexa:token:clear', async () => {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_REFRESH_ACCOUNT)
  })

  ipcMain.handle('nexa:zoho:start', async (_e, loginUrl: unknown) => {
    if (typeof loginUrl !== 'string' || !loginUrl.trim()) {
      throw new Error('Invalid Zoho login URL')
    }
    let returnTo = ''
    try {
      returnTo = decodeURIComponent(new URL(loginUrl).searchParams.get('return_to') ?? '')
    } catch {
      throw new Error('Invalid Zoho login URL')
    }
    zohoReturnPrefix = returnTo ? returnTo.split('?')[0].replace(/\/$/, '') : null
    closeZohoWindow(false)

    zohoWindow = new BrowserWindow({
      width: 520,
      height: 720,
      parent: mainWindow ?? undefined,
      modal: !!mainWindow,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    })

    const wc = zohoWindow.webContents
    const onNav = (_event: Electron.Event, url: string) => handleZohoNavigation(url)
    wc.on('will-redirect', onNav)
    wc.on('did-navigate', onNav)
    wc.on('did-navigate-in-page', onNav)
    zohoWindow.on('closed', () => {
      zohoWindow = null
      zohoReturnPrefix = null
    })

    await zohoWindow.loadURL(loginUrl)
  })

  ipcMain.handle('nexa:zoho:cancel', async () => {
    closeZohoWindow(true)
  })

  ipcMain.handle('nexa:window:set-login', async () => {
    if (!mainWindow) return
    savedCollapsedBounds = null
    const b = centerBounds(LOGIN_W, LOGIN_H)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setResizable(false)
    mainWindow.setMinimumSize(0, 0)
    mainWindow.setMaximumSize(0, 0)
    mainWindow.setBounds(b)
    applyRectWindowChrome(mainWindow, false)
  })

  ipcMain.handle('nexa:window:set-assistant-collapsed', async (_e, arg?: unknown) => {
    if (!mainWindow) return
    const parsed = parseAssistantCollapsedArg(arg)
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setSkipTaskbar(true)
    mainWindow.setMinimumSize(0, 0)
    mainWindow.setMaximumSize(0, 0)
    mainWindow.setResizable(false)
    const raw =
      parsed.bounds ??
      savedCollapsedBounds ??
      bottomRightBounds(BUBBLE, BUBBLE)
    const b = clampRectToWorkArea(raw)
    savedCollapsedBounds = { ...b }
    if (parsed.animate) {
      await animateWindowTo(b, BOUNDS_ANIM_MS)
    } else {
      mainWindow.setBounds(b)
    }
    applyBubbleWindowChrome(mainWindow)
  })

  ipcMain.handle('nexa:window:get-bounds', async () => {
    return mainWindow?.getBounds() ?? null
  })

  ipcMain.handle('nexa:window:minimize', async () => {
    if (!mainWindow) return
    /** Required on Windows when `skipTaskbar` is true (bubble/chat), or minimize appears broken. */
    mainWindow.setSkipTaskbar(false)
    mainWindow.minimize()
  })

  ipcMain.handle('nexa:window:hide', async () => {
    if (!mainWindow) return
    mainWindow.hide()
  })

  ipcMain.handle('nexa:window:set-assistant-expanded', async (_e, arg?: unknown) => {
    if (!mainWindow) return
    const parsed = parseAssistantExpandedArg(arg)
    const bounds = parsed.bounds
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setSkipTaskbar(true)
    const wa = getWorkArea()
    mainWindow.setMinimumSize(CHAT_MIN_W, CHAT_MIN_H)
    mainWindow.setMaximumSize(wa.width, wa.height)
    mainWindow.setResizable(true)
    const w = bounds ? Math.max(CHAT_MIN_W, bounds.width) : EXPANDED_W
    const h = bounds ? Math.max(CHAT_MIN_H, bounds.height) : EXPANDED_H
    const hasPosition =
      bounds &&
      typeof bounds.x === 'number' &&
      typeof bounds.y === 'number' &&
      !Number.isNaN(bounds.x) &&
      !Number.isNaN(bounds.y)
    const b = hasPosition
      ? clampRectToWorkArea({ x: bounds!.x, y: bounds!.y, width: w, height: h })
      : clampRectToWorkArea(bottomRightBounds(w, h))
    if (parsed.animate) {
      await animateWindowTo(b, BOUNDS_ANIM_MS)
    } else {
      mainWindow.setBounds(b)
    }
    applyRectWindowChrome(mainWindow, true)
  })

  ipcMain.handle('nexa:app:quit', async () => {
    isQuitting = true
    app.quit()
  })

  ipcMain.handle('nexa:app:logout', async () => {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_REFRESH_ACCOUNT)
    mainWindow?.webContents.send('nexa:logout-request')
  })

  ipcMain.handle('nexa:updater:check', async () => {
    if (!app.isPackaged) {
      return { checked: false, message: 'Updates only run in packaged builds.' }
    }
    try {
      const { autoUpdater } = await import('electron-updater')
      await autoUpdater.checkForUpdatesAndNotify()
      return { checked: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { checked: false, message }
    }
  })
}

async function prepareAutoUpdateStub() {
  if (!app.isPackaged || process.env.NEXA_DISABLE_UPDATER === '1') return
  try {
    const { autoUpdater } = await import('electron-updater')
    autoUpdater.autoDownload = false
    await autoUpdater.checkForUpdatesAndNotify()
  } catch {
    // Publish URL not configured yet — safe to ignore.
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    const backend = await ensureAivaBackendRunning()
    if (backend.status === 'failed') {
      console.error(`[aiva-backend] ${backend.reason}`)
    } else if (backend.status === 'started') {
      console.info(`[aiva-backend] started for widget at ${backend.baseUrl}`)
    }

    // Launch at OS login (Windows Startup, macOS Login Items, Linux XDG autostart where supported).
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
    })

    createWindow()
    createTray()
    registerIpc()
    void prepareAutoUpdateStub()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    isQuitting = true
    stopManagedBackend()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
