# Gamezilla

Local-first multiplayer game platform. A person opens the app on a phone, tablet, or computer, gets a profile immediately, hosts a live space, and solves chess puzzles there with friends watching. The app works with no connection. What needs other people waits, then catches up on its own.

This file is the one briefing a fresh session should load: product, stack, and how the repo is worked. Executable product truth lives in [`specs/`](specs/). How to write a spec lives in [`specs/README.md`](specs/README.md). The injected agent contract is [`AGENTS.md`](AGENTS.md); it points here and does not restate this file. When this file and a spec disagree, the spec wins. Change product behavior by changing `specs/` first, in a `spec:` commit, then the code.

`docs/` holds one generated file, [`docs/STEPS_CATALOG.md`](docs/STEPS_CATALOG.md) (`bun run spec:catalog`). Package READMEs describe that package's API (`pkgs/room`, `pkgs/harness`, `pkgs/sync-engine`, and a package's own `docs/` when it has one). They are not a second copy of this file.

Private repo: `crvouga/gamezilla`. Package manager: Bun `1.4.2` (`mise.toml`; 1.3.x fails wildcard `.tsx` subpaths on CI). Node `>= 22`. Language of the app: English. Day boundary for limits: midnight UTC. Primary client: a phone's Chrome, including low-end Android (~2 GB). Not desktop-first, and not Capacitor.

## Words

Scenarios name people (Alice, Bob) or a role (a guest, a member). The shared kernel is person, device, fresh device, the app, connection (offline / back online), and the team (the people who run the product).

| Say | Means |
| --- | --- |
| person, guest, account, sign in, sign out | identity. A guest already has a username, avatar, and profile. First sign-in keeps that profile. |
| sign-in method | Google or Apple. At most one of each per account. The last one stays. |
| username | `@name`, unique ignoring case, stored lowercase. |
| free account, Plus, Plus member, paid access, free access | billing. Plus is what a signed-in person pays for. |
| space, host, join, leave, end a space, open space, lobby, space link | a live place. The host created it. The host leaving ends it. Disconnecting is not leaving. |
| puzzle, puzzle feed, puzzle rating, solve | chess, played inside a space. |
| friend, friend request, block, people search, inbox, notice | social. Friends require an account and a connection. |
| note | the sync-engine's worked example of a shared row. People do not have a notes product. |

Out of vocabulary in product text and product code: user, customer, log in, tier, premium, session (for a space), invite link, game room, anonymous user. Shell chrome shows who is signed in. It does not show a plan name as a rank.

## Who someone is

Three kinds of person, from [`specs/conformance.yaml`](specs/conformance.yaml):

| Kind | How they get there | What is limited |
| --- | --- | --- |
| guest | opens the app; a real account row exists before any sign-in | 20 rated puzzle starts per UTC day. 1 open space hosted at a time. Friends, feed customization, and subscribing ask them to sign in. |
| free account | signed in, no paid access | same hosting limit (1). No daily puzzle limit. |
| Plus member | signed in, membership live, or ended inside grace | no hosting limit. No daily puzzle limit. |

Reaching a limit is an invitation (sign in, or Plus). It is never an error screen.

Paid access is per person, on every device they are signed in on, online or offline. It starts when checkout succeeds. A 7-day free trial starts on the monthly plan. A Plus member is offered to manage the membership, never a second membership on top of a live one. Leaving checkout without paying changes nothing. Subscribing needs a connection. A failed payment stays paid inside grace; the membership ends when the provider gives up on the payment. A refund removes paid access at once. Canceling in the portal keeps paid access through the period end, then for 7 days of grace. A Plus member who is offline keeps paid access for those same 7 days.

## What the app is

Bounded contexts in `specs/`. Each folder is one context. The file extension says the kind of truth: `.feature` observable behavior, `.dmn` decisions, `.qnt` what can happen over time, `.als` which snapshots are valid, `.openslo.yaml` how well it must work.

| Context | Code | What it is |
| --- | --- | --- |
| Identity | `@libs/profile` (`specs/profile/`) | Guest from the first open. Sign in with Google (everywhere) or Apple (outside production) on any device. Sign out is per device and works offline. Sign out everywhere catches an offline device when it returns. Username and avatar edits stick. |
| Auth | `@pkgs/auth` + `@pkgs/auth-inhouse`, product wiring in `@libs/auth` (`specs/auth/`) | Each Google or Apple account belongs to exactly one Gamezilla account. A matching account is confirmed before a new outside account is added. An unverified address match waits until the person proves it. Accounts never merge silently. An identity never moves. The last sign-in method stays. Provider trouble does not let anyone into the wrong account. A sign-in lasts until sign-out or it lapses. |
| App | `@libs/client-app`, `@libs/runtime` (`specs/runtime/`) | Opens onto the Spaces tab, including with no connection after the first open. Tabs: Spaces, Notifications, Profile. Settings is reached from the tabs; theme, sounds, and version stick per device. An unknown address says so and offers the way back to Spaces. An app too old is told to update and keeps what is on the device. Usable without sight and without a mouse. |
| Spaces | `@libs/spaces` | A person hosts a space (a guest may host). Friends join from the lobby. Anyone with the space link joins, including a guest. The lobby lists open spaces they host, have joined, or that a friend is in. Host renames, ends, and chooses the game. Host leaving ends the space for everyone. Presence is live. Creating and joining need a connection and say so; losing the connection is recoverable and is not leaving. Puzzle play already on the device continues offline (chess). A space link keeps leading to that space, or says the space ended or does not exist. |
| Chess | `@libs/chess`, board in `@pkgs/chess-board` | The only shipped game (`GAME_DEFINITIONS` in `libs/games/src/game-plugins.ts`). An endless puzzle feed inside the host's space. Friends watch the same line. Rating, accuracy, and a game log stay honest online and offline. Hint, retry, skip, solution, clock. Feed settings (themes, rating window) require an account and sync across devices. Guest progress carries into the account on sign-in. The pool rejects puzzles that cannot be solved. |
| Friends | `@libs/friends`, search UI `@libs/search`, inbox `@libs/notifications` | Ask, accept, decline, cancel, remove, block, unblock. People search. Profile changes reach other people. An open space a friend is in shows up. Needs an account and a connection. |
| Billing | `@libs/billing`, providers `@pkgs/billing-stripe` and `@pkgs/billing-paddle` via `@pkgs/billing-providers` | See the plans, subscribe, trial, renew, switch monthly/yearly, switch provider, portal, cancel, resubscribe, failed card, expired card, refund, Plus credit when switching plans. Membership is managed by the person. |
| Sync | `@pkgs/sync-engine` (`specs/sync-engine/`) | Shared rows (spec'd as notes) show at once, survive crash, offline, and app update, and count once. Leave a shared place and rejoin to catch up. Some actions are online-only and do not fire later. Server arrival order wins. |
| Room | `@pkgs/room` (`specs/room/`) | One live topic. Shared tally, who is in the room, who owns it, timed match. Same picture after offline time or a crash. This is the session engine spaces and games sit on. It is separate from sync. |
| Matchmaking | `specs/matchmaking/`, engine `@pkgs/matchmaking` | People waiting are paired with someone they accept who accepts them. A match already made is kept. Specified. Not in the shipped feature fold (`APP_FEATURES`). |
| Health | `specs/health/` | Promises a live environment keeps right now, seen by the team from outside: reach the app, sign in, serve people, spaces, live updates, uploads, payments real only in production, outside services, request trail, find a person's trouble, environment matches the plan. |
| Journeys | `specs/journeys/` | Flows that must not break where people use the app: open past the opening screen, Google sign-in and the way back, sign out, host a space and end it, start a puzzle, keep an avatar edit, people search, see what Plus offers. Plus [`specs/journeys/join-and-offline.feature`](specs/journeys/join-and-offline.feature). |

### Capabilities

Each is one decision table. Enforcement is `@libs/permissions` only.

| Person may… | Context | Decision |
| --- | --- | --- |
| keep a friends list, use people search, get notifications | friends | access |
| see the billing plans, subscribe, use the billing portal | billing | access |
| wait for a match | matchmaking | access |
| play puzzles | chess | access |
| customize the puzzle feed | chess | access |
| solve a rated puzzle | chess | daily-puzzle-limit (20/day, guests, midnight UTC) |
| create a space, join a space | spaces | access |
| host another open space | spaces | hosting-limit (1 for guest and free account) |
| leave, rename, end, manage members, make the game choice | spaces | space-roles (host) |

### Promises a rewrite keeps

- A space link keeps taking whoever opens it to that space.
- Every address the app shows keeps working. An address that leads nowhere says so and offers a way back.
- An older app is told to update and keeps everything saved on the device.
- The team can always ask a live environment whether it is well.

Promised environments: a phone's web browser (Chrome, the primary way), online, offline for as long as people keep using it, an app one version behind, English, UTC.

### Critical journeys

Opening, Google sign-in with a way back, sign out, host then end a space, a puzzle ready to play, an avatar edit kept, people search returns an answer, Plus plans are visible. Joining from a link, and opening with no connection, is its own feature. Production hosts these inside the free-account one-space limit, so a journey ends leftover spaces before it creates another.

## How the running system is shaped

Two data planes.

**Sync** is the system of record for durable rows (profile, friends, billing facts, puzzle history, space membership). The device reads and writes local SQLite. A write is a mutation: applied locally in the same transaction, queued, uploaded. The server replays it in one Postgres transaction as the signed-in person and pushes the change to subscribed devices. Conflicts resolve in server arrival order (last write wins). Domain rows are removed by setting `deleted_at`. UI reads filter `deleted_at IS NULL`. Merge upserts snapshot rows and rebases pending mutations on top. Wire protocol is v3 (`x-sync-protocol: 3`); an older client gets `upgrade_required` and its local database is kept. Hydration is `POST /api/query` on connect plus pubsub pushes. Mutations drain through `POST /api/mutations`. MQTT (AWS IoT Core in production) is an invalidation signal. A missed message is recovered by refetching from Postgres.

**Room** is the live session for one topic, usually `space:<id>`. `@pkgs/room` keeps one authoritative event log. The client runs the same `RoomModule` for instant feedback; the server validates and orders. Optimistic commands queue and flush. Durable Objects host rooms in production. Time-sensitive rules (clocks, deadlines) are schedules the server wakes. Room state is not the SQL sync log.

**Permissions** answer every "may this person…?". Client: `useCan` / `useDecision` / `usePermissions`. Mutation body: `requireInMutation` / `decideInMutation`. Server route: `requirePermission`. A denial renders through `DenialSurface` or `useUnlock` from policy `unlockRefs`. Product code outside auth, billing, and permissions does not read anonymous-vs-signed-in flags, does not query billing tables for access, and does not name a role or a plan.

**Auth on the wire.** Token only. The API does not read or set cookies. Requests carry `Authorization: Bearer <session-token>` and the install id in `x-anon-id`. One current person per install. Several sign-in methods can sit on one account. Local SQLite on the web client is not encrypted at rest. Each account has its own file (`user_<shortId>`), so one account's queries do not read another's rows. Do not put secrets, or data that must not be lost with the device, only on the device.

**Composition.** `@libs/runtime` is the only package that lists features. `APP_FEATURES` in `libs/runtime/src/root/app-features.ts` folds schema, queries, topics, and mutations. `APP_FEATURE_CLIENTS` folds routes and chrome. Order matters: profile is outermost, friends mounts above notifications. A feature never imports another feature. Cross-feature needs are ports the composition root fills (`readsForeign` is the checked exception). Shells (`@libs/client-app`, `@libs/server-app`) take the feature list as an argument, so a test boots one feature or all of them with the same code.

Shipped feature manifests, in fold order: auth, profile, client-config, spaces, friends, notifications, chess, billing, permissions. Client fold also mounts search.

```text
device UI (Solid)
  useQuery  -> local SQLite (sqlite-wasm, one file per account)
  mutate()  -> local txn + outbound queue
        |  POST /api/mutations          POST /api/query + MQTT invalidation
        v
API Worker (Hono, production handler)
  authn -> permission -> replay mutation in one Postgres txn
  notify channels
        |
        +--> PlanetScale Neki (Postgres) via Hyperdrive
        +--> room Worker --> Durable Object per topic
        +--> R2 for uploads and the spec-report bucket
```

## Repository

Bun workspaces: `apps/*`, `libs/*`, `pkgs/*`.

| Tier | Path | May import | Holds |
| --- | --- | --- | --- |
| Apps `@apps/` | `apps/` | apps, libs, pkgs | deployed surfaces |
| Libs `@libs/` | `libs/` | pkgs, other libs' `public/` | product features, shells, runtime |
| Pkgs `@pkgs/` | `pkgs/` | pkgs only | frameworks. No `gamezilla`, `@libs/*`, or product names anywhere in these packages |

| App | Role |
| --- | --- |
| `@apps/client` | Vite shell: `index.html`, service worker, PWA, bundle budget. `bun run dev:client` runs it alone. |
| `@apps/server` | API Worker. Source is isomorphic; `pg` and `node:*` only behind ports in modules marked `@api-wall-ok`. |
| `@apps/room-server` | Room Worker and Durable Object. |
| `@apps/product` | Super-app the laptop runs: web app, harness, simulator, localhost stack. |
| `@apps/auth-relay` | Global OAuth callback Worker at `auth.<zone>`. |

| Platform lib | Role |
| --- | --- |
| `@libs/runtime` | Composition root, migrations, schema snapshot. |
| `@libs/feature` | Manifest algebra. Imports no feature. |
| `@libs/client-app` | Providers, router, chrome, sync boot. |
| `@libs/server-app` | Request scope, auth, sync, rooms. |
| `@libs/client-config` | Synced runtime config (EMQX/MQTT URL, observability). Not `VITE_*`. |
| `@libs/permissions` | The only access decisions. |
| `@libs/secrets` | Infisical registry and `secrets-run`. |
| `@libs/infra` | OpenTofu. The only place infrastructure is declared. |
| `@libs/harness` | Product spec runner. |
| `@libs/tools` | Lint, CI, git-sync, naming, spec checks. |
| `@libs/games` | Registry of game plugins. Chess is the only entry. |
| `@libs/observability` | Product telemetry wiring. |

A product lib is one use case deep:

```text
libs/<feature>/src/
  use-cases/<use-case>/{client,shared,server}/
  shared/          domain types, repos, RoomModule, schema
  root/            feature manifest, screens, chrome
  harness/         spec actions and reads
  public/          what other libs may import
```

Package `exports` are `./public/*`, `./root/*`, and `./harness/*`. Use cases do not import other use cases, `root/`, or `public/`. `shared/` does not import `client/`, `server/`, `use-cases/`, `root/`, or `public/`. Client and server do not import each other.

Adding a feature: package under `libs/<name>/`, `defineTable` schema, `defineFeature` manifest, one line in `APP_FEATURES`, and client/server manifests if it has UI or routes. A feature exports up to three manifests, folded by the same functions in production and in tests: `FeatureManifest` (tables, topics, queries, mutations), `FeatureClient` (routes, chrome), `FeatureServer` (HTTP, outbox, pubsub).

Where a test goes: one feature's behavior stays in that feature's `tests/`, booting only the slices it needs. A test that spans features belongs in the full composition (`@libs/runtime`). `tests/harness/` holds composition only, never a `*.test.ts`. No spec lives in `apps/`. A framework package (`@pkgs/sync-engine`, `@pkgs/room`, `@pkgs/matchmaking`, …) is tested through one kitchen-sink example app under `src/harness/example-app/` (or `tests/example-app/`). A new capability grows that app. It does not fork a second fixture.

Known cross-feature table reads, still debt: `permissions` reads `billing_subscriptions` (so billing reruns every feature spec); `spaces` reads `friends_friendships` (spaces specs live in `@libs/friends`); `search` reads friends' search query and `friends_blocks` (people search lives in `@libs/friends`). Prefer a port the composition root fills.

### Framework packages that matter

| Need | Package |
| --- | --- |
| UI components, tokens, theme | `@pkgs/ui` (in-house only; no third-party component library) |
| Solid context helpers | `@pkgs/solid-context` |
| Local-first sync | `@pkgs/sync-engine` entries: `client`, `server`, `shared`, `harness`, `solid` |
| SQL tables | `@pkgs/db-schema`, emitted by `@pkgs/db-schema-postgres` and `@pkgs/db-schema-sqlite` |
| SQL clients | `@pkgs/sql-client-sqlite-web` (browser), `@pkgs/sql-client-postgres` (server) |
| Migrations | `@pkgs/db-migrate`, composed by `PostgresMigrationRunner` in `@libs/runtime` |
| Live sessions | `@pkgs/room`; adapters `room-adapter-durable-object`, `room-adapter-web`, `room-adapter-bun`, `room-adapter-memory` |
| Clock, timers | `@pkgs/clock` |
| HTTP | `@pkgs/http-client` |
| Ids and randomness | `@pkgs/uuid` (`createId`, `random`) |
| Auth port | `@pkgs/auth`; vendor `@pkgs/auth-inhouse` |
| Billing port | `@pkgs/billing`; vendors stripe and paddle, listed only in `@pkgs/billing-providers` |
| Object storage | `@pkgs/object-store`; S3/R2 `@pkgs/object-store-s3`; browser OPFS `@pkgs/object-store-opfs` |
| Pubsub | `@pkgs/pubsub`; MQTT `@pkgs/pubsub-mqtt` |
| Key-value | `@pkgs/kv` |
| Spec languages | `@pkgs/gherkin`, `@pkgs/quint`, `@pkgs/dmn`, `@pkgs/alloy`, `@pkgs/openslo` |
| Property tests | `@pkgs/property` (`assertProperty` only) |
| Harness report UI | `@pkgs/harness-report` at `/reports` |
| Chess rules and board | `@pkgs/chess-rules`, `@pkgs/chess-board-core`, `@pkgs/chess-board` |
| Rating math | `@pkgs/glicko2` |
| i18n | Lingui (`@pkgs/i18n`). Catalogs compile to `libs/client-app`. |
| Observability | `@pkgs/observability`, CLI `@pkgs/observability-cli` (`bun obs`) |
| Assert-and-crash | `@pkgs/assert` |

UI is Solid. Components run once; reactivity tracks. Read `props.x` in the component body (never destructure props). Style with `class` / `classList` and `@pkgs/ui` tokens. `style` is only for dynamic values classes cannot express. `data-component` and `data-screen` exist for tests and are stripped from production bundles. `data-testid` ships in every build because live journeys drive the real bundle by it. Mutation weight picks the widget: `MutationModal` for confirm-first actions, `useMutationButton` for lightweight actions, `FormActionsFooter` for screen forms.

## Deployed stack

Growth adds usage and cost. It does not add servers. Application code owns logical keys (`gameId`, `queryHash`, partition keys, object keys). Providers own physical scale.

| Need | Production | Laptop (`bun run dev`) |
| --- | --- | --- |
| API compute | Cloudflare Workers | Bun processes running the same Worker handler, behind a local load balancer. Room upgrades hash to one instance per topic. |
| CDN / web | Cloudflare CDN | Vite preview |
| Live rooms | Cloudflare Durable Objects | Bun room adapter |
| Object storage | Cloudflare R2 | S3rver (`@pkgs/s3-server`) |
| SQL | PlanetScale Neki (Postgres) via Hyperdrive, region `us-east-1`, org slug `gamezilla` | embedded Postgres (`@pkgs/postgres-embedded`) |
| Invalidation | AWS IoT Core MQTT, custom authorizer | Aedes, or the EMQX sidecar |
| Sign-in | Google. Apple outside production. | Mockingbird OAuth (`@crvouga/mockingbird-service-oauth`) speaking the real protocols |
| Payments | Stripe and Paddle modules; access only after a verified webhook | Mockingbird Stripe (`@crvouga/mockingbird-service-stripe`) |
| Secrets | Infisical. CI assumes AWS with GitHub OIDC. | `.cache/secrets` via `bun run secrets:pull` |
| Traces | Grafana Cloud (one stack; free plan allows one) | local / same pipeline |
| Spec reports | private R2 bucket, published by `bun check`, streamed at `/api/reports` | same client at `/reports` |

Every deployed resource is OpenTofu under `libs/infra/tofu`. Modules and stacks are env-agnostic. Per-environment values are only `libs/infra/tofu/envs/<env>.tfvars.json` (`prd`, `dev`) plus `global.tfvars.json`. TypeScript, scripts, and consoles do not create infrastructure. Worker code and Durable Object migrations ship with `wrangler deploy` (the Cloudflare provider does not apply DO migrations reliably). Hostnames come from the edge stack. Postgres tables ship with `@libs/runtime#migrate`. The billing catalog ships with `@libs/billing#billing:sync`. The Cloudflare zone, the PlanetScale organization, and human secrets are asserted, not created.

Layout: `modules/` (state, ci-identity, aws-ci-identity, repository, naming, object-store, pubsub, trace-stack, observability, database, secrets, edge), `stacks/` (`bootstrap` by a person, `fleet` global, `foundation`, `edge`), `envs/`, `policy/stateful.rego`, `scripts/tofu.ts` (plan, apply, drift, destroy). State is an R2 bucket, key `<stack>/<env>.tfstate`, encrypted with `TOFU_STATE_PASSPHRASE`. GitHub Actions assumes `AWS_ROLE_ARN` with the job OIDC token. The Worker IoT publish key is a generated IAM user (`iot:Publish` only). Do not `tofu apply` from a laptop against production.

Four layers keep data: `prevent_destroy` on global state, the Grafana stack, the repository, the shared secrets environment, and production's Neki branch; `stateful.rego` allow-lists what an ordinary apply may delete (credentials, DNS, routing, connection config, derived secrets — Neki branches and roles are protected; a production mass-delete is refused); `removed { lifecycle { destroy = false } }` forgets a resource; the zone and human secrets are assert-only. Every apply copies state to `backups/<stack>/<env>/<timestamp>.tfstate`. Neon and the old Railway broker are forgotten that way, not deleted by an apply.

```sh
bun run infra:bootstrap
bun run infra:fleet
bun run --filter @libs/infra plan:foundation    # SECRETS_ENV picks the env
bun run --filter @libs/infra plan:edge
bun run infra:destroy -- --env <env> --confirm <env>   # protection: standard only
```

A standard teardown runs deploy in reverse (edge, Workers, empty the bucket, foundation, that env's fleet entries) and leaves the env file, so the next deploy rebuilds an empty database plus migrations. Deleting the env file alone deletes nothing. To add an environment: copy `dev` without `imports`, set `protection: "standard"`, register it in `libs/infra/src/public/envs.ts`, merge. Deploy runs every standard env in parallel, then production. Health probes every env hourly. Rehearse with `bun run deploy:dev` before merging anything that touches deploy, infra, secrets, Workers, or health, and merge soon after: a rehearsal adopt sits in dev state until the branch lands.

Each environment is its own Neki database (`gamezilla-production`, `gamezilla-development`), branch `main`, `us-east-1`. Roles: `migrate` (inherits `postgres`, `DATABASE_URL`, DDL), `app` (read/write all data, Hyperdrive, the Worker), `obs_read` (read-only, `OBS_READONLY_DATABASE_URL`). The Worker never dials Neki. Hyperdrive pools the app role and caches nothing, so hydration reads its own writes. The Neki login name may be suffixed; the exact-name `obs_read` grant is skipped then, and `pg_read_all_data` still covers `SELECT`.

IoT is one data plane per env. Public hostnames stay `emqx.gamezilla.app` and `emqx-dev.gamezilla.app` (`wss://<host>/mqtt`, secret `EMQX_WSS_URL`, synced key `emqx_wss_url`). The authorizer is a Node 22 Lambda checking the API's HMAC JWT (`EMQX_JWT_SECRET`); caching is off. App topics use `:`; the IoT wire uses `/` (`user:actor1` → `user/actor1`) at that boundary only. Loopback brokers keep colon topics. There is no deployed EMQX.

Secret kinds in `stacks/foundation/secrets.json`: `shared` (a person, once, `bun run secrets:seed`), `human` (asserted), `generated` (OpenTofu, existing value wins), `derived` (resource outputs: `DATABASE_URL`, `HYPERDRIVE_ID`, `S3_*`, `IOT_*`, `API_URL`, `OBSERVABILITY_*`). Account-wide credentials live in the `shared` Infisical environment and are imported everywhere. Unknown keys are left alone. The registry of names the app needs is `libs/secrets/src/shared/secrets/registry.ts`. Google has one redirect, `https://auth.gamezilla.app/api/auth/callback/google`; the relay Worker forwards by the OAuth state tag, so a new environment needs no console edit.

Object keys are prefixed with the product namespace (`gamezilla/`) before any feature prefix. R2 endpoint is `https://<accountid>.r2.cloudflarestorage.com`, region `auto`. `bun health` checks each required secret live. `bun check` does not.

Deploy chain:

```text
deploy:fleet   auth-relay Worker, then fleet stack (global, once)
deploy:<env>   foundation -> migrate -> room-server -> server -> product
               -> edge -> billing:sync -> health
```

`bun deploy` ships `main` only. Rehearse deploy, infra, secrets, Workers, or health with `bun run deploy:dev` before merging.

Non-deploy commands cannot reach production Postgres. `DATABASE_URL` entrypoints reject production env and production hostnames (`@libs/db/public/database-url-policy`). `bun run db:wipe:dev` refuses `ALLOW_PRODUCTION_DATABASE_URL=1`.

## Laptop

`bun run dev` (alias `bun run stack`) boots embedded Postgres, S3rver, Aedes, simulated Google, Apple, and Stripe, N API nodes, and the product web app (`/`, `/harness`, `/simulator`). Ports are OS-assigned and published to `.cache/localhost-stack/<instance>.json`. `source libs/tools/workspace/port.sh` before a sidecar. EMQX (`1883` / `8083` / `18083`) and the wrangler preview (`8788`) are machine-wide; one workspace binds them at a time.

```bash
bun run dev                         # 2 API nodes
bun run dev --api-nodes 4
bun run dev --instance alpha        # named data dir
bun run dev --web-port 5264         # workspace run script pins this
bun run dev --no-mqtt --no-s3
bun run kill                        # stop the stack
bun run db:migrate                  # migrate DATABASE_URL
bun run psql                        # local Postgres shell
```

Simulated Google starts as `alice@gmail.com` through `fred@gmail.com`. Apple starts as `alice@icloud.com`, `bob@icloud.com`, `chris@gmail.com` (the same person as Google's chris, so linking can be exercised), and `dan@icloud.com`, and offers Hide My Email. No passwords: the chooser lists the accounts. Apple is mock-only: enabled by all five `APPLE_*` bindings, refused when `SECRETS_ENV=prd`.

`--idp-state` is `memory` (default, forgotten on exit), `instance` (survives a restart when `--keep-data` is set), or `path` (never deleted by stack cleanup). Signing keys are not persisted, so a restarted provider invalidates ID tokens it already issued. API sessions already issued stay valid. Local Stripe (`BILLING_PROVIDER=stripe`) is reconciled by `billing:sync` at boot. Pay with `4242 4242 4242 4242`. State is `<instance>/billing.sqlite`. `[stack] ready` means every API node answered a real request. `/api/health` can pass while the worker is in `api misconfigured`.

`@apps/client` setup writes local `VITE_*` values and refuses the production API unless `VITE_ALLOW_PRODUCTION_API_URL=1`. `bun run pwa:generate` (from `apps/client`) refreshes the manifest and icons. `bun run build` there runs Vite, then Workbox writes `dist/sw.js`. A stuck cache is cleared at `/unregister.html`, or by Clear local data & reload. Optional bundle treemap: `ANALYZE=1 bun run --filter @apps/client build`.

`bun run dev` is for building. A green `bun check` is the release decision. Looking at the app is not evidence. If a behavior cannot be reached by a check, change the product until one can.

The phone critical path is the Vite static entry (HTML, first CSS, JS, fonts, images). `sql-workers` and `.wasm` stay off it until after first paint. Do not move a static import to a top-level `import()` to satisfy the walker; that fails too. Shell code does not statically import `@libs/games` or `@libs/chess`. No third-party `<script src>` in `index.html` unless `INDEX_HTML_SCRIPT_ALLOWLIST` names it. Prefer the system font stack (0 KB). An added `@font-face` uses `font-display: swap` or `optional`. SQLite open waits until after fonts. Game plugins load only under `/space/*`. DiceBear loads only when an avatar config exists. The perf HUD (`libs/client-app/src/shell/perf/`) is diagnostic. Production assets are Workers on `www.gamezilla.app`; the edge picks brotli, then gzip. There is no bundle-size budget. The gates are static and can fail. They are not warn-only.

## Correctness machinery

Time, timers, ids, randomness, HTTP, and filesystem content are injected. Product code (`apps/`, `libs/`, `pkgs/`, scripts) does not call `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout`, `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random`, or `crypto.getRandomValues`. Composition roots (`createClient`, `createServer`, `createRoomServer`, `createHarness`) unpack ports. Solid reads them from context (`useClock`, `useTimers`, `useHttpClient`, `useCreateId`). Wall adapters live in tests or in files marked `// @io-wall-ok`. SQL does not mint time or ids (`now()`, `gen_random_uuid()`, and the rest are rejected). `Session` is harness-only. Libraries require the ports. An optional `io?` in shared game or domain code is rejected. File content goes through `@pkgs/object-store` (`sidecar` for blobs, `tree` for path-keyed trees). Process spawn, chmod, and path roots stay on `@pkgs/os`. Same seed produces the same path, bit for bit.

Shared game, domain, and sync code also avoids: IEEE floats in room event payloads (integers or strings; Glicko may float and then `Math.round` before it is stored); unsorted `Object.keys` for a hash, a serialization, or a turn order (`hashRoomState` / `canonicalJson`, or a `Map`); `localeCompare`, `Intl`, and `toLocaleString` (compare code units); `Promise.race` or microtask order as a durable winner (use `io.timers`); branching on `WeakRef`, `FinalizationRegistry`, or GC. Every `RoomModule` implements `hash(state)`. Social merge is server-arrival last-write-wins, not a CRDT. A new merge rule names its tie-break.

Specs are the definition of done. A rewrite that passes `specs/` is the same product. Kinds required by `specs/conformance.yaml`: behavior, decisions, dynamics, structure, objectives, accessibility. `UNKNOWN`, skipped, not run, manual, or stale evidence fails the release. Manual QA does not satisfy a gate.

Tests are black-box against package `exports`, live in `tests/`, and run with `bun test` in-process on virtual time. Only `*.contract.test.ts` may touch the wall, and those boot their own Postgres, S3, and EMQX sidecars. Spec steps are thin wrappers over a package's `./harness` actions and reads. No skipped, `.only`, `.todo`, `.if`, `.failing`, `--pass-with-no-tests`, or retries. A verdict never branches on `CI`.

New behavior is a property or a model. `assertProperty` from `@pkgs/property` is the only entry: seed `FC_SEED` default `424242`, runs `PBT_NUM_RUNS` default `40`. Raw `fc.assert`, `fc.check`, `fc.sample`, and `fc.statistics` are banned. Name the file `<topic>.property.test.ts`. A fingerprint binding replays its longest trace twice in fresh worlds and the hashes must match. `bun run test:pbt:random` hunts past the pin; whatever it finds is pinned before it is fixed. Product dynamics are a Quint model in `specs/<domain>/`, not a random walk in a test. A bug pins the shrunk input with `// regression: <bug-id>` (or `@regression:<bug-id>` on a scenario) and an entry in `libs/tools/goal/known-bugs.json`. That guard is an example, never a property file. A decided number, wire shape, or migration output is also an example. An example that a property fully covers, and that is neither a bug nor a decided value, is deleted.

Gates that enforce this: `behavior-tests.ts`, `no-skipped-tests.grit`, `no-unpinned-property.grit`, `no-wall-time-in-tests.grit`, `test-scripts.ts`, `tc-scope.ts`, `//#ci:goals`, `check-worker-bundle.ts`, `check-offline-shell.ts`, `no-ci-verdict.grit`, `no-bare-io.grit`, `check-budget.ts`. A task budget is raised only after the task is made faster, with the measurement in the commit body. Check run deadline is 10 min on a laptop and 20 min on CI. Deploy run deadline is 45 min. One task is 300 s, doubled on CI. `CHECK_DEADLINE_SECONDS` overrides one run. There is no off switch.

Three workflows, dispatched from the laptop and blocked on the verdict:

| Command | Question | Local equivalent |
| --- | --- | --- |
| `bun check` | Is this commit the product? | `bun check:local` |
| `bun health` | Is this deployment well? | `bun health:local`, `bun health:prd` |
| `bun deploy` | Ship `main`. | `bun deploy:local`, `bun deploy:dev`, `bun deploy:prd` |

`bun check` git-syncs, runs on GitHub (`.github/workflows/check.yml`), and publishes the spec report to `/reports/<sha>`. It refuses to run on `main`. `bun check:local` runs the same leaves on this machine and publishes nothing. Per-package tasks (`tc`, `lint`, `test`, `test:contract`, `test:spec`) are cached and read only that package. `lint` is naming, Biome (import boundaries and size caps), oxlint for Solid, package boundaries, known-bug regressions. Typecheck is `tsc --noEmit -p tsconfig.tc.json` per package. Format with `bun fmt`.

Exactly three workflows, on `ubuntu-latest`. Check runs on PRs (`//#check`, `SECRETS_ENV=dev`, sharded, then the report publish). Deploy (`.github/workflows/deploy.yml`) runs on `main` after a merged PR, standard envs in parallel, then production, and re-runs the gate first. Health (`.github/workflows/health.yml`) runs hourly, deploys nothing, and probes every env file. `bun health` git-syncs, including `main`, and dispatches Health. `bun deploy` does not commit: it fast-forwards local `main` and dispatches Deploy on `origin/main`. Cancelling Deploy does not roll back an apply that already started. A new check is a package task under `//#check`, never a fourth workflow or a new job. Required GitHub check is `check` only (`global.tfvars.json` `github.required_checks`). Merge commits only. `pre-push` refuses `main`.

The spec report is part of Check. Check is red if it did not publish. One private R2 bucket (`reports` in `global.tfvars.json`) holds `commits/<sha>/`. Each environment's API streams it (`/api/reports`). Snapshots are recorded on every harness step. A red suite still publishes. `bun check:local` does not.

Health and critical journeys are Gherkin. `specs/health/` checks that an environment is configured as declared (DNS, TLS, Workers, Postgres, R2, IoT, Grafana, secrets, billing keys, the Google client, drift), read-only, from `@libs/infra/public/envs`. `specs/journeys/` runs in `bun check` against the full composition and, on Health, in a real browser against the deployment, one fresh device per scenario. Signed-in journeys trade `SYNTHETIC_MONITOR_TOKEN` at `POST /api/auth/synthetic-monitor/code`. A live failure saves a screenshot under `apps/product/.cache/critical-journeys/<scenario>/`. Liveness is `GET /api/health`. Readiness is `GET /api/health/ready` (`503` when `SELECT 1` fails within 3 s). UI tests in Check use happy-dom. `HARNESS_MODE=real` and `stack` use the same `Driver` on `Bun.WebView`.

While iterating, prefer `bun run --filter <pkg> tc` and `bun run --filter <pkg> test` before a full check.

Debug with `bun obs` before adding logs. Exit `0` found, `1` no match, `2` usage, `3` store unreachable. `--json` is for programs.

| Need | Command |
| --- | --- |
| It just happened | `bun obs last --window 10m` |
| Any id | `bun obs find <id>` |
| A person, a place, a clock | `bun obs person --name "…" --at "6:33pm MST" --place "Gilbert, Arizona" --source prod` |
| Slow | `bun obs slow --since 1h --layer db` |
| A write | `bun obs mutation <mutation-id>` |
| A CI spec | `bun obs test '<exact test name>' --source <artifact>` |

Arizona is UTC−7 all year. Place matches the connection's city, region, or country, separate from the device clock. `--source prod` loads `OBS_TEMPO_*` and `OBS_READONLY_DATABASE_URL`. It does not load `DATABASE_URL` or `GRAFANA_CLOUD_API_TOKEN`. Never hand an agent that admin token. Display names resolve in Postgres. Only the account id goes to Tempo. Email is never a span attribute.

Traces: harness writes `.cache/harness-report/traces/spans.ndjson` and Check uploads `observability-traces-<run-id>`. `bun run dev` collects OTLP in process (`--observability lgtm` adds Grafana in Docker; `--no-observability` turns it off). Deployed Workers export to the one Grafana Cloud Tempo stack. `OBSERVABILITY_ENABLED=0` is the kill switch. Deploy fails closed without the collector URL and write token. Seed `GRAFANA_CLOUD_API_TOKEN` once with `bun run secrets:seed`.

Recording uses the OpenTelemetry API only, at boundaries (runtime entry, interaction, route, error, HTTP, SQL, room, sync, logger, test-failure sink). Business code does not import observability (`observability-boundary-imports.grit`). Span names are stable lowercase `{domain}.{action}` with no interpolated id. Attributes come from `ATTR`. Redaction is default-deny. Sampling is 100% locally and in CI. Production is head sampling. Telemetry is not the source of truth. A mutation stores its id and `traceparent` in the outbox.

## How a change lands

Commit and push only through `bun run git-sync` (message is a Conventional Commit, subject ≤ 72 characters, no trailing period). The script commits, pushes the feature branch, merges `origin/main`, pushes again, and fast-forwards local main. It does not force-push and does not push `main`. On conflict it aborts unless `--leave-conflicts`.

A commit that touches `specs/` or any `.feature` file is `spec:` or `spec(scope):` and may only change `specs/`, `.feature` files, `STEPS_CATALOG.md`, and `docs/*.md`. Implementation follows in a later commit. `STEPS_CATALOG.md` files are generated; regenerate with `bun run spec:catalog` after a merge.

`main` moves only when a person merges a green PR. Agents do not merge, do not use `--admin`, and do not create branches or worktrees. Commit on the branch and worktree already checked out. PR body follows `.github/PULL_REQUEST_TEMPLATE.md`.

Repo file names: markdown docs are `SCREAMING_SNAKE_CASE.md` (`README.md` matches); every other file and directory is `lower-kebab-case`. `bun run lint:naming` checks; `bun run naming:fix` rewrites.

## Invariants that make a patch wrong

- Specs describe what a person observes. This file is a briefing. It is not a second product definition.
- One write path: `mutate()` / `defineMutation`. Domain SQL runs inside the mutation. No feature REST for synced data. Billing and external webhooks are the exception list; do not grow it.
- No `DELETE FROM` on a domain table. Framework `sync_engine_*` tables may hard-delete.
- No bare I/O. No `Io` bag, no silent wall-clock fallback.
- No access checks by reading `is_anon`, subscription rows, role names, or plan names from feature code.
- No new dependency patches (`bun patch`, `patches/`, `resolutions`).
- No `@deprecated` aliases or shim re-exports. Delete the old API and update call sites in the same change.
- No new `'off'` or `biome-ignore` for the Tiger-Style size caps in `biome.json` (lines per file, lines per function, params, nested callbacks, cognitive complexity, classes per file). Extract a function or a component.
- `pkgs/` stays product-agnostic.
- Infrastructure changes are `.tf` and `envs/*.tfvars.json` only.
- Vendors are simulated by Mockingbird. A gap in a simulated vendor is an issue on `crvouga/mockingbird`, not an in-repo mock.
- Assert invariants and crash. Handle or propagate every error. No empty `catch`.

## Spec index

Feature titles, one line each, so a session can route without listing the tree. Bodies stay in the `.feature` files.

**Identity** (`specs/profile/`): sign in and out; sign-in while offline; abandon signing in; finish signing in; Sign in with Apple; manage sign-in methods; sign out everywhere; the devices on an account; profile defaults; edit a profile; username rules.

**Auth** (`specs/auth/`): what people do at Google and Apple; confirming a matching account; keeping sign-in methods straight; how long a sign-in lasts; stolen sign-ins; when Google or Apple is having trouble.

**App** (`specs/runtime/`): the tabs and Settings; settings that stick; the app opens without a connection; connection restore; addresses that lead nowhere; an app too old; using the app without seeing it or without a mouse.

**Spaces** (`specs/spaces/`): create; a guest can host; how many spaces a person can host; rename; find and return; join from the lobby; join from a link; what a link leads to; presence; losing the connection; spaces need a connection; end; the host leaving ends the space.

**Chess** (`specs/chess/`): the host chooses the game; puzzle play is a feed; puzzles without an account; guest progress carries over; customize the feed; feed choices stick; customizing requires an account; choosing the next puzzle; an exhausted feed; only puzzles that can be solved; the solve flow; who may move; chess rules; retry, hint, solution; showing the solution; clock and skipping; attempt survives leaving and closing; arriving mid-puzzle; friends watch; puzzles offline; days of puzzles offline; finished offline counts once; daily allowance (20); the limit holds everywhere and only for guests; the limit is an invitation; rating; stats and game log; rating, solved, accuracy; reviewing a line.

**Friends** (`specs/friends/`): friends require an account; friends need a connection; request accepted; declined or cancelled; requests reach the inbox; remove; block and unblock; another person's profile; profile changes reach other people; people search; friends in an open space.

**Billing** (`specs/billing/`): what the plans offer; what the plans tell a person; paid access belongs to one person; subscribe; trial and renewal; switch Plus plans; Plus credit from switching; switch payment provider; portal; cancel and subscribe again; failed payments; expired card; when paid access runs out; paid access while offline; refunds.

**Sync** (`specs/sync-engine/`): write, delete, checked notes, refused edits; count once; across devices; offline; a long time offline; after a crash; across app updates; arrive quickly; leave a shared space and rejoin; online-only actions.

**Room** (`specs/room/`): shared tally; who is in the room; owning the room; timed match.

**Matchmaking** (`specs/matchmaking/`): waiting for a match; being matched.

**Health** (`specs/health/`): reaching the app; signing in; serving people; spaces; seeing each other play; keeping uploads; payments; outside services; finding out what happened; finding a person's trouble; environments stay as planned.

**Journeys** (`specs/journeys/`): critical journeys; joining from a link, and opening with no connection.
