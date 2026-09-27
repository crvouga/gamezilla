# Low-end Android mobile-web performance

Primary product target: **low-end Android mobile web** (Android Go / ~2 GB class, slow networks common in emerging markets). Not desktop, not Capacitor.

These gates **prove** the bar. Every gate is static and every gate can fail: there are no warn-only gates. There is no bundle-size budget.

## Critical-path definition

| Layer | What counts |
| --- | --- |
| Assets | HTML + initial CSS/JS/fonts/images on the Vite **static** entry graph |
| Must stay off the initial graph | `sql-workers` / `.wasm` (SQLite open is deferred until after first paint) |

**Do not “fix” a red static gate by converting a static import into an eager `import()`** (module top-level or shell `createResource` / `useEffect` on mount). The critical-path walker fails on any top-level `import()` in the initial closure.

## Fast static checks (`bun check`)

| Check | What |
| --- | --- |
| Biome grit | Ban known-heavy packages; ban eager static `@libs/games` / `@libs/chess` under `shell/**` |
| `@apps/client` test `the shipped client keeps heavy modules off the critical path` | Static import walk from `main.tsx`: denylisted static imports and any top-level `import()` hard-fail |
| Index HTML scripts | No third-party `<script src>` unless `INDEX_HTML_SCRIPT_ALLOWLIST` (`apps/client/scripts/check-index-html-scripts.ts`) |

## Compression

Production host: Cloudflare Workers assets-only (`www.gamezilla.app`). Edge negotiates **brotli > gzip**. Run `bun run --filter @apps/client check:production-compression` against production (warn / skip offline).

## Fonts

Prefer the **system font stack** already used in `@pkgs/ui` (0 KB on the critical path). If `@font-face` is added, use `font-display: swap|optional`.

## Third-party scripts

Inventory today: **none** in `index.html`. New tags need an allowlist entry + size review.

## Perf HUD

In-app perf HUD (`apps/client/src/shell/perf/`) is diagnostic-only (shows `heapMb` when enabled).

## Known product hot spot

Shell cold load keeps mutation hubs, DiceBear, SQLite WASM, and game-plugins **off** the entry graph:

- Vite `build.modulePreload` does not inject HTML preloads for dynamic-import targets
- [`ProductApp`](../apps/client/src/shell/product-app.tsx) paints `AppFrame` outside SQLite boot
- [`TabsLayout`](../apps/client/src/routes/tabs-layout.tsx) lazy-loads `SpaceMiniplayer`
- [`AppGamesProvider`](../libs/spaces/src/root/client/app/games-provider.tsx) wraps the sync ready tree (empty bootstrap always; game-plugins, injected by `@libs/runtime`, only under `/space/*`) so open-room slots see `SpaceModuleProvider`
- Sync-engine Solid bridges + leave/end modals live in `sync-engine-ready-tree.tsx` (lazy with the engine)
- [`DeviceAvatar`](../libs/profile/src/public/device-avatar.tsx) lazy-loads DiceBear only when a config exists

Post-paint SQLite open is delayed after fonts so LCP is not blocked on `sql-workers`.

## How to run locally

```bash
# Fast (no Vite build) — part of bun check
bun run --filter @apps/client lint
bun run --filter @apps/client test
```

Optional treemap: `ANALYZE=1 bun run --filter @apps/client build` → `apps/client/dist/.stats.html`.

## Still out of scope

| Item | Eventual path |
| --- | --- |
| Real Android device lab | Weekly sample on 2 GB Android Go |
| WebPageTest | Optional monthly filmstrips vs production — not a merge gate |
| RUM / CrUX | After first-party RUM exists; alert on p75 — never replace lab gates |
| Capacitor / desktop perf | Non-targets |
