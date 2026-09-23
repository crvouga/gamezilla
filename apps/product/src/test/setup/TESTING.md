# Sim tests

Product system + fabric live in **`@apps/product/sim`**. A profile is a named
runtime on the same `product` System; actions, observations, and standing
properties do not change with the profile.

| Profile | Start command | Test command | HTTP / SQL | Vendor ports |
| --- | --- | --- | --- | --- |
| `in-process` (default) | `bun start:in-process` (`/simulator`) | `bun run --filter @apps/product test` | In-process Hono, seeded postgres-mem and sqlite-mem, virtual time | In-memory |
| `localhost:mocked` | `bun start:localhost:mocked` | `bun run --filter @apps/product test:localhost:mocked` | Loopback Hono and built web client on OS-assigned ports; seeded postgres-mem | In-memory |
| `localhost` | — | `bun run --filter @apps/product test:localhost` | Loopback Hono and built web client on pinned `:8787` / `:5173`; embedded Postgres | Google OAuth, Stripe test, S3/MinIO, live TTS/LLM when configured |

`bun start:localhost` runs the API Worker and browser app with embedded services;
it is the normal local app command. The API in both test localhost profiles is
the product Hono app behind the System's load balancer. The mocked test command
runs the same `tests/` suite as the in-process profile. The normal localhost
command runs a browser boot smoke test because it has no dev sign-in. Pass test
file paths to focus a run without changing the test code. Network partition
actions require a profile with the `partition` capability.

Open a run with `openSim` from `apps/product/src/test/setup/open-sim.ts` — a thin
helper over `product.run({ seed, runtime })` (plus snapshot restore + reporter).
The default is `in-process`; choose another profile with
`SIM_PROFILE=localhost:mocked` / `SIM_PROFILE=localhost` or
`openSim(id, { profile: 'localhost:mocked' })`. Standing properties are registered with
`product.property`.

ProductSimulator (`@apps/product`) also calls `product.run` only — default
`runtime: 'in-process'`; localhost profiles use the Node host and a web sidecar.
Neither console nor test opens a Session / `createSim` outside `@apps/product/sim`.

**Authoring** — scenarios import `describe` / `test` from `bun:test` and call
`openSim(testId)`. Drive UI with named `defineAction`s from `@apps/product/sim`
(`s.apply(signInWithDev, 'alice')`). Smart monkey / explore walks are
**only** `defineAction` catalogs: `s.randomActions({ actions: PRODUCT_POOL_ACTIONS })`
or `product.explore({ actions: PRODUCT_POOL_ACTIONS })`. Standing properties
(`noErrorBoundary`, …) run after every checkpoint. Do not use UI-inventory
tap/fill helpers for product monkey testing.

```tsx
import { describe, test } from 'bun:test';
import { openSim } from '../src/setup/open-sim';
import { createSpace, returnToTabs, signInWithDev } from '../src/sim';

describe('space create', () => {
  test('host creates a space', async () => {
    await using s = await openSim('space-create');
    await s.apply(signInWithDev, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
  });
});
```

Faults (partition / restoreNetwork) are `defineAction`s gated by the `caps` read.
On `localhost` (no `partition` cap), `s.apply(partition, …)`
throws `ActionNotEnabled`.

**SQL fabric** — in-process sim always uses **postgres-mem** + **sqlite-mem**
(checkpoint format `mixed-pgmm-sqlm`). Seed:
`apps/product/.cache/sim-backend-seed.pgmm.json`. `localhost` uses
**postgres-embedded** (+ MinIO/EMQX) outside this fabric.

Engine selection lives in `@apps/product/sim` (`getSimSqlEngines` / fabric) — not in
product libs. ProductSimulator web may still load SQLite WASM from
`apps/product/public/generated/` (`bun run --filter @apps/product bundle:sim-sql-wasm`;
wired into `predev` / `setup`). Seed with `bun run --filter @apps/product seed:sim-db`.

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
- **`localhost:mocked`** — wall time with an OS-assigned loopback API and web
  port. The model network still supports crash/partition. Tests drive
  `Bun.WebView`; its actor id is sent as `x-sim-actor`. Test bundles use SQLite
  worker memory because Bun WebView cannot open the OPFS SyncAccessHandle pool.
- **`localhost`** — wall time and pinned ports. It boots embedded Postgres,
  MinIO, and EMQX, loads dev vendor credentials, and disables network
  partition. Both localhost profiles serve the built client through
  `e2e/serve-localhost-web.ts` for tests. Snapshot auth KV is injected per
  actor WebView before hydrate. Manual starts use the normal persistent browser
  SQLite backend.

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
CI / production, not `bun start:in-process`.
