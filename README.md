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
| Live checks | `@synthetic` on the owning feature | Promises a live environment keeps right now, seen by the team from outside: reach the app, sign in, serve people, spaces, live updates, uploads, payments real only in production, outside services, request trail, find a person's trouble, environment matches the plan. |
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
| `@apps/server` | API and room modules, plus local API preview. Source is isomorphic; `pg` and `node:*` only behind ports in modules marked `@api-wall-ok`. |
| `@apps/product` | Application Worker (client assets, API, schedules and rooms); web app, harness, simulator and localhost stack. |
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

## Infrastructure

Three rules cover every deployed resource.

**Infrastructure as code.** OpenTofu under `libs/infra/tofu` is the only declaration. Modules and stacks name no environment. Shared values are `global.tfvars.json`. Per-environment values are only `envs/prd.tfvars.json` (`protection: "production"`) and `envs/dev.tfvars.json` (`protection: "standard"`). TypeScript, scripts, and consoles do not create, change, or delete infrastructure (`no-infra-outside-tofu.grit`). `scripts/tofu.ts` is the only way OpenTofu runs: plan, policy, state backup, apply.

**Zero ops.** Growth adds usage and cost. It adds no servers, clusters, replicas, shards, nodes to patch, or pools to size. A bigger day is a bigger bill.

**Web scale.** This is the architecture at Google, YouTube, Facebook, and GitHub scale. Workers, the CDN, Durable Objects, R2, PlanetScale Neki, and AWS IoT Core already run at that size. Application code owns logical keys (`gameId`, `queryHash`, partition keys, object keys). Providers own placement, routing, and capacity. Neki and IoT are both `us-east-1`. PlanetScale reshardes inside that region.

MQTT carries invalidation. Postgres is the record. A missed message is recovered by refetching. PlanetScale and AWS IoT have no local mode, so `bun run dev` uses embedded Postgres and a local MQTT broker. The Laptop section is the rest of that substitute.

### Global, once (bootstrap)

A person applies this. CI does not.

| Resource | Why |
| --- | --- |
| R2 bucket `gamezilla-tofu-state` and its scoped token | Encrypted state for every stack, key `<stack>/<env>.tfstate`, passphrase `TOFU_STATE_PASSPHRASE`. Losing the bucket loses the record of what OpenTofu owns. `prevent_destroy`. |
| Infisical environment `shared`, and the state-credential secrets in it | Account-wide secrets live once. Every environment imports them, so a rotation is one edit. `prevent_destroy`. |
| Grafana Cloud stack | One stack (the free plan allows one). Trace history for every environment, told apart by `deployment.environment.name`. `prevent_destroy`. |
| Infisical OIDC identity for this repository | GitHub Actions reads and writes secrets with the job token. |
| AWS IAM OIDC provider and deploy role | GitHub Actions assumes AWS for IoT and the authorizer. The role ARN is the Actions variable `AWS_ROLE_ARN`. The store holds no long-lived AWS account key. |
| GitHub repository settings, `main` protection, Actions variables | `main` moves through a PR whose required check (`check`) is green. Force-push and deletion stay off. Workflows read `SECRETS_IDENTITY_ID`, `SECRETS_PROJECT_ID`, and `AWS_ROLE_ARN`. The repository is `prevent_destroy`. |

### Fleet (every deploy)

| Resource | Why |
| --- | --- |
| Infisical environment per env file, plus a live import of `shared` | That environment's secrets, with the shared ones visible through the import. A local copy of a shared name would shadow the import. |
| Custom domain `auth.gamezilla.app` on Worker `gamezilla-auth-relay` | One OAuth callback for every environment. The relay reads the OAuth state tag and forwards the callback home. |
| R2 bucket `gamezilla-reports`, objects expire after 30 days | `bun check` publishes `commits/<sha>/`. Every environment's API streams `/reports/<sha>`. Reports are build output. |

### Each environment (foundation, then edge)

Production is `gamezilla-production`. Dev is `gamezilla-development`.

| Resource | Why |
| --- | --- |
| R2 bucket `gamezilla-<suffix>` and a bucket-scoped S3 token | Blobs: uploads, the TTS audio cache. Endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto`. The Worker prefixes every key with `gamezilla/` before any feature prefix. |
| Read token and write token on `gamezilla-reports` | The API reads. Check writes. Each token is scoped to that bucket. |
| Grafana write policy and token; read policy and token | Workers ingest on the write token. `bun obs` queries on the read token. One environment rotates without touching the other. |
| Generated secrets `AUTH_SECRET`, `EMQX_JWT_SECRET`, `SYNTHETIC_MONITOR_TOKEN` | Session signing, the HMAC the API mints and the IoT authorizer checks, and signed-in health journeys. A value already in the store wins, so an apply does not rotate them. A committed placeholder is replaced. |
| Derived secrets | Connection facts of the resources in this table: `DATABASE_URL`, `HYPERDRIVE_ID`, `API_URL`, `VITE_API_URL`, `S3_*`, `REPORTS_*`, `EMQX_WSS_URL`, `IOT_DATA_ENDPOINT`, `IOT_ACCESS_KEY_ID`, `IOT_SECRET_ACCESS_KEY`, `IOT_REGION`, `OBSERVABILITY_COLLECTOR_*`, `OBS_TEMPO_*`, `OBS_READONLY_DATABASE_URL`. Rewritten when the producer changes. The name lists are `stacks/foundation/secrets.json`. The names the app requires are `libs/secrets/src/shared/secrets/registry.ts`. `bun health` checks each required secret live. |
| Neki database `gamezilla-<suffix>`, branch `main` | System of record for that environment. Creating the branch creates the database. It starts empty; `@libs/runtime#migrate` reconciles the schema. Environments do not share rows. Production's branch is deletion-protected and `prevent_destroy`. |
| Role `migrate`, inherits `postgres` | DDL. This is `DATABASE_URL`, used by migrate and the Postgres provider. |
| Role `app`, inherits `pg_read_all_data` and `pg_write_all_data` | The API's rows. Table changes stay on `migrate`. |
| Role `obs_read`, inherits `pg_read_all_data` and `pg_monitor` | `bun obs`, via `OBS_READONLY_DATABASE_URL`. The login Neki issues may carry a suffix; `pg_read_all_data` still covers `SELECT`. |
| Hyperdrive `gamezilla-db-<suffix>` | Workers have no connection pool. Hyperdrive pools the app role's router. Query cache is off, so a sync read sees its own write. The Worker opens `env.HYPERDRIVE.connectionString`. |
| Neki's default `pg_stat_statements` extension | Slow-query statistics for `bun obs`; the branch's PlanetScale-managed default configuration profile enables it. |
| IoT custom domain, ACM certificate, DNS-only CNAME | Browsers connect at `emqx.gamezilla.app` or `emqx-dev.gamezilla.app` (`wss://<host>/mqtt`, secret `EMQX_WSS_URL`, synced key `emqx_wss_url`). The certificate is the TLS. DNS stays unproxied so the socket reaches IoT. The domain is data-plane, MQTT over WebSocket, custom auth, and this authorizer is the default. |
| Lambda authorizer (Node 22), its log group (14 days), its execution role | Browsers hold no signing key. The function checks `EMQX_JWT_SECRET` and turns the token's `acl` into a session policy: connect, subscribe, receive, publish. Caching is off. App topics use `:`; the IoT wire uses `/` (`user:actor1` → `user/actor1`) at this boundary only. Loopback brokers on the laptop keep colon topics. |
| IAM user, `iot:Publish` on `topic/*`, and its access key | The Worker publishes with SigV4 (`IOT_*`). A Worker cannot present a GitHub OIDC token, so this key is separate from `AWS_ROLE_ARN`. |
| Custom domains for the apex, `www`, and the API | Public names, attached after the Workers exist. Production: `gamezilla.app`, `www.gamezilla.app`, `api.gamezilla.app`. Dev: `dev.gamezilla.app`, `www-dev.gamezilla.app`, `api-dev.gamezilla.app`. Cloudflare's edge serves them. |

### Shipped beside OpenTofu

| Thing | Why it is not a resource here |
| --- | --- |
| Application Worker (env-file `worker.name`: `gamezilla-dev`, `gamezilla-prod`), auth-relay Worker `gamezilla-auth-relay` | `wrangler deploy`. One application version carries client assets, API, schedules and the room Durable Object class; API paths run the Worker first, static assets bypass compute. Existing room namespaces transfer before superseded Workers retire, after edge cutover and green health. Worker retirement refuses scripts still owning storage or hostnames. Hostnames stay on the edge stack. One Durable Object is one live topic; Cloudflare places it. |
| Postgres schema | `@libs/runtime#migrate` reconciles it. A new database starts empty. |
| Billing catalog (products, prices, webhook endpoints) | `@libs/billing#billing:sync`. The offer is product data the code reads. Paddle has no OpenTofu provider. |

### A person holds these

OpenTofu looks them up. It does not create them.

| Thing | Why a person holds it |
| --- | --- |
| Cloudflare zone `gamezilla.app` | DNS for every hostname above. |
| PlanetScale organization `gamezilla` | The account the databases are created in. The slug is configuration. |
| Shared secrets, seeded once with `bun run secrets:seed` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_ADMIN_TOKEN`, `GRAFANA_CLOUD_API_TOKEN`, `PLANETSCALE_SERVICE_TOKEN_ID`, `PLANETSCALE_SERVICE_TOKEN`, `TOFU_STATE_PASSPHRASE`, `TURBO_API`, `TURBO_TOKEN`, `ELEVEN_LABS_API_KEY`, `WEB_CLIENT_GOOGLE_CLIENT_ID`, `WEB_CLIENT_GOOGLE_CLIENT_SECRET`. Unknown keys in the store are left alone. |
| The Google OAuth client | One redirect, `https://auth.gamezilla.app/api/auth/callback/google`. Google's console has no API. |

### Data stays

An environment rebuilds from its env file. `prevent_destroy` covers the state bucket, the Grafana stack, the repository, the shared secrets environment, and production's Neki branch. `libs/infra/policy/stateful.rego` allow-lists what an ordinary apply may delete: credentials, DNS, routing, connection config, and derived secrets. Neki branches and roles stay protected. A plan that deletes most of a type in production is refused. To stop managing a stateful resource, use `removed { lifecycle { destroy = false } }`. Neon and the old Railway broker are forgotten that way. Before every apply, encrypted state is copied to `backups/<stack>/<env>/<timestamp>.tfstate`.

```sh
bun run infra:destroy -- --env <env> --confirm <env>
```

That refuses `protection: "production"`. It runs deploy in reverse: edge domains, delete the application Worker and any superseded scripts, empty the bucket, then foundation (that database, Hyperdrive, bucket, IoT, trace tokens, secrets), then that env's fleet entries. The env file stays. The next deploy builds a new empty database and reconciles the schema. Deleting the env file alone deletes nothing.

A new environment is `envs/<env>.tfvars.json` with `protection: "standard"` and no `imports`, registered in `libs/infra/src/public/envs.ts`. Deploy creates the rest: standard environments in parallel, then production. Health probes every env hourly. Rehearse with `bun run deploy:dev` before merging a change to deploy, infra, secrets, Workers, or health, and merge soon after: a rehearsal adopt sits in dev state until the branch lands.

```text
deploy:fleet   auth-relay Worker, then the fleet stack
deploy:<env>   foundation -> migrate -> product (assets + API + rooms)
               -> edge -> billing:sync -> health -> retire superseded Workers
```

`bun deploy` ships `main` only. Do not `tofu apply` from a laptop against production. Non-deploy commands cannot reach production Postgres (`@libs/db/public/database-url-policy`). `bun run db:wipe:dev` refuses `ALLOW_PRODUCTION_DATABASE_URL=1`.

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

Exactly three workflows, on `ubuntu-latest`. Check runs on PRs (`//#check`, `SECRETS_ENV=dev`, sharded with report uploads overlapping completed spec parts). Deploy (`.github/workflows/deploy.yml`) runs on `main` after a merged PR, standard envs in parallel, then production, and re-runs the gate first. Health (`.github/workflows/health.yml`) runs hourly, deploys nothing, and probes every env file. `bun health` git-syncs, including `main`, and dispatches Health. `bun deploy` does not commit: it fast-forwards local `main` and dispatches Deploy on `origin/main`. Cancelling Deploy does not roll back an apply that already started. A new check is a package task under `//#check`, never a fourth workflow or a new job. Required GitHub check is `check` only (`global.tfvars.json` `github.required_checks`). Merge commits only. `pre-push` refuses `main`.

The spec report is part of Check. Check is red if it did not publish. One private R2 bucket (`reports` in `global.tfvars.json`) holds `commits/<sha>/`. Each environment's API streams it (`/api/reports`). Snapshots are recorded on every harness step. A red suite still publishes. `bun check:local` does not.

Standing live checks are Gherkin features tagged exactly `@synthetic` on the feature line, after `@domain:`, in the context that owns the promise. The environment is where the runner points. A `.feature` has no schedule. The harness does not run `@synthetic`. `specs/journeys/` stays untagged: those journeys run on the harness in `bun check` and live on Health. Tagging them `@synthetic` would take them out of the harness.

Tagged: `specs/runtime/reaching-the-app.feature`, `serving-people.feature`, `declared-environment.feature`, `connected-services.feature`, `stored-files.feature`, `request-records.feature`; `specs/auth/sign-in.feature`; `specs/billing/payments.feature` (production checks that the keys are real and charges nobody); `specs/spaces/spaces.feature`, `live-updates.feature`; `specs/profile/finding-a-person.feature`. `specs/runtime/availability.openslo.yaml` is `# live`, target 0.99 over 28 days, and does not gate a deploy.

| Command | What it checks | Where |
| --- | --- | --- |
| `bun run synthetic` | `@synthetic` only | dev |
| `bun run synthetic:prd` | `@synthetic` only | production |
| `bun health` | journeys and `@synthetic` | dev (hourly Health) |
| `bun health:prd` | journeys and `@synthetic` | production |
| `bun run --filter @apps/product health:objectives` | `# live` objectives | the `SECRETS_ENV` already loaded |

`@synthetic` added no workflow. `--synthetic` and `--objectives` together are refused. `--target staging` is refused. There is no staging: `test` means `dev`, `production` means `prd`. `--target` sets `SECRETS_ENV` for the host lookup inside the product script; pick the environment with `synthetic` or `synthetic:prd` so those secrets load. A failure names the scenario, the step, and the environment. `synthetic.check` is not its own span; the evidence record already names the feature and scenario.

Leave a check untagged until it can run on a dedicated synthetic identity, clean up, and leave no real side effect. That includes journeys that host, end, or join a space, solve a puzzle, or change an avatar (they already run live as journeys on the synthetic monitor account), anything that reads a real person's data, sends a real notification, or takes a real payment, and edge cases, destructive admin, and checks that are not idempotent. A synthetic check uses dedicated identities, never a real person's data. Host limits are `HOST_LIMITS` in `apps/product/scripts/health.ts`. Specs carry no host tags. Infrastructure health, runtime invariants, and OpenSLO stay their own checks. The availability objective is `# live` so `bun check` does not measure GitHub from the harness.

`specs/journeys/` runs in `bun check` against the full composition and, on Health, in a real browser against the deployment, one fresh device per scenario. Signed-in journeys trade `SYNTHETIC_MONITOR_TOKEN` at `POST /api/auth/synthetic-monitor/code`. A live failure saves a screenshot under `apps/product/.cache/critical-journeys/<scenario>/`. Liveness is `GET /api/health`. Readiness is `GET /api/health/ready` (`503` when `SELECT 1` fails within 3 s). UI tests in Check use happy-dom. `HARNESS_MODE=real` and `stack` use the same `Driver` on `Bun.WebView`.

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
- Infrastructure is OpenTofu, zero-ops, and web scale (Google, YouTube, Facebook, GitHub). Changes are `.tf` and `envs/*.tfvars.json` only.
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

**Live checks** (`@synthetic`, in the owning context): reaching the app; serving people; the environment as planned; outside services; uploads; the request trail; signing in; payments; spaces; live updates; finding a person's trouble. Availability: `specs/runtime/availability.openslo.yaml`.

**Journeys** (`specs/journeys/`): critical journeys; joining from a link, and opening with no connection.
