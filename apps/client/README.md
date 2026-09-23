# Gamezilla Client (Solid + Vite)

`bun run dev` starts the Vite app using `vite.config.mts`. `bun run setup`
writes local `VITE_*` build variables and prepares the SQL worker assets.
Local setup refuses the production API unless explicitly opted in with
`VITE_ALLOW_PRODUCTION_API_URL=1`.

## Progressive Web App (PWA)

- **Manifest & icons**: run `bun run pwa:generate` from this directory (downloads `pwa-asset-generator` via bunx; requires Chromium). Commit updated files under `public/`.
- **Production build**: `bun run build` runs `vite build` then generates `dist/sw.js` with **Workbox** (`scripts/build-sw.ts`).
- **Preview**: `bun run preview` serves `dist/` with SPA fallback and a `/ready` API-health probe.
- **Deploy**: `bun run deploy` validates the production API origin and built assets before the existing assets-only Worker deployment. Only `SECRETS_ENV=prd` applies remote changes; other environments dry-run.
- **Stuck / bad cache**: open `/unregister.html` on the deployed origin, or use **Clear local data & reload** in the app (unregisters SW, clears Cache Storage and IndexedDB, then reloads).
