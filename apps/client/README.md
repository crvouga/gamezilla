# Gamezilla Client (Solid + Vite)

Run the app from the repository root with `bun start:localhost`. For the
in-memory app, use `bun start:localhost:mocked`. Client setup prepares the
`VITE_*` build variables and SQL worker assets.

## Progressive Web App (PWA)

- **Manifest & icons**: run `bun run pwa:generate` from this directory (downloads `pwa-asset-generator` via bunx; requires Chromium). Commit updated files under `public/`.
- **Production build**: `bun run build` runs `vite build` then generates `dist/sw.js` with **Workbox** (`scripts/build-sw.ts`).
- **Preview**: `bun run preview` serves `dist/` with SPA fallback and a `/ready` API-health probe.
- **Deploy**: `bun run deploy` validates the production API origin and built assets before the existing assets-only Worker deployment. Only `SECRETS_ENV=prd` applies remote changes; other environments dry-run.
- **Stuck / bad cache**: open `/unregister.html` on the deployed origin, or use **Clear local data & reload** in the app (unregisters SW, clears Cache Storage and IndexedDB, then reloads).
