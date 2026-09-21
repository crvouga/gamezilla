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
| `libs/chess/tests/e2e` | profile, spaces (chess only), chess, friends, notifications, search, billing | chess puzzles, a host picking the game, friends watching a puzzle live |
| `libs/friends/tests/e2e` | profile, spaces (no games), friends, notifications, search, billing | friend flows, spaces flows and people search (both read friends' tables) |
| `libs/profile/tests/e2e` | profile, billing | profile editing, and auth (platform, so it runs in the lowest feature) |
| `libs/billing/tests/e2e` | billing | the membership lifecycle through the payment provider node |
| `libs/runtime/tests/e2e` | everything (`APP_COMPOSITION`) | shell boot, partition, the whole-app monkey, explore — small on purpose |

Every suite has a `monkey.test.tsx`: `runMonkey(s, { walks })` from
`@libs/sim-harness/open-sim/monkey` is a seeded random walk over the platform's
steps (spawn, sign in, partition, restore, resize the API fleet, navigate) and
the suite's feature walks — `walkAction`s from each feature's
`src/sim/*-walk.ts`, which act only when their screen allows it and fail
loudly when a control that is there does not work. Every standing property is
checked after each step; a violation throws with the step trace, and a walk
that never took one of its suite's own steps fails rather than passing
vacuously.

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
| `bun-webview` | `bunWebviewRuntime({ composition })` — registered on every product system | `Bun.WebView` per actor | Seed SQL + model network by default; `SIM_MODE=real` uses real Postgres + S3rver/EMQX (booted by the app that registers `registerRealStackBooter` — `@apps/product`'s `test:max` preload) and no `partition` cap; `SIM_MODE=stack` attaches to a separately booted [localhost stack](../../apps/product/docs/LOCALHOST_STACK.md) |

Open a run with `openSim(system, testId, options)` from
`@libs/sim-harness/open-sim/open-sim` — `system.run({ seed, runtime })` plus
snapshot restore and the reporter. The product simulator runs
`@libs/runtime/sim/app-composition`'s `APP_SYSTEM` the same way. An actor
opens an app link with `SimActor.openLink(path)` and reports its route with
`currentPath()` — how a guest with only a space's link gets in.

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

**Billing** — a composition that sells something (`billingOffer` on its
slice) gets a **payment provider node** (`fabric/sim-billing.ts`,
`@pkgs/billing-mock-provider`) at `SIM_BILLING_URL`, with its own SQLite state,
the way it gets the simulated Google. Every API instance holds the production
adapter to it (`MockMembershipBilling`) through the network; the provider
delivers **signed webhooks** back through the load balancer, and billing's only
write path is the callback route — exactly how Stripe reaches production. The
actor's browser loads the provider's hosted checkout and portal from its own
origin, so `subscribeToPlus` / `cancelPlus` / `resumePlus` /
`switchPlusInterval` are the same walk at every fidelity.
`observeMembership(kind)` is the tester acting at the provider through its
REST API: per-customer **test clocks** (renewals, dunning retries), Stripe's
**test cards** (`pm_card_chargeCustomerFail`), subscription updates, event
**resends** — never a clock jump for the rest of the sim.
`checkoutPlusAtProvider` pays a fresh checkout session at the provider (the
billing screen keeps Subscribe hidden while the grace window still grants
access). `advanceBillingClock(ms)` is the virtual-time escape hatch; the
grace-window rule itself is unit-proven in `@libs/permissions`.

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
  mount (`launch-actor.ts` → `createSolidDomDriver`); every actor's app keeps
  running (room connections, presence, subscriptions), but only the focused
  actor's container is attached to the document — parked ones are detached,
  not disposed, and reattach on focus. Waits are pump-driven
  (`createSimWaitPump` → `runFor`), deadlines on the wall clock.
- **`bun-webview`** — wall time. Default: model network + seed SQL.
  `listenSimHttpServer` binds Hono on `127.0.0.1:8787` and enforces createSimNet
  crash/partition (actor id via `x-sim-actor`). Tests drive `Bun.WebView`;
  product-simulator embeds the web origin URL. `SIM_MODE=real` boots sidecars via
  `ensureMaxFidelityStack` (real Postgres + S3rver/EMQX), serves web web
  (`e2e/serve-max-web.ts`), and does not enable `partition`. Snapshot auth KV
  is injected per actor WebView before hydrate.

**Reports** (`SIM_REPORT`) — standalone HTML, Playwright-trace style:

- `bun run test:report` (repo root) runs every package's `test:e2e` through
  turbo with `SIM_REPORT=1` (cached suites restore their buckets instead of
  rerunning), then folds every package's bucket (`<pkg>/.cache/sim-report`,
  its JUnit outcomes overlaid) into one **`sim-report/index.html`** and opens
  it — every subsystem's specs and monkey walks and the whole-app suite in one
  self-contained viewer: tests grouped by file, step tree with press hits,
  multi-client phone panels, scrubber + filmstrip, view controls, keyboard
  shortcuts (`?`). `--no-run` renders the buckets already on disk.
- Plain `test:e2e` keeps `SIM_REPORT=0` (fast, no frames) but always writes
  the package's JUnit. Report ids are namespaced by spec file, and the bundle
  is read from the per-test `report.json` files, so parallel workers never
  clobber or drop each other's runs.
- Capture is owned by the packages: `defineProductSystem` declares `defineSnapshot`s
  (`html` per actor via `Driver.snapshotHtml`, `topology`), `openSim` wraps each
  actor's driver in `recordingDriver` so `tap` / `input` / `expect.*` are steps,
  and test-body assertions land via the JUnit overlay (`s.fail(err)` records a
  harness failure explicitly when needed). Frame CSS is Tailwind + `@pkgs/ui`
  tokens/hosts + every `*.module.css` under `pkgs/*/src`
  (sim Babel leaves class names unhashed). `TestViewportProvider` feeds
  `ThemeProvider.fixedLayout` so modal sizes match the 390×844 actor frame.

Do not use a local Wrangler + API Worker stack for manual feature work. That is
CI / production, not `bun dev`.
