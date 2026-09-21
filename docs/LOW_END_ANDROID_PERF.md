# Low-end Android mobile-web performance

Primary product target: **low-end Android mobile web** (Android Go / ~2 GB class, slow networks common in emerging markets). Not desktop, not Capacitor.

These gates **prove** the bar. Quantity budgets follow [web.dev Slow 3G / Moto G4](https://web.dev/articles/your-first-performance-budget) (~100 KB JS, ~170 KB critical path for ~5s interactivity). Every gate is static and every gate can fail: there are no warn-only budgets.

Config: [`apps/client/perf-budget.json`](../apps/client/perf-budget.json) (schema **v2** — all thresholds live here; scripts must not hardcode budgets).

## Critical-path definition

| Layer | What counts |
| --- | --- |
| Assets | HTML + initial CSS/JS/fonts/images on the Vite **static** entry graph |
| Must stay off the initial graph | `sql-workers` / `.wasm` (`deferredPathMustNotMatch`; SQLite open is deferred until after first paint) |

**Do not “fix” a red static gate by converting a static import into an eager `import()`** (module top-level or shell `createResource` / `useEffect` on mount). The critical-path walker fails on any top-level `import()` in the initial closure.

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

Deferred: `sqlite3.wasm` / `sql-workers/**` must not appear on the initial graph or entry HTML preloads. SW precache of WASM is allowed for offline.

## Fast static checks (`bun check`)

| Check | What |
| --- | --- |
| Biome grit | Ban known-heavy packages; ban eager static `@libs/games` / `@libs/chess` under `shell/**` |
| `@apps/client` test `the shipped client keeps heavy modules off the critical path` | Static import walk from `main.tsx`: denylisted static imports and any top-level `import()` hard-fail |
| Index HTML scripts | No third-party `<script src>` unless `thirdParty.indexHtmlScriptAllowlist` |

## Compression

Production host: Cloudflare Workers assets-only (`www.gamezilla.app`). Edge negotiates **brotli > gzip**. CI measures gzip (level 9) and reports brotli. Run `bun run --filter @apps/client check:production-compression` against production (warn / skip offline).

## Fonts

Prefer the **system font stack** already used in `@pkgs/ui` (0 KB on the critical path). If `@font-face` is added, require `font-display: swap|optional` and stay under `fontsKb`.

## Third-party scripts

Inventory today: **none** in `index.html`. New tags need an allowlist entry + size review.

## Perf HUD

In-app perf HUD (`apps/client/src/shell/perf/`) is diagnostic-only (shows `heapMb` when enabled).

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
bun run --filter @apps/client lint
bun run --filter @apps/client test

# Artifact budgets (needs production build) — part of deploy
bun run --filter @apps/client build
bun run --filter @apps/client check:bundle-budget
```

Optional treemap: `ANALYZE=1 bun run --filter @apps/client build` → `apps/client/dist/.stats.html`.

## Still out of scope

| Item | Eventual path |
| --- | --- |
| Real Android device lab | Weekly sample on 2 GB Android Go |
| WebPageTest | Optional monthly filmstrips vs production — not a merge gate |
| RUM / CrUX | After first-party RUM exists; alert on p75 — never replace lab gates |
| Capacitor / desktop perf | Non-targets |
