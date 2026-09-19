# Sim tests

Product system + fabric live in **`@apps/product/sim`**. Hosts are registered
runtimes on that System:

| Host name | Factory | Command | UI | SQL / HTTP |
| --- | --- | --- | --- | --- |
| `in-process` (default) | `inProcessRuntime` | `bun run --filter @apps/product test` | Solid DOM (`@pkgs/ui-testing-solid-dom` in happy-dom under bun:test; embedded `App` in product-simulator) | Seed postgres-mem + sqlite-mem; in-process Hono `fetch`; caps include `partition` |
| `bun-webview` | `bunWebviewRuntime` | `SIM_MODE=real` / `bun run --filter @apps/product test:max` | `Bun.WebView` per actor (tests); product-simulator embeds actor **URL** (iframe) | Seed SQL + model network by default; `SIM_MODE=real` uses real Postgres + S3rver/EMQX and no `partition` cap. Hono on loopback HTTP via `listenSimHttpServer` |
| `bun-webview` (stack) | `bunWebviewRuntime` | `SIM_MODE=stack` / `bun run test:product:localhost` | `Bun.WebView` against the stack's web origin | Attaches to a **separately booted localhost stack** ([`apps/product/scripts/localhost-stack`](../../../scripts/localhost-stack/README.md)): round-robin balancer, N Bun API instances, real Postgres/S3rver/EMQX, simulated Google on its own origin. This process owns no servers |

Open a run with `openSim` from `apps/product/src/test/setup/open-sim.ts` — a thin
helper over `product.run({ seed, runtime })` (plus snapshot restore + reporter).
Host name is `in-process` unless `SIM_MODE=real` / `SIM_MODE=stack` (or
`{ mode: … }`), which select `bun-webview`. Standing properties (`noErrorBoundary`) are registered with
`product.property`.

ProductSimulator (`@apps/product`) also calls `product.run` only — default
`runtime: 'in-process'`; optional `bun-webview` when a localhost web sidecar is up.
Neither console nor test opens a Session / `createSim` outside `@apps/product/sim`.

**Sign-in** — there is no dev provider. Every mode signs in through Google
against `@pkgs/idp-google-sim`, a simulated provider with its own origin,
account directory, browser sessions and consent grants. In-process runs mount
it as the `idp` node on `createSimNet` (so it can be partitioned); the
localhost stack runs it as its own process on its own port. The headless
"popup" (`createInProcessOpenAuthSession`) parses and submits the provider's
real HTML forms, so a provider flow change fails the suite instead of
silently diverging.

**Authoring** — scenarios import `describe` / `test` from `bun:test` and call
`openSim(testId)`. Drive UI with named `defineAction`s from `@apps/product/sim`
(`s.apply(signInWithGoogle, 'alice')`). Smart monkey / explore walks are
**only** `defineAction` catalogs: `s.randomActions({ actions: PRODUCT_POOL_ACTIONS })`
or `product.explore({ actions: PRODUCT_POOL_ACTIONS })`. Standing properties
(`noErrorBoundary`, …) run after every checkpoint. Do not use UI-inventory
tap/fill helpers for product monkey testing.

```tsx
import { describe, test } from 'bun:test';
import { openSim } from '../src/setup/open-sim';
import { createSpace, returnToTabs, signInWithGoogle } from '../src/sim';

describe('space create', () => {
  test('host creates a space', async () => {
    await using s = await openSim('space-create');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
  });
});
```

Faults (partition / restoreNetwork) are `defineAction`s gated by the `caps` read.
On the bun-webview real-mode host (no `partition` cap), `s.apply(partition, …)`
throws `ActionNotEnabled`.

**SQL fabric** — in-process sim always uses **postgres-mem** + **sqlite-mem**
(checkpoint format `mixed-pgmm-sqlm`). Seed:
`apps/product/.cache/sim-backend-seed.pgmm.json`. Fidelity-max /
`SIM_MODE=real` uses **postgres-embedded** (+ S3rver/EMQX) outside this fabric.

Engine selection lives in `@apps/product/sim` (`getSimSqlEngines` / fabric) — not in
product libs. ProductSimulator web may still load SQLite WASM from
`apps/product/public/generated/` (`bun run --filter @apps/product bundle:sim-sql-wasm`;
wired into `predev` / `setup`). Seed with `bun run --filter @apps/product seed:sim-db`.

**Billing** — the fake provider (`FakeMembershipBilling`) points its
checkout/portal URLs at this app's own dev-only mock pages
(`/api/billing/mock/…`, mounted only when `BILLING_PROVIDER=fake`; the sim and
the localhost stack both set it). The sim's headless browser walks those mock
pages the way `bun-webview` taps them with a live browser, so
`subscribeToPlus` / `cancelPlus` / `resumePlus` / `switchPlusInterval` are the
same walk at every fidelity. `observeMembership(kind)` is the lifecycle driver
at every fidelity: it posts one of the mock provider's `observe` kinds, which
derives the next membership from the account's current projection row —
renewals never need a clock jump. `checkoutPlusAtProvider` starts a fresh
checkout straight at the mock edge (the billing screen keeps Subscribe hidden
while the grace window still grants access). `advanceBillingClock(ms)` is the
virtual-time escape hatch, but the grace-window rule itself is unit-proven in
`@pkgs/entitlements` (`tests/limits.test.ts`) rather than by jumping a
signed-in sim days ahead.

**System snapshots** (committed fixtures; infrastructure only — scenarios still use UI setup):

- One JSON file per snapshot under `apps/product/fixtures/snapshots/<id>.json`
  (portable logical dump: server/client SQL rows + client KV + rooms + clock).
- `openSim(id, { snapshot: 'signed-in-alice' })` restores a fixture (not wired in
  scenario tests yet).
- Regenerate after schema or DSL changes:
  `bun run --filter @apps/product snapshot` (not part of `test`).
- Stale `localSchemaVersion` fails restore with instructions to re-run `snapshot`.

Builders live in `apps/product/src/test/snapshots/builders/` (same `s.apply` actions as scenarios).
Catalog: `signed-in-alice`, `signed-in-pair`, `friends-pair`, `both-in-space`.

**Host details**

- **`in-process`** — the network mesh (`partition`) is first-class. Server schema is migrated
  **once** into the seed file (`bun run --filter @apps/product seed:sim-db`); each
  `openSim` clones that seed instead of re-running DDL. UI runs on **virtual
  time**: `bun-preload.ts` installs a happy-dom document (phone viewport) and
  `bun-babel-plugin.ts` compiles workspace `.tsx` with `babel-preset-solid` +
  the Lingui macro (CSS modules → class-name proxies, media assets → paths);
  `bun test` runs with `--conditions=browser --conditions=development` so Solid
  resolves to its browser dev build. Each actor is one `MultiAppSolidDomSession`
  mount (`launch-actor.ts` → `createSolidDomDriver`); only the focused actor is
  in the document, parked actors keep their route via a per-actor
  `MemoryHistory` and re-mount on focus. Waits are pump-driven
  (`createSimWaitPump` → `runFor`), deadlines on the wall clock.
- **`bun-webview`** — wall time. Default: model network + seed SQL.
  `listenSimHttpServer` binds Hono on `127.0.0.1:8787` and enforces createSimNet
  crash/partition (actor id via `x-sim-actor`). Tests drive `Bun.WebView`;
  product-simulator embeds the web origin URL. `SIM_MODE=real` boots sidecars via
  `ensureMaxFidelityStack` (real Postgres + S3rver/EMQX), serves web web
  (`e2e/serve-max-web.ts`), and does not enable `partition`. Snapshot auth KV
  is injected per actor WebView before hydrate.

**Reports** (`SIM_REPORT`) — standalone HTML, Playwright-trace style:

- `bun run test:product:report` (root) / `bun run --filter @apps/product test:report [files…]`
  wipes `apps/product/.cache/sim-report`, runs the suite with `SIM_REPORT=1` +
  a JUnit reporter, writes **`apps/product/sim-report/index.html`**, and opens
  it — one self-contained viewer: tests grouped by file name, step tree with
  press hits, multi-client phone panels, scrubber + filmstrip, view controls
  (multi/single, zoom, snapshots, press overlay), and keyboard shortcuts (`?`
  for help). UI steps encode `hit` (testId path + layout rect) and snapshot
  before the gesture so the overlay lands on the pressed element.
  `bun run test:product:report:open` rebuilds/opens an existing bucket without
  re-running tests.
- Plain `bun run --filter @apps/product test` keeps `SIM_REPORT=0` (fast, no
  frames). `SIM_REPORT=1 bun test …` writes the raw bucket only; run
  `bun run --filter @apps/product report:build` to render it without opening.
-   Capture is owned by the packages: `product` declares `defineSnapshot`s
  (`html` per actor via `Driver.snapshotHtml`, `topology`), `openSim` wraps each
  actor's driver in `recordingDriver` so `tap` / `input` / `expect.*` are steps,
  and test-body assertions land via the JUnit overlay (`s.fail(err)` records a
  harness failure explicitly when needed). Frame CSS is Tailwind + `@pkgs/ui`
  tokens/hosts + every `*.module.css` under `pkgs/ui` and `pkgs/chess-board`
  (sim Babel leaves class names unhashed). `TestViewportProvider` feeds
  `ThemeProvider.fixedLayout` so modal sizes match the 390×844 actor frame.

Mem-engine wishlist:
[`docs/sim-mem-engine-wishlist.md`](../../../docs/sim-mem-engine-wishlist.md).

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.
