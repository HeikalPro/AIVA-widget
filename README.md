# Aiva

Desktop AI assistant (Electron + React + Tailwind). Configure `VITE_API_BASE_URL` in `.env` (see `.env.example`).

## Scripts

- `npm install` — install dependencies (rebuilds native modules such as `keytar`)
- `npm run dev` — Vite dev server + Electron
- `npm run build` — production renderer bundle + main/preload compile
- `npm run dist` — run `build`, then `electron-builder` (installers under `release/`)

## Requirements

- Node.js 18+
- Backend implementing `POST /login` (form-urlencoded) and `POST /chat/` (JSON + Bearer token)

## Production distribution

Set `VITE_API_BASE_URL` (and any path overrides) in `.env`, then:

```bash
npm run dist
```

| Output (under `release/`) | Platform |
|---------------------------|----------|
| `Aiva-Setup.exe` | Windows x64 (NSIS): one-click, per-user, desktop + Start Menu shortcuts, runs after install |
| `Aiva-<version>.dmg` | macOS (build on a Mac) |
| `Aiva-<version>.AppImage` | Linux x64 |

**Already configured in this repo:** `electron-builder` (`package.json` → `build`), JWT in **keytar** (not `localStorage`), **system tray** (Open / Logout / Quit), **minimize to tray** on window close, **`app.setLoginItemSettings`** for launch at login, **`electron-updater`** hook + `publish` placeholder for future update servers. For auto-updates later, set `build.publish` to your static host and configure signing as needed.

**Icons:** add `build/icon.ico` (Windows), `build/icon.icns` (macOS), and `build/icons/` for Linux to replace the default Electron icon (see [electron-builder icons](https://www.electron.build/icons.html)).
