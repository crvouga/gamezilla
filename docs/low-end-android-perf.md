# Low-end Android mobile-web performance

Primary product target: **low-end Android mobile web** (Android Go / ~2 GB class, slow networks common in emerging markets). Not desktop, not Capacitor.

These gates **prove** the bar. Quantity budgets follow [web.dev Slow 3G / Moto G4](https://web.dev/articles/your-first-performance-budget) (~100 KB JS, ~170 KB critical path for ~5s interactivity). Runtime gates use Lighthouse mobile + 4× CPU + Slow 4G simulation (Slow 3G remains the aspirational bar).

Config: [`apps/client/perf-budget.json`](../apps/client/perf-budget.json) (schema **v2** — all thresholds live here; scripts must not hardcode budgets).

## Critical-path definition

| Layer | What counts |
| --- | --- |
| Assets | HTML + initial CSS/JS/fonts/images on the Vite **static** entry graph |
| Boot API | `/api/health`, identity ensure/refresh, first `POST /api/query` session batch — compressed transfer budgeted under `firstLoadApi` |
| Must not fetch before LCP | `sql-workers` / `.wasm` / `sqlite3` / `game-plugins` (Lighthouse network backstop; SQLite open is deferred until after first paint) |

**Do not “fix” a red static gate by converting a static import into an eager `import()`** (module top-level or shell `createResource` / `useEffect` on mount). The critical-path walker flags denylisted dynamic imports in the initial closure; Lighthouse asserts they are not fetched on `/` before interaction.

## Hard quantity budgets (deploy)

Measured on the **initial** route graph: Vite manifest entry + static `imports` only.

| Asset | Hard fail (baseline-tunable) |
| --- | --- |
| Initial JS (gzip primary) | **125 KB** |
| Initial CSS (gzip) | **20 KB** |
| Fonts on initial path | **40 KB** |
| Initial images (raw, non–apple-splash) | **50 KB** total / **40 KB** per file |
| Critical path total | **170 KB** |
| Uncompressed initial JS | **400 KB** |
| Lazy route graph (default) | **200 KB** gzip; overrides for game-plugins / chess / ui-explorer / profile-avatar + profile-dicebear-avatar (dicebear) / sync-engine boot (`create-local-sync-engine`, `sync-engine-ready-tree`) |

Brotli sizes are **reported** (Cloudflare edge prefers brotli); CI enforces **gzip** for determinism. Production `Content-Encoding` is smoke-checked separately.

Deferred: `sqlite3.wasm` / `sql-workers/**` must not appear on the initial graph or entry HTML preloads. SW precache of WASM is allowed for offline; tracked as a **warn** metric (`serviceWorker.precacheWarnKb`).

## Fast static checks (`bun check`)

| Check | What |
| --- | --- |
| Biome grit | Ban known-heavy packages; ban eager static `@libs/games` / `@libs/chess` under `shell/**` |
| `@apps/client#check:critical-path` | Static import walk from `main.tsx`; top-level `import()` hard-fail; denylisted nested `import()` per `criticalPath.eagerDynamicImportMode` (currently **warn**) |
| Index HTML scripts | No third-party `<script src>` unless `thirdParty.indexHtmlScriptAllowlist` |
| Image assets | PNG/JPEG size / modern-format policy (`images.mode`, currently **warn**) |

## Runtime Lighthouse (manual)

`@apps/client#check:lighthouse` is **opt-in** — not part of `bun check`, `bun check:full`, or `bun run deploy`. CD low-end gates are static: `@apps/client#check:critical-path` (fast tier) and `@apps/client#check:bundle-budget` (deploy; needs Vite `dist`). Run Lighthouse locally when investigating runtime metrics (needs a Vite build + Chrome). While `lighthouse.mode` is `warn`, overs print warnings and the task still exits 0.

- Rebuilds (when needed) with `VITE_API_URL` = preview origin; preview proxies `/api` → stub (never production)
- Routes: `/` (shell), `/more`, `/profile` — **one LHCI process per route** (Chrome reaped between routes); SIGKILL retries that route once after reap
- Median of `lighthouse.iterations` (3) × performance category only
- Metrics: LCP / TBT / TTI / Speed Index / total-byte-weight / CLS
- Reports under `apps/client/.lighthouseci/` (`--skip-upload` in the package script)

### Flip-to-blocking plan (when re-enabled on CD)

1. Collect ~2 weeks of medians from local manual runs  
2. Set thresholds to `ceil(p75 * 1.2)` in `perf-budget.json`  
3. Set `lighthouse.mode: "error"` and re-add `@apps/client#check:lighthouse` to `//#deploy` only if the wall-clock cost is acceptable

## Compression

Production host: Cloudflare Workers assets-only (`www.gamezilla.app`). Edge negotiates **brotli > gzip**. CI measures gzip (level 9) and reports brotli. Run `bun run --filter @apps/client check:production-compression` against production (warn / skip offline).

## Fonts

Prefer the **system font stack** already used in `@pkgs/ui` (0 KB on the critical path). If `@font-face` is added, require `font-display: swap|optional` and stay under `fontsKb`.

## Third-party scripts

Inventory today: **none** in `index.html`. New tags need an allowlist entry + size review. Lighthouse third-party blocking budget: `thirdParty.maxBlockingMs`.

## Memory + SW + first-load API

| Gate | Mode | Threshold (baseline-tunable) |
| --- | --- | --- |
| Shell JS heap | warn | 60 MB |
| After `/more` + `/profile` | warn | 90 MB |
| Boot API transfer | warn | 50 KB |
| SW precache total | warn | 2048 KB |
| PWA apple splash chrome | warn | 16 MB |

In-app perf HUD (`apps/client/src/shell/perf/`) remains diagnostic-only (shows `heapMb` when enabled).

## Known product hot spot

Shell cold load keeps mutation hubs, DiceBear, SQLite WASM, and game-plugins **off** the entry graph:

- Vite `build.modulePreload` does not inject HTML preloads for dynamic-import targets
- [`ProductApp`](../apps/client/src/shell/product-app.tsx) paints `AppFrame` outside SQLite boot
- [`TabsLayout`](../apps/client/src/routes/tabs-layout.tsx) lazy-loads `SpaceMiniplayer`
- [`AppGamesProvider`](../apps/client/src/shell/providers/app-games-provider.tsx) wraps the sync ready tree (empty bootstrap always; game-plugins only under `/space/*`) so open-room slots see `SpaceModuleProvider`
- Sync-engine Solid bridges + leave/end modals live in `sync-engine-ready-tree.tsx` (lazy with the engine)
- [`DeviceAvatar`](../libs/profile/src/public/device-avatar.tsx) lazy-loads DiceBear only when a config exists

Post-paint SQLite open is delayed after fonts so LCP is not blocked on `sql-workers`.

## How to run locally

```bash
# Fast (no Vite build) — part of bun check
bun run lint:biome
bun run --filter @apps/client check:critical-path

# Artifact budgets (needs production build) — part of deploy
bun run --filter @apps/client build
bun run --filter @apps/client check:bundle-budget

# Runtime Lighthouse (needs Chrome + build); manual only — not on check:full / deploy
bun run --filter @apps/client check:lighthouse
```

Optional treemap: `ANALYZE=1 bun run --filter @apps/client build` → `apps/client/dist/.stats.html`.

## Still out of scope

| Item | Eventual path |
| --- | --- |
| Real Android device lab | Weekly sample on 2 GB Android Go after LHCI baselines |
| WebPageTest | Optional monthly filmstrips vs production — not a merge gate |
| RUM / CrUX | After first-party RUM exists; alert on p75 — never replace lab gates |
| Paid LHCI server | Stay on temporary-public-storage + GHA artifacts |
| Capacitor / desktop perf | Non-targets |
