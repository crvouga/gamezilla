# @libs/harness

The simulation fabric and product System, generic over what it boots. It is a
shell, like `@libs/client-app` and `@libs/server-app`: it knows virtual time,
the network, the load balancer, the simulated IdP and the SQL engines, and no
feature. A **composition** says which features a harness runs; the harness folds
it with the same `composeFeatures` / `createClient` / `createServer` production
uses.

## Where a spec goes

A feature's spec lives in that feature: the specs of the package's
`specDomains` (`specs/<domain>/*.feature`, `*.qnt`) and
`libs/<feature>/tests/harness/`, run by the package's `test:spec`, against a
composition of only the slices it needs. A change to a feature the suite does
not compose leaves it cached.

| Suite | Composes | Why it is where it is |
| --- | --- | --- |
| `libs/chess/tests/harness` | profile, spaces (chess only), chess, friends, notifications, search, billing | chess puzzles, a host picking the game, friends watching a puzzle live |
| `libs/friends/tests/harness` | profile, spaces (no games), friends, notifications, search, billing | friend flows, spaces flows and people search (both read friends' tables) |
| `libs/profile/tests/harness` | profile, billing | profile editing, and auth (platform, so it runs in the lowest feature) |
| `libs/billing/tests/harness` | billing | the membership lifecycle through the payment provider node |
| `libs/runtime/tests/harness` | everything (`APP_COMPOSITION`) | shell boot, the platform model, critical journeys — small on purpose |

There are no product random walks. A feature's state machine is a Quint model
(`specs/<domain>/<model>.qnt`) and its binding (`tests/quint/<model>.binding.ts`,
registered with `useQuintHarness(openHarness)` from `@libs/harness/quint/world` in
`tests/quint/index.ts`): Quint draws the walks, each drawn step runs through
the binding's harness actions, and the product's state, read back by the
binding's `observe`, must equal the model's after every step — with every
standing property checked, since each action is an `s.apply`. See
[`docs/SPEC_STANDARDS.md`](../../docs/SPEC_STANDARDS.md).

The package graph decides a suite's home: turbo rejects dependency cycles, so a
suite lives in a package that may depend on every feature it composes. Two
features read another's tables directly today — permissions reads
`billing_subscriptions`; spaces and people search read friends' — so billing
is in every composition and spaces' and search's flows run in friends. Each is a port waiting to
be declared ([`docs/FEATURE_SUBSYSTEMS.md`](../../docs/FEATURE_SUBSYSTEMS.md)).

```ts
// libs/<feature>/tests/harness/open-<feature>-harness.ts
const SYSTEM = defineProductSystem(
  composeHarnessSlices('friends', [PROFILE_HARNESS_SLICE, FRIENDS_HARNESS_SLICE, BILLING_HARNESS_SLICE])
);
export const openHarness = (testId: string, options?: OpenHarnessOptions) =>
  openSystemHarness(SYSTEM, testId, options);
```

Each feature exports its slice (manifest, client, server, actions, reads,
properties, seeds, room host, browser pages) from `@libs/<feature>/harness/*`.
`composeHarnessSlices` adds the platform (auth, client-config, permissions) and
folds in production's order. Run one package's suite with
`bun run --filter @libs/chess test:spec`, one spec with
`bun run spec specs/chess/puzzle-play.feature`.

## Hosts

| Host name | Factory | UI | SQL / HTTP |
| --- | --- | --- | --- |
| `in-process` (default) | `inProcessRuntime({ composition })` | Solid DOM (`@pkgs/ui-testing-solid-dom` in happy-dom under bun:test; embedded `App` in product-harness) | Seeded mockingbird-postgres + mockingbird-sqlite; in-process Hono `fetch`; caps include `partition` |
| `bun-webview` | `bunWebviewRuntime({ composition })` — registered on every product system | `Bun.WebView` per actor | Seed SQL + model network by default; `HARNESS_MODE=real` uses real Postgres + S3rver/EMQX (booted by the app that registers `registerRealStackBooter` — `@apps/product`'s `test:max` preload) and no `partition` cap; `HARNESS_MODE=stack` attaches to a separately booted [localhost stack](../../apps/product/docs/LOCALHOST_STACK.md) |

Open a run with `openHarness(system, testId, options)` from
`@libs/harness/open-harness/open-harness` — `system.run({ seed, runtime })` plus
snapshot restore and the reporter. The product harness runs
`@libs/runtime/harness/app-composition`'s `APP_SYSTEM` the same way. An actor
opens an app link with `HarnessActor.openLink(path)` and reports its route with
`currentPath()` — how a guest with only a space's link gets in.

**Sign-in** — there is no dev provider. Every mode signs in through Google
or Apple against `@pkgs/idp-mock`: two simulated providers, each with its own
origin, account directory, browser sessions and consent grants. In-process
runs mount them as the `idp` and `idp-apple` nodes on `createHarnessNet` (so either
can be partitioned); the localhost stack runs each as its own process on its
own port. Every actor holds one Google account (`<actor>@gmail.com`) and two
Apple Accounts — one on the same Gmail address (linking by email) and one on
iCloud (only an explicit link joins it). The actor's browser walks the
provider's real screens (`system/provider-walk.ts`: address, chooser,
password, consent, Apple's Share / Hide My Email) and auto-submits Apple's
`form_post` page, so a provider flow change fails the suite instead of
silently diverging.

Auth actions: `signInWithGoogle` / `signInWithApple` / `signInWithProviderAs`,
`confirmAccountLink` / `keepSeparateAccount` for the link-required question,
`abandonSignIn`, `connectSignInMethod` / `removeSignInMethod` /
`signOutEverywhere` on the account screen, and the provider-side stimuli
`appleRevokesApp` / `appleDeletesAccount`.

**Authoring** — scenarios are Gherkin steps and Quint bindings over the
package's `openHarness(testId)`; code tests import `describe` / `test` from
`bun:test` and call it directly. Drive UI with named `defineAction`s from the
harness and the features' `harness/*` (`s.apply(signInWithGoogle, 'alice')`).
Standing properties (`noErrorBoundary`, …) run after every checkpoint. Do not
use UI-inventory tap/fill helpers in product tests.

Faults (partition / restoreNetwork) are `defineAction`s gated by the `caps` read.
On the bun-webview real-mode host (no `partition` cap), `s.apply(partition, …)`
throws `ActionNotEnabled`.

**SQL fabric** — in-process harness always uses **mockingbird-postgres** + **mockingbird-sqlite**
(checkpoint format `mixed-pgmm-sqlm`). Each composition migrates once into a
seed, `<package>/.cache/harness-seed-<composition>.pgmm.json`, fingerprinted by its
schema and migrate; every `openHarness` clones it. The default migrate
(`migrateCompositionPostgres`) applies the framework tables, the composition's
domain schema and the IdP; the full composition passes the production runner.
Fidelity-max / `HARNESS_MODE=real` uses **postgres-embedded** (+ S3rver/EMQX)
outside this fabric.

Engine selection lives in the harness (`getHarnessSqlEngines` / fabric) — not in
product libs. ProductHarness web may still load SQLite WASM from
`apps/product/public/generated/`.

**Billing** — a composition that sells something (`billingOffer` on its
slice) gets a **payment provider node** (`fabric/billing.ts`,
`@pkgs/billing-mock-provider`) at `HARNESS_BILLING_URL`, with its own SQLite state,
the way it gets the simulated Google. Every API instance holds the production
adapter to it (`MockMembershipBilling`, registered in its
`MembershipProviders`) through the network; the provider delivers **signed
webhooks** back through the load balancer to `/api/billing/callback/mock`,
and billing's only write path is that callback route — exactly how every
real provider reaches production. The team can **switch payment provider**
(`HarnessBillingProviders.switchCheckout`, billing's `switchPaymentProvider`
action): a second provider node boots with its own id, origin
(`harnessBillingOrigin`), keys and state, new checkouts go there, and every
earlier provider keeps serving its members — each API instance re-reads the
registry per request, as a redeploy with the new configuration would. The
actor's browser loads the provider's hosted checkout and portal from its own
origin, so `subscribeToPlus` / `cancelPlus` / `resumePlus` /
`switchPlusInterval` are the same walk at every fidelity.
`observeMembership(kind)` is the tester acting at the provider through its
REST API: per-customer **test clocks** (renewals, dunning retries), Stripe's
**test cards** (`pm_card_chargeCustomerFail`), subscription updates, event
**resends** — never a clock jump for the rest of the harness.
`checkoutPlusAtProvider` pays a fresh checkout session at the provider (the
billing screen keeps Subscribe hidden while the grace window still grants
access). `advanceBillingClock(ms)` is the virtual-time escape hatch; the
grace-window rule itself is unit-proven in `@libs/permissions`.

**System snapshots** — `openHarness(id, { snapshot: '<id>' })` restores a
committed fixture from the running package's `fixtures/snapshots/<id>.json`
(portable logical dump: server/client SQL rows + client KV + rooms + clock). A stale `localSchemaVersion` fails restore.

**Host details**

- **`in-process`** — the network mesh (`partition`) is first-class. Server schema is migrated
  **once** per composition into its seed; each `openHarness` clones that seed
  instead of re-running DDL. UI runs on **virtual
  time**: `@pkgs/bun-test-solid/preload` installs a happy-dom document and
  compiles workspace `.tsx` with `babel-preset-solid` + the Lingui macro
  (`@libs/harness/preload` narrows it to a phone viewport) (CSS modules → class-name proxies, media assets → paths);
  `bun test` runs with `--conditions=browser --conditions=development` so Solid
  resolves to its browser dev build. Each actor is one `MultiAppSolidDomSession`
  mount (`launch-actor.ts` → `createSolidDomDriver`); every actor's app keeps
  running (room connections, presence, subscriptions), but only the focused
  actor's container is attached to the document — parked ones are detached,
  not disposed, and reattach on focus. Waits are pump-driven
  (`createHarnessWaitPump` → `runFor`), deadlines on the wall clock.
- **`bun-webview`** — wall time. Default: model network + seed SQL.
  `listenHarnessHttpServer` binds Hono on `127.0.0.1:8787` and enforces createHarnessNet
  crash/partition (actor id via `x-harness-actor`). Tests drive `Bun.WebView`;
  product-harness embeds the web origin URL. `HARNESS_MODE=real` boots sidecars via
  `ensureMaxFidelityStack` (real Postgres + S3rver/EMQX), serves the web client
  (`apps/product/scripts/serve-max-web.ts`), and does not enable `partition`. Snapshot auth KV
  is injected per actor WebView before hydrate.

**Reports** — every harness writes its `report.json` (Gherkin and Quint
steps, the harness calls and UI ops under them, outcomes, drawn traces) into
`<pkg>/.cache/harness-report`, the `test:spec` turbo `outputs`; `bun run
test:report` folds every bucket into one `harness-report/index.html`
([`docs/SPEC_STANDARDS.md`](../../docs/SPEC_STANDARDS.md#reports)). Failed JUnit
testcases also become `test.failure` spans under
`.cache/harness-report/traces/` for `bun obs test`
([`docs/OBSERVABILITY.md`](../../docs/OBSERVABILITY.md)). Capture is owned by
the packages: `defineProductSystem` declares `defineSnapshot`s (`html` per
actor, `topology`), `openHarness` wraps each actor's driver in
`recordingDriver`, and `TestViewportProvider` sizes the 390×844 actor frame.

