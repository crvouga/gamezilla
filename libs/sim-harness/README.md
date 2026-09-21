# @libs/sim-harness

The simulation fabric and product System, generic over what it boots. It is a
shell, like `@libs/client-app` and `@libs/server-app`: it knows virtual time,
the network, the load balancer, the simulated IdP and the SQL engines, and no
feature. A **composition** says which features a sim runs; the harness folds
it with the same `composeFeatures` / `createClient` / `createServer` production
uses.

## Where an e2e goes

A feature's e2e lives in that feature: `libs/<feature>/tests/e2e/`, run by the
package's `test:e2e`, against a composition of only the slices it needs. A
change to a feature the suite does not compose leaves it cached.

| Suite | Composes | Why it is where it is |
| --- | --- | --- |
| `libs/chess/tests/e2e` | profile, spaces (chess only), chess, friends, billing | chess puzzles; friends and billing are hidden table reads (see below) |
| `libs/friends/tests/e2e` | profile, spaces (no games), friends, notifications, search, billing | friend flows, spaces flows and people search (both read friends' tables) |
| `libs/profile/tests/e2e` | profile, billing | profile editing, and auth (platform, so it runs in the lowest feature) |
| `libs/billing/tests/e2e` | billing | the membership lifecycle through the mock provider |
| `apps/product/tests` | everything (`APP_COMPOSITION`) | smoke, walks, cross-feature journeys — small on purpose |

The package graph decides a suite's home: turbo rejects dependency cycles, so a
suite lives in a package that may depend on every feature it composes. Two
features read another's tables directly today — permissions reads
`billing_subscriptions`; spaces and people search read friends' — so billing
is in every composition and spaces' and search's flows run in friends. Each is a port waiting to
be declared ([`docs/FEATURE_SUBSYSTEMS.md`](../../docs/FEATURE_SUBSYSTEMS.md)).

```ts
// libs/<feature>/tests/e2e/support/open-<feature>-sim.ts
const SYSTEM = defineProductSystem(
  composeSimSlices('friends', [PROFILE_SIM_SLICE, FRIENDS_SIM_SLICE, BILLING_SIM_SLICE])
);
export const openSim = (testId: string, options?: OpenSimOptions) =>
  openHarnessSim(SYSTEM, testId, options);
```

Each feature exports its slice (manifest, client, server, actions, reads,
properties, seeds, room host, browser pages) from `@libs/<feature>/sim/*`.
`composeSimSlices` adds the platform (auth, client-config, permissions) and
folds in production's order. Run one package's suite with
`bun run --filter @libs/chess test:e2e`, one file with
`bun run --filter @libs/chess test:e2e tests/e2e/puzzle-play.test.tsx`.

## Hosts

| Host name | Factory | UI | SQL / HTTP |
| --- | --- | --- | --- |
| `in-process` (default) | `inProcessRuntime({ composition })` | Solid DOM (`@pkgs/ui-testing-solid-dom` in happy-dom under bun:test; embedded `App` in product-simulator) | Seeded postgres-mem + sqlite-mem; in-process Hono `fetch`; caps include `partition` |
| `bun-webview` | `bunWebviewRuntime({ composition, ensureRealStack })` — registered by `@apps/product` only | `Bun.WebView` per actor | Seed SQL + model network by default; `SIM_MODE=real` uses real Postgres + S3rver/EMQX (the product boots them) and no `partition` cap; `SIM_MODE=stack` attaches to a separately booted [localhost stack](../../apps/product/docs/LOCALHOST_STACK.md) |

Open a run with `openSim(system, testId, options)` from
`@libs/sim-harness/open-sim/open-sim` — `system.run({ seed, runtime })` plus
snapshot restore and the reporter. The product simulator runs
`@apps/product/sim/system`'s `product` the same way.

**Sign-in** — there is no dev provider. Every mode signs in through Google
against `@pkgs/idp-google-sim`, a simulated provider with its own origin,
account directory, browser sessions and consent grants. In-process runs mount
it as the `idp` node on `createSimNet` (so it can be partitioned); the
localhost stack runs it as its own process on its own port. The headless
"popup" (`createInProcessOpenAuthSession`) parses and submits the provider's
real HTML forms, so a provider flow change fails the suite instead of
silently diverging.

**Authoring** — scenarios import `describe` / `test` from `bun:test` and call
their package's `openSim(testId)`. Drive UI with named `defineAction`s from the
harness and the features' `sim/*` (`s.apply(signInWithGoogle, 'alice')`). Smart monkey / explore walks are
**only** `defineAction` catalogs: `s.randomActions({ actions: PRODUCT_POOL_ACTIONS })`
or `product.explore({ actions: PRODUCT_POOL_ACTIONS })`. Standing properties
(`noErrorBoundary`, …) run after every checkpoint. Do not use UI-inventory
tap/fill helpers for product monkey testing.

Faults (partition / restoreNetwork) are `defineAction`s gated by the `caps` read.
On the bun-webview real-mode host (no `partition` cap), `s.apply(partition, …)`
throws `ActionNotEnabled`.

**SQL fabric** — in-process sim always uses **postgres-mem** + **sqlite-mem**
(checkpoint format `mixed-pgmm-sqlm`). Each composition migrates once into a
seed, `<package>/.cache/sim-seed-<composition>.pgmm.json`, fingerprinted by its
schema and migrate; every `openSim` clones it. The default migrate
(`migrateCompositionPostgres`) applies the framework tables, the composition's
domain schema and the IdP; the full composition passes the production runner.
Fidelity-max / `SIM_MODE=real` uses **postgres-embedded** (+ S3rver/EMQX)
outside this fabric.

Engine selection lives in the harness (`getSimSqlEngines` / fabric) — not in
product libs. ProductSimulator web may still load SQLite WASM from
`apps/product/public/generated/`.

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

**System snapshots** — `openSim(id, { snapshot: '<id>' })` restores a
committed fixture from the running package's `fixtures/snapshots/<id>.json`
(portable logical dump: server/client SQL rows + client KV + rooms + clock). No
suite uses one yet. A stale `localSchemaVersion` fails restore.

**Host details**

- **`in-process`** — the network mesh (`partition`) is first-class. Server schema is migrated
  **once** per composition into its seed; each `openSim` clones that seed
  instead of re-running DDL. UI runs on **virtual
  time**: `@pkgs/bun-test-solid/preload` installs a happy-dom document and
  compiles workspace `.tsx` with `babel-preset-solid` + the Lingui macro
  (`@libs/sim-harness/preload` narrows it to a phone viewport) (CSS modules → class-name proxies, media assets → paths);
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

- `bun run --filter @apps/product test:report [files…]`
  wipes the package's `.cache/sim-report`, runs the suite with `SIM_REPORT=1` +
  a JUnit reporter, writes **`sim-report/index.html`**, and opens
  it — one self-contained viewer: tests grouped by file name, step tree with
  press hits, multi-client phone panels, scrubber + filmstrip, view controls
  (multi/single, zoom, snapshots, press overlay), and keyboard shortcuts (`?`
  for help). UI steps encode `hit` (testId path + layout rect) and snapshot
  before the gesture so the overlay lands on the pressed element.
  `bun run --filter @apps/product report:open` rebuilds/opens an existing bucket without
  re-running tests.
- Plain `test:e2e` keeps `SIM_REPORT=0` (fast, no frames). `SIM_REPORT=1 bun test …` writes the raw bucket only; run
  `bun run --filter @apps/product report:build` to render it without opening.
- Capture is owned by the packages: `defineProductSystem` declares `defineSnapshot`s
  (`html` per actor via `Driver.snapshotHtml`, `topology`), `openSim` wraps each
  actor's driver in `recordingDriver` so `tap` / `input` / `expect.*` are steps,
  and test-body assertions land via the JUnit overlay (`s.fail(err)` records a
  harness failure explicitly when needed). Frame CSS is Tailwind + `@pkgs/ui`
  tokens/hosts + every `*.module.css` under `pkgs/ui` and `pkgs/chess-board`
  (sim Babel leaves class names unhashed). `TestViewportProvider` feeds
  `ThemeProvider.fixedLayout` so modal sizes match the 390×844 actor frame.

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.
