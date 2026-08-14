# Gamezilla client (Expo)

## Progressive Web App (PWA)

- **Manifest & icons**: run `bun run pwa:generate` from this directory (downloads `pwa-asset-generator` via bunx; requires Chromium). Commit updated files under `public/`.
- **Production build**: `bun run build` runs `expo export -p web` then generates `dist/sw.js` with **Workbox** (`scripts/build-sw.ts`).
- **Updates**: in production (non-localhost), `workbox-window` shows a **Reload** banner when a new service worker is waiting.
- **Dev**: service workers are **not** registered on `localhost` or when `NODE_ENV !== 'production'`.
- **Stuck / bad cache**: open `/unregister.html` on the deployed origin, or use **Clear local data & reload** in the app (unregisters SW, clears Cache Storage and IndexedDB, then reloads).
