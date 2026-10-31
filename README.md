# Product monorepo

> **Source available, not open source.** Copyright © 2026 Chris Vouga. All
> rights reserved. This repository is public so its source can be read; that
> grants no license to use, copy, modify, distribute or commercially exploit
> it. See [`LICENSE`](LICENSE). Third-party components keep their own
> licenses. Outside contributions are not accepted
> ([`CONTRIBUTING.md`](CONTRIBUTING.md)); report security issues as described
> in [`SECURITY.md`](SECURITY.md).

The product's name, domain and external identifiers are configuration, not prose: [`libs/product-identity/product-identity.json`](libs/product-identity/product-identity.json), explained in [`docs/BRANDING.md`](docs/BRANDING.md). In this briefing `<domain>` stands for its `brand.domain` and `<namespace>` for its immutable `technical.namespace`.

Local-first game platform. A person opens the app on a phone, tablet, or computer, gets a profile immediately, hosts a live space, and solves chess puzzles there with friends watching. The app works with no connection. What needs other people waits, then catches up on its own.

This file is the one briefing a fresh session should load: product, stack, and how the repo is worked. Executable product truth lives in [`specs/`](specs/). How to write a spec lives in [`specs/README.md`](specs/README.md). The injected agent contract is [`AGENTS.md`](AGENTS.md); it points here and does not restate this file. When this file and a spec disagree, the spec wins. Change product behavior by changing `specs/` first, in a `spec:` commit, then the code.

The one [product statechart](specs/product.machine.json) maps the entire
product, while its [exploration guide](docs/statecharts/README.md) explains
the choices, outcomes, source-derived business examples and definitions.
`bun atlas:viz` opens its lightweight viewer without the app stack;
`bun atlas:run` runs every spec suite and records its reports for that
viewer; `bun atlas:build` validates and builds the standalone explorer;
`bun atlas:lint` checks complete traversal, journeys, source ownership and
portable serialization.

The step catalogs — [`docs/STEPS_CATALOG.md`](docs/STEPS_CATALOG.md) and each spec package's `STEPS_CATALOG.md` — are generated and gitignored: `bun install` writes them and `bun run spec:catalog` refreshes them. Package READMEs describe that package's API (`pkgs/room`, `pkgs/harness`, `pkgs/sync-engine`, and a package's own `docs/` when it has one). They are not a second copy of this file.

Public source, not open source: [`LICENSE`](LICENSE) reserves all rights, and [`CONTRIBUTING.md`](CONTRIBUTING.md) explains that outside contributions are not accepted. Repository: `external.sourceRepository` in the product identity. Package manager: Bun `1.4.2` (`mise.toml`; 1.3.x fails wildcard `.tsx` subpaths on CI). Node `>= 22`. Language of the app: English. Day boundary for limits: midnight UTC. Primary client: a phone's Chrome, including low-end Android (~2 GB). Not desktop-first, and not Capacitor.

## Words

Scenarios name people (Alice, Bob) or a role (a guest, a member). The shared kernel is person, device, fresh device, the app, connection (offline / back online), and the team (the people who run the product).

| Say | Means |
| --- | --- |
| person, guest, account, sign in, sign out | identity. A guest already has a username, avatar, and profile. First sign-in keeps that profile. |
| sign-in method | Google or Apple. At most one of each per account. The last one stays. |
| username | `@name`, unique ignoring case, stored lowercase. |
| free account, Plus, Plus member, paid access, free access | billing. Plus is what a signed-in person pays for. |
| space, host, join, leave, end a space, open space, lobby, space link | a live place. The host created it. The host leaving ends it. Disconnecting is not leaving. |
| puzzle, draft, edition, pack, attempt, progression | shared content; vocabulary and behavior in [`specs/puzzles/`](specs/puzzles/). |
| puzzle feed, puzzle rating | the rated line-based feed; distinct from author-created puzzle content. |
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
| Auth | `@pkgs/auth` + `@pkgs/auth-inhouse`, product wiring in `@libs/auth` (`specs/auth/`) | Each Google or Apple account belongs to exactly one account in the app. A matching account is confirmed before a new outside account is added. An unverified address match waits until the person proves it. Accounts never merge silently. An identity never moves. The last sign-in method stays. Provider trouble does not let anyone into the wrong account. A sign-in lasts until sign-out or it lapses. |
| App | `@libs/client-app`, `@libs/runtime` (`specs/runtime/`) | Opens onto the Spaces tab, including with no connection after the first open. Tabs: Spaces, Notifications, Profile. Settings is reached from the tabs; theme, sounds, and version stick per device. An unknown address says so and offers the way back to Spaces. An app too old is told to update and keeps what is on the device. Usable without sight and without a mouse. |
| Spaces | `@libs/spaces` | Metadata reads use local SQLite and writes use mutations. Room state, history and pending commands persist on the host device; local opening completes before the background transport connects. Server admission and fanout follow the host's active connection. Product contract: [`specs/spaces/`](specs/spaces/). |
| Games | `@libs/game-menu`, `@libs/game-session`, `@libs/game-matchmaking`, registries `@libs/games` (`specs/games/`) | What every game offers alike: the game's choices, custom games with people and bots, turns, finding an opponent, matched games (aborts, draws, rematches, results), history and review, shown to the whole space. Each scenario runs once per registered game offering it. Framework: [`GAME_FRAMEWORK.md`](libs/games-shared-ts/docs/GAME_FRAMEWORK.md); adding a game: [`ADDING_A_GAME.md`](libs/games-shared-ts/docs/ADDING_A_GAME.md). |
| Connect Four | `@libs/connect-four` (`specs/connect-four/`) | Seven columns, gravity, four in a row, the full-board draw, Hard bots. Everything else is the shared game platform's. |
| Chess | `@libs/chess`, board in `@pkgs/chess-board` | A registered game (`GAME_DEFINITIONS` in `libs/games-shared-ts/src/game-plugins.ts`) with puzzles beside the shared game choices. An endless puzzle feed inside the host's space. Friends watch the same line. Rating, accuracy, and a game log stay honest online and offline. Hint, retry, skip, solution, clock. Feed settings (themes, rating window) require an account and sync across devices. Guest progress carries into the account on sign-in. The pool rejects puzzles that cannot be solved. |
| Puzzles | `@libs/game-puzzle` (`specs/puzzles/`) | Shared content storage, mutation replay, scoped queries, authoring and player screens. Integration: [`ADDING_A_PUZZLE_GAME.md`](libs/games-shared-ts/docs/ADDING_A_PUZZLE_GAME.md). |
| Numberlink | `@libs/numberlink` (`specs/numberlink/`) | Registered puzzle-content rules, renderer and visual editor using the shared Puzzles lifecycle. App flows: [`numberlink-packs.feature`](specs/journeys/numberlink-packs.feature). |
| Sokoban | `@libs/sokoban` (`specs/sokoban/`) | Registered puzzle-content rules (moves, pushes, completion), keyboard/touch player, board builder, bundled starter pack and publication proof by replayed playtest, using the shared Puzzles lifecycle. App flows: [`sokoban-packs.feature`](specs/journeys/sokoban-packs.feature). |
| Friends | `@libs/friends`, search UI `@libs/search`, inbox `@libs/notifications` | Ask, accept, decline, cancel, remove, block, unblock. People search. Profile changes reach other people. An open space a friend is in shows up. Needs an account and a connection. |
| Billing | `@libs/billing`, providers `@pkgs/billing-stripe` and `@pkgs/billing-paddle` via `@pkgs/billing-providers-server-ts` | See the plans, subscribe, trial, renew, switch monthly/yearly, switch provider, portal, cancel, resubscribe, failed card, expired card, refund, Plus credit when switching plans. Membership is managed by the person. |
| Sync | `@pkgs/sync-engine` (`specs/sync-engine/`) | Shared rows (spec'd as notes) show at once, survive crash, offline, and app update, and count once. Leave a shared place and rejoin to catch up. Some actions are online-only and do not fire later. Server arrival order wins. |
| Room | `@pkgs/room` (`specs/room/`) | One live topic. Shared tally, who is in the room, who owns it, timed match. Same picture after offline time or a crash. This is the session engine spaces and games sit on. It is separate from sync. |
| Matchmaking | `specs/matchmaking/`, engine `@pkgs/matchmaking` | People waiting are paired with someone they accept who accepts them. A match already made is kept. Specified. Not in the shipped sub fold (`APP_SUBS`). |
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

**Sync** is the system of record for durable rows (profile, friends, billing facts, puzzle history, space membership). The device reads and writes local SQLite. A write is a mutation: applied locally in the same transaction, queued, uploaded. The server replays it in one Postgres transaction as the signed-in person and pushes the change to subscribed devices. Mutation definitions decide conflicts: ordinary rows use server arrival order; puzzle drafts, pack order and attempt continuations use expected-head checks and retained copies ([implementation](libs/games-shared-ts/docs/ADDING_A_PUZZLE_GAME.md#reuse-the-shared-lifecycle)). Domain rows are removed by setting `deleted_at`. UI reads filter `deleted_at IS NULL`. Merge upserts snapshot rows and rebases pending mutations on top. Wire protocol is v3 (`x-sync-protocol: 3`); an older client gets `upgrade_required` and its local database is kept. Hydration is `POST /api/query` on connect plus pubsub pushes. Mutations drain through `POST /api/mutations`. MQTT (AWS IoT Core in production) is an invalidation signal. A missed message is recovered by refetching from Postgres.

**Room** is the live session for one topic, usually `space:<id>`. `@pkgs/room` keeps one authoritative event log. The client runs the same `RoomModule` for instant feedback; the server validates and orders. Optimistic commands queue and flush. Durable Objects host rooms in production. Time-sensitive rules (clocks, deadlines) are schedules the server wakes. Room state is not the SQL sync log.

**Permissions** answer every "may this person…?". Client: `useCan` / `useDecision` / `usePermissions`. Mutation body: `requireInMutation` / `decideInMutation`. Server route: `requirePermission`. A denial renders through `DenialSurface` or `useUnlock` from policy `unlockRefs`. Product code outside auth, billing, and permissions does not read anonymous-vs-signed-in flags, does not query billing tables for access, and does not name a role or a plan.

**Auth on the wire.** Token only. The API does not read or set cookies. Requests carry `Authorization: Bearer <session-token>` and the install id in `x-anon-id`. One current person per install. Several sign-in methods can sit on one account. Local SQLite on the web client is not encrypted at rest. Each account has its own file (`user_<shortId>`), so one account's queries do not read another's rows. Do not put secrets, or data that must not be lost with the device, only on the device.

**Composition.** A sub can contain subs of the same kind. Folding a node walks that node, then the subs it contains, in listed order, and leaves out anything outside that subtree. A repeated name, a repeated owned table, or a walk that re-enters a node fails. `@libs/runtime` is the only package that lists the shipped product, and that list stays flat: auth, account-privacy, profile, client-config, spaces, friends, notifications, chess, billing, permissions, synthetic-population. `APP_SUBS` in `libs/runtime-shared-ts/src/app-subs.ts` folds schema, queries, topics, and mutations. `APP_SUB_CLIENTS` folds routes and chrome, and also mounts search between notifications and billing. Order matters: profile is outermost, friends mounts above notifications. Sibling product subs do not import each other. Cross-sub needs are ports the composition root fills (`readsForeign` is the checked exception). Shells (`@libs/client-app`, `@libs/server-app`) take the sub list as an argument, so a test boots one sub or the whole flat list with the same code. Call `defineSub`, `defineSubClient`, and `defineSubServer` from `@libs/sub-shared-ts` and `@libs/sub-client-ts`.

```text
device UI (Solid)
  useQuery  -> local SQLite (sqlite-wasm, one file per account)
  mutate()  -> local txn + outbound queue
        |  POST /api/mutations          POST /api/query + MQTT invalidation
        v
Application Worker (Hono API, client assets and rooms)
  authn -> permission -> replay mutation in one Postgres txn
  notify channels
        |
        +--> PlanetScale Postgres (single node) via Hyperdrive
        +--> Durable Object per topic
        +--> R2 for uploads and the spec-report bucket
```

## Repository

Bun workspaces: `apps/*`, `libs/*`, `pkgs/*`.

| Tier | Path | May import | Holds |
| --- | --- | --- | --- |
| Apps `@apps/` | `apps/` | apps, libs, pkgs | deployed surfaces |
| Libs `@libs/` | `libs/` | pkgs, other libs' `public/` | product subs, shells, runtime |
| Pkgs `@pkgs/` | `pkgs/` | pkgs only | frameworks. No brand or namespace, `@libs/*`, or product names anywhere in these packages |

| App | Role |
| --- | --- |
| `@apps/client-ts` | Vite shell: `index.html`, service worker, PWA, bundle budget. `bun run dev:client` runs it alone. |
| `@apps/server-ts` | API and room modules, plus local API preview. Source is isomorphic; `pg` and `node:*` only behind ports in modules marked `@api-wall-ok`. |
| `@apps/product-ts` | Application Worker (client assets, API, schedules and rooms); web app, harness, simulator and localhost stack. |
| `@apps/auth-relay-ts` | Global OAuth callback Worker at `auth.<zone>`. |
| `@apps/client-swift` | Native SwiftUI iOS shell: the product name on an empty screen, linking `@pkgs/clock-shared-swift`. No product features yet ([`docs/POLYGLOT.md`](docs/POLYGLOT.md)). |

| Platform lib | Role |
| --- | --- |
| `@libs/runtime` | Composition root, migrations, schema snapshot. |
| `@libs/sub` | Manifest algebra. Imports no product sub. |
| `@libs/client-app` | Providers, router, chrome, sync boot. |
| `@libs/server-app` | Request scope, auth, sync, rooms. |
| `@libs/client-config` | Synced runtime config (EMQX/MQTT URL, observability). Not `VITE_*`. |
| `@libs/permissions` | The only access decisions. |
| `@libs/secrets` | Infisical registry and `secrets-run`. |
| `@libs/infra` | OpenTofu. The only place infrastructure is declared. |
| `@libs/harness-ts` | Product spec runner. |
| `@libs/tools-harness-ts` | Lint, CI, git-sync, naming, spec verifications. |
| `@libs/games` | The game registries (`GAME_DEFINITIONS`, `GAME_CLIENT_DEFINITIONS`, `HARNESS_GAMES`, and the derived `PLAYABLE_GAME_DEFINITIONS` / `TURN_GAMES` / `GAME_AUTOMATIONS`): Chess, Connect Four, Battleship, Numberlink, Sokoban, Quoridor, Hearts, Pong and Light Cycles. Turn-only registries and conformance enroll only games with a turn engine. With the runtime, the only packages that compose games (`"gameRegistry": true`); `@libs/games-harness-ts` also holds the game × capability conformance matrix. |
| `@libs/observability` | Product telemetry wiring. |

Packages split by vertical slice first, then by runtime. Both `libs/` and
`pkgs/` use flat source modules:

```text
libs/chess-puzzle-client-ts/src/puzzle-screen.tsx
libs/chess-puzzle-shared-ts/src/start-puzzle-mutation.ts
libs/chess-puzzle-server-ts/src/seed.ts
libs/chess-puzzle-harness-ts/src/puzzle-system.ts
libs/chess-puzzle-harness-ts/tests/puzzle.test.ts
```

The paths above illustrate the layout. A package has `src/`, `tests/`, and
`scripts/` only as needed. `src/` stays flat: no `root/`, `public/`, `shared/`,
`use-cases/`, or directory index barrels. Reusable client UI in `pkgs/` uses component slices instead: `src/<component>/index.tsx` is the implementation, with local styles, source JSDoc, stories, fixtures and visual baselines beside it. Shared foundations and preview-only scaffolding stay shared. Split an independent
use case into another package instead. Export individual modules as `./*`;
import them as `@libs/chess-puzzle-shared-ts/start-puzzle-mutation`. Use relative
imports inside the package. Do not create empty packages for unused layers.

Every manifest explicitly declares `category` and `language` (`typescript`,
`swift`, or `neutral`); native packages also declare `platforms`. A new
Every package's name ends in its language suffix after the runtime suffix
(`@libs/chess-puzzle-client-ts`, `@pkgs/clock-shared-swift`), checked by
`@libs/tools-harness-ts#ci:package-names`. The workspace's shape is also
checked for Turbo cache hits (`@libs/tools-harness-ts#ci:cache-hygiene`,
[`docs/CI_REQUIREMENTS.md`](docs/CI_REQUIREMENTS.md#cache-friendly-structure)). Languages,
toolchains, hosts and native CI: [`docs/POLYGLOT.md`](docs/POLYGLOT.md).
Runtime packages use:

| Category | Suffix | Root form | May import |
| --- | --- | --- | --- |
| `client` | `-client` | `-root-client` | client, isomorphic |
| `server` | `-server` | `-root-server` | server, isomorphic |
| `isomorphic` | `-shared` | `-root-shared` | isomorphic |

When a package joins more-specific packages with the same prefix, `root`
precedes its runtime suffix so the runtime stays last (for example,
`@libs/chess-root-client-ts` beside `@libs/chess-puzzle-client-ts`). Test composition
uses the separate `harness` category (`-harness` or `-root-harness`), which may
compose all three runtimes. Production packages cannot depend on harness
packages. Tests and tooling may use other runtimes in `devDependencies`;
production `src/` imports still obey their category, regardless of which
manifest field declares the dependency. `package-boundaries.ts` enforces these
rules in each package's cached lint, including source imports and flatness.

A sub exports manifests from the corresponding packages: `SubManifest`
(tables, topics, queries, mutations), `SubClient` (routes, chrome), and
`SubServer` (HTTP, outbox, pubsub). A sub may list nested subs of the same
kind. The `runtime` family composes the shipped flat list; `app` and `sub`
packages stay independent of individual product subs.

Tests live in the package that owns their runtime. Pure tests accompany shared
modules, browser tests accompany client modules, and server tests accompany
server modules. Tests that compose runtimes live in the slice's harness
package; tests spanning product subs live in `@libs/runtime-harness-ts`.
Framework behavior is tested through one kitchen-sink example app in the
framework's harness package, with flat example modules. Test consumers import
package exports, never another package's source paths.

Known cross-sub table reads, still debt: `permissions` reads `billing_subscriptions` (so billing reruns every sub spec); `spaces` reads `friends_friendships` (spaces specs live in `@libs/friends`); `search` reads friends' search query and `friends_blocks` (people search lives in `@libs/friends`). Prefer a port the composition root fills.

### Framework packages that matter

| Need | Package |
| --- | --- |
| UI components, tokens, theme | `@pkgs/ui` (in-house only; no third-party component library) |
| Solid context helpers | `@pkgs/solid-context-client-ts` |
| Local-first sync | `@pkgs/sync-engine` entries: `client`, `server`, `shared`, `harness`, `solid` |
| SQL tables | `@pkgs/db-schema`, emitted by `@pkgs/db-schema-postgres` and `@pkgs/db-schema-sqlite` |
| SQL clients | `@pkgs/sql-client-sqlite-web` (browser), `@pkgs/sql-client-postgres` (server) |
| Migrations | `@pkgs/db-migrate-shared-ts`, composed by `PostgresMigrationRunner` in `@libs/runtime` |
| Live sessions | `@pkgs/room`; adapters `room-adapter-durable-object`, `room-adapter-web`, `room-adapter-bun`, `room-adapter-memory` |
| Clock, timers | `@pkgs/clock` |
| HTTP | `@pkgs/http-client` |
| Ids and randomness | `@pkgs/uuid` (`createId`, `random`) |
| Auth port | `@pkgs/auth`; vendor `@pkgs/auth-inhouse` |
| Billing port | `@pkgs/billing-root-shared-ts`; vendors stripe and paddle, listed only in `@pkgs/billing-providers-server-ts` |
| Object storage | `@pkgs/object-store`; S3/R2 `@pkgs/object-store-s3`; browser OPFS `@pkgs/object-store-opfs-shared-ts` |
| Pubsub | `@pkgs/pubsub-root-shared-ts`; MQTT `@pkgs/pubsub-mqtt` |
| Key-value | `@pkgs/kv` |
| Spec languages | `@pkgs/gherkin`, `@pkgs/quint`, `@pkgs/dmn`, `@pkgs/alloy`, `@pkgs/openslo` |
| Property tests | `@pkgs/property-shared-ts` (`assertProperty` only) |
| Specification visualization | Atlas owns spec browsing and test evidence. Run `bun atlas:viz`; see [Atlas reporting](https://github.com/crvouga/atlas/blob/main/packages/reports/README.md). |
| Chess rules and board | `@pkgs/chess-rules-shared-ts`, `@pkgs/chess-board-core-shared-ts`, `@pkgs/chess-board` |
| Rating math | `@pkgs/glicko2-shared-ts` |
| i18n | Lingui (`@pkgs/i18n-shared-ts`). Catalogs compile to `libs/client-app`. |
| Observability | `@pkgs/observability`, CLI `@pkgs/observability-cli` (`bun obs`) |
| Assert-and-crash | `@pkgs/assert-root-shared-ts` |

Reusable UI is developed in Storybook first (`bun storybook`), using production
components without the app stack. Discovery, manifests, deterministic stories,
coverage and automated verification are documented in the
[Storybook agent workflow](pkgs/ui-root-harness-ts/README.md#agent-workflow),
also available through `/storybook-ui <task>` in supported agent harnesses.

UI is Solid. Components run once; reactivity tracks. Read `props.x` in the component body (never destructure props). Style with `class` / `classList` and `@pkgs/ui` tokens. `style` is only for dynamic values classes cannot express. `data-component` and `data-screen` exist for tests and are stripped from production bundles. `data-testid` ships in every build because live journeys drive the real bundle by it. Mutation weight picks the widget: `MutationModal` for confirm-first actions, `useMutationButton` for lightweight actions, `FormActionsFooter` for screen forms.

## Infrastructure

Three rules cover every deployed resource.

**Infrastructure as code.** OpenTofu under `libs/infra-shared-ts/tofu` is the only declaration. Modules and stacks name no environment. Shared values are `global.tfvars.json`. Per-environment values are only `envs/prd.tfvars.json` (`protection: "production"`) and `envs/dev.tfvars.json` (`protection: "standard"`). TypeScript, scripts, and consoles do not create, change, or delete infrastructure (`no-infra-outside-tofu.grit`). `scripts/tofu.ts` is the only way OpenTofu runs: plan, policy, state backup, apply.

**Zero ops.** Growth adds usage and cost. It adds no servers, clusters, replicas, shards, nodes to patch, or pools to size. A bigger day is a bigger bill.

**Web scale.** This is the architecture at Google, YouTube, Facebook, and GitHub scale. Workers, the CDN, Durable Objects, R2, and AWS IoT Core already run at that size. Application code owns logical keys (`gameId`, `queryHash`, partition keys, object keys). Providers own placement, routing, and capacity. Postgres and IoT are both `us-east`. Each environment's database is one single-node PlanetScale Postgres branch (`PS-DEV`), not Neki.

MQTT carries invalidation. Postgres is the record. A missed message is recovered by refetching. PlanetScale and AWS IoT have no local mode, so `bun run dev` uses Mockingbird Postgres and a local MQTT broker. The Laptop section is the rest of that substitute.

### Map

`bun run infra:map` writes `libs/infra-shared-ts/.cache/infra-map.html`: every stack, module and resource, the topology between them, and a logo and console link for each, per environment. It is evaluated from `libs/infra-shared-ts/tofu` and `policy/stateful.rego` alone (no credentials, state or network), so it cannot drift: `bun install` regenerates it, and `libs/infra-shared-ts/tests/infra-map.test.ts` fails when a declared resource is missing from it or a resource type has no title, logo or console link (add the type to `src/infra-kinds-<provider>.ts`).

### Global, once (bootstrap)

A person applies this. CI does not.

| Resource | Why |
| --- | --- |
| R2 bucket `<namespace>-tofu-state` and its scoped token | Encrypted state for every stack, key `<stack>/<env>.tfstate`, passphrase `TOFU_STATE_PASSPHRASE`. Losing the bucket loses the record of what OpenTofu owns. `prevent_destroy`. |
| Infisical environment `shared`, and the state-credential secrets in it | Account-wide secrets live once. Every environment imports them, so a rotation is one edit. `prevent_destroy`. |
| Grafana Cloud stack | One stack (the free plan allows one). Telemetry for every environment, told apart by `deployment.environment.name`. `prevent_destroy`. |
| Infisical OIDC identity for this repository | GitHub Actions reads and writes secrets with its OIDC job token. |
| AWS IAM OIDC provider and deploy role | GitHub Actions assumes AWS for IoT and the authorizer. The role ARN is the GitHub Actions variable `AWS_ROLE_ARN`. The store holds no long-lived AWS account key. |
| GitHub repository settings and `main` protection | `main` is the default branch. Its active ruleset allows a direct push and blocks deletion and force-pushes. A merge commit is the only merge method (linear history is not required); merged heads are deleted. No bypass actors. Dependabot alerts and security updates are on, and Actions requires SHA-pinned actions; secret scanning and push protection follow the declared visibility (on once it is `public`). `production` accepts deployments from `main` only. Repository and ruleset are `prevent_destroy`. |
| GitHub Actions variables for this repository | Bootstrap provisions `SECRETS_IDENTITY_ID`, `SECRETS_PROJECT_ID`, `AWS_ROLE_ARN`, and `AWS_HEALTH_ROLE_ARN` through the GitHub provider. |

GitHub policy lives in `libs/infra-shared-ts/tofu/modules/repository` under the bootstrap stack,
using the locked `integrations/github` provider. `global.tfvars.json` records
the visibility, homepage, enabled Issues, disabled Projects/Wiki/Discussions,
and existing environment names (`allow_forking` is not sent for a user-owned
repository). Publishing the repository is the one edit `visibility` →
`public`; the same apply turns on secret scanning and push protection.
Release runs `.github/workflows/verify-pr.yml` (`verify:end`, the whole gate) on
`main` on every push to `main` before it ships. The ruleset does not require that verification before the push.
No merge queue is added.

To review drift from the repository root:

```bash
SECRETS_ENV=prd bun run libs/secrets-server-ts/scripts/secrets-run.ts -- bun run --filter @libs/infra-server-ts plan:bootstrap
bun run infra:bootstrap # review and restore through the guarded apply path
```

The wrapper runs OpenTofu plan → deletion policy → encrypted state backup →
apply. `GITHUB_ADMIN_TOKEN` comes from Infisical and becomes the provider's
`GITHUB_TOKEN`; CI's workflow token has no repository-administration role.
The admin token needs repository Administration, Contents, Actions, and
Environments write access (a classic token needs `repo`); organization policy
may further restrict changes. Neither CI nor an administrator has a ruleset
bypass. The existing repository address and import are retained. Default-branch,
Actions, Dependabot, all four variables, and all four environment settings are
adopted by import blocks on apply, never recreated. The old protection state
address is forgotten without deleting any safeguard; the inspected repository
had no legacy branch protection or ruleset to import.

If CI cannot authenticate after a repository transfer, a person can restore
only the existing Infisical CI identity with `bun run infra:bootstrap
--recover-ci-identity`. Select the matching local Infisical login with
`INFISICAL_PROFILE` when the CLI has multiple accounts. This recovery uses
the declared bootstrap module, existing encrypted remote state, deletion
policy and state backup. It permits only in-place identity updates and needs
no AWS account login. It cannot initialize a new bootstrap or change other
resources. This is an emergency repair; run the full guarded bootstrap with
an active AWS login to reconcile AWS trust and repository settings as well.

Actions stay enabled for any action source (`all`), but only pinned to a full
commit SHA (`sha_pinning_required`). Workflow tokens default to read and cannot approve PRs;
workflow/job `permissions` grant the existing artifact, OIDC, and branch-cleanup
privileges. The inventory on 2026-10-02 contains `SECRETS_IDENTITY_ID`,
`SECRETS_PROJECT_ID`, `AWS_ROLE_ARN`, and `AWS_HEALTH_ROLE_ARN`, and no repository
or environment secrets or environment variables. Environment names and their
empty approval policies are preserved; `production` is used by the workflow,
and the other existing names retain deployment history. Admin environment
bypass has no approval rules to bypass and confers no access around main's
ruleset. No new approval or promotion gates are added. Dependabot alerts and security
updates are enabled; GitHub secret scanning with push protection is enabled
whenever the declared visibility is public (a private repository would need
paid Secret Protection); the required verification's gitleaks scan runs
either way. The
locked provider 6.13 advertises `code_security` and
`secret_scanning_non_provider_patterns` but omits both from
[`calculateSecurityAndAnalysis` and `flattenSecurityAndAnalysis`](https://github.com/integrations/terraform-provider-github/blob/v6.13.0/github/resource_github_repository.go).
Those two API settings were observed disabled and cannot be managed reliably
until that provider limitation is fixed; declaring them causes perpetual drift.
Enable supported security features by a reviewed IaC change when desired/licensed. Runtime
credentials remain in Infisical via OIDC. Never manage plaintext Actions secrets
through this module: sensitive Terraform inputs can still enter state. The
existing OpenTofu backend encrypts both state and saved plans.

### Fleet (every deploy)

To provision the fleet from a laptop after bootstrap:

```sh
bun run infra:fleet
bun run secrets:pull
```

`infra:bootstrap` applies only the bootstrap stack. `infra:fleet` applies the
global fleet, including `cloudflare_r2_bucket.shared_data` (`<namespace>-shared`),
and publishes its credentials to the shared secrets environment. Refresh the
local secrets cache afterwards, then restart the managed local stack with
`--keep-data` so its API processes receive the new bindings. Running bootstrap again cannot create a
resource declared only in fleet.

| Resource | Why |
| --- | --- |
| Infisical environment per env file, plus a live import of `shared` | That environment's secrets, with the shared ones visible through the import. A local copy of a shared name would shadow the import. |
| Railway project `<namespace>`, with an environment per env file | One shared project, protected from deletion. Its default `core` environment stays empty; `dev` and `prd` fork it so service creation and removal stay isolated. Railway environments are protected by the plan policy and removed only by a deliberate non-production teardown. |
| Custom domain `auth.<domain>` on Worker `<namespace>-auth-relay` | One OAuth callback for every environment. The relay reads the OAuth state tag and forwards the callback home. |
| Shared reference-data bucket and scoped S3 token | The [shared-data configuration](libs/infra-shared-ts/tofu/stacks/fleet/shared-data.tf) retains the Lichess source independently of environment teardown. |
| CI artifacts bucket `<namespace>-ci-artifacts`, its expiry rule and scoped S3 token | CI jobs hand their plan, verdicts and evidence, and the nightly profile keeps its reports, here instead of in GitHub Actions artifacts, whose account quota stops every Verify run when it fills. Every object expires after `ci_artifacts.retention_days` (7). The [configuration](libs/infra-shared-ts/tofu/stacks/fleet/ci-artifacts.tf) writes `CI_ARTIFACTS_*` to the shared secrets environment. |

The retired reports bucket and its credentials are no longer provisioned. Report
publishing skips when no `REPORTS_*` credentials are configured.

Fleet applies before foundation. On the first deploy after consolidating Railway, foundation recreates the disposable population services in the shared project and deletes their old single-service projects. The worker release then publishes to the new deployment IDs; synthetic opponents pause during this transition, while backend accounts, leases and games remain intact. The deletion policy permits only the old `module.population_service.railway_project.worker` address to retire; other Railway projects and environments remain protected.

### Each environment (foundation, then edge)

Production is `<namespace>-production`. Dev is `<namespace>-development`.

| Resource | Why |
| --- | --- |
| R2 bucket `<namespace>-<suffix>` and a bucket-scoped S3 token | Blobs: uploads, the TTS audio cache. Endpoint `https://<account>.r2.cloudflarestorage.com`, region `auto`. The Worker prefixes every key with `<namespace>/` before any sub prefix. |
| Railway Synthetic Population Worker | Foundation reads fleet's project ID from encrypted remote state, then looks up that project by ID and its environment by name. This avoids the provider's unscoped project-name listing. Each service has an environment-prefixed name, because service names are unique across the project; variables, capacity and deployments remain scoped to that environment. Workers have no volumes; accounts, leases and games live in the backend. |
| Grafana write policy and token; read policy and token | Workers ingest three signals on the write token. `bun obs` queries traces on the read token. A separate scoped service account manages dashboards and alerts while the Grafana instance is active. An archived instance is left alone, because creating that account waits on an instance health URL that answers 404. One environment rotates without touching the other. Release requires active hosted traces; an archived Grafana instance may still have active Tempo. Deleted or unknown stack states fail closed. |
| Generated secrets `AUTH_SECRET`, `EMQX_JWT_SECRET`, `SYNTHETIC_MONITOR_TOKEN` | Session signing, the HMAC the API mints and the IoT authorizer checks, and signed-in health journeys. A value already in the store wins, so an apply does not rotate them. A committed placeholder is replaced. |
| Derived secrets | Connection facts of the resources in this table: `DATABASE_URL`, `HYPERDRIVE_ID`, `API_URL`, `VITE_API_URL`, `S3_*`, `EMQX_WSS_URL`, `IOT_DATA_ENDPOINT`, `IOT_ACCESS_KEY_ID`, `IOT_SECRET_ACCESS_KEY`, `IOT_REGION`, `OBSERVABILITY_COLLECTOR_*`, `OBS_TEMPO_*`, `OBS_READONLY_DATABASE_URL`. Rewritten when the producer changes. The name lists are `stacks/foundation/secrets.json`. The names the app requires are `libs/secrets-server-ts/src/registry.ts`. `bun health` checks each required secret live. |
| Postgres database `<namespace>-<suffix>-pg`, branch `main` | System of record for that environment. Creating the branch creates the database. It starts empty; `@libs/runtime#migrate` reconciles the schema. Environments do not share rows. The branch is single-node `PS-DEV` (one node, no replicas). Production's branch is deletion-protected and `prevent_destroy`. The previous Neki database keeps its old name and its rows. |
| Role `migrate`, inherits `postgres` | DDL. This is `DATABASE_URL`, used by migrate and the Postgres provider. |
| Role `app`, inherits `pg_read_all_data` and `pg_write_all_data` | The API's rows. Table changes stay on `migrate`. |
| Role `obs_read`, inherits `pg_read_all_data` and `pg_monitor` | `bun obs`, via `OBS_READONLY_DATABASE_URL`. The login PlanetScale issues may carry a suffix; `pg_read_all_data` still covers `SELECT`. |
| Hyperdrive `<namespace>-db-<suffix>` | Workers have no connection pool. Hyperdrive pools the app role. Query cache is off, so a sync read sees its own write. The Worker opens `env.HYPERDRIVE.connectionString`. |
| `pg_stat_statements` | Slow-query statistics for `bun obs`. PlanetScale enables it on the branch. |
| IoT custom domain, ACM certificate, DNS-only CNAME | Browsers connect at `emqx.<domain>` or `emqx-dev.<domain>` (`wss://<host>/mqtt`, secret `EMQX_WSS_URL`, synced key `emqx_wss_url`). The certificate is the TLS. DNS stays unproxied so the socket reaches IoT. The domain is data-plane, MQTT over WebSocket, custom auth, and this authorizer is the default. |
| Lambda authorizer (Node 22), its log group (14 days), its execution role | Browsers hold no signing key. The function checks `EMQX_JWT_SECRET` and turns the token's `acl` into a session policy: connect, subscribe, receive, publish. Caching is off. App topics use `:`; the IoT wire uses `/` (`user:actor1` → `user/actor1`) at this boundary only. Loopback brokers on the laptop keep colon topics. |
| IAM user, `iot:Publish` on `topic/*`, and its access key | The Worker publishes with SigV4 (`IOT_*`). A Worker cannot present a GitHub OIDC token, so this key is separate from `AWS_ROLE_ARN`. |
| Custom domains for the apex, `www`, and the API | Public names, attached after the Workers exist. Production: `<domain>`, `www.<domain>`, `api.<domain>`. Dev: `dev.<domain>`, `www-dev.<domain>`, `api-dev.<domain>`. Cloudflare's edge serves them. |

### Shipped beside OpenTofu

| Thing | Why it is not a resource here |
| --- | --- |
| Application Worker (env-file `worker.name`: `<namespace>-dev`, `<namespace>-prod`), auth-relay Worker `<namespace>-auth-relay` | `wrangler deploy`. One application version carries client assets, API, schedules and the room Durable Object class; API paths run the Worker first, static assets bypass compute. Existing room namespaces transfer before superseded Workers retire, after edge cutover and green health. Conflicting namespaces fail closed unless the env file pins both IDs in `worker.room_namespace_resolution`: rename the destination to read-only `RoomStorageArchive`, then transfer the source into the active room class. Release verifies both IDs survive; subsequent deployments retain the archive. Worker retirement refuses scripts still owning storage or hostnames. The client build and API/broker/web/OAuth bindings derive from the env file; copied secrets cannot override deployed endpoint bindings. Hostnames stay on the edge stack. One Durable Object is one live topic; Cloudflare places it. |
| Postgres schema | `@libs/runtime#migrate` reconciles it. A new database starts empty. |
| Initial chess puzzle catalog | `@libs/chess-puzzle-server-ts#initialize:catalog`, after schema reconciliation and before the app deploy. A table that has never held puzzles receives the validated committed load file; existing catalogs and tombstones are preserved. Further additions use the team's puzzle-management flow. |
| Billing catalog (products, prices, webhook endpoints) | `@libs/billing#billing:sync`. The offer is product data the code reads. Paddle has no OpenTofu provider. |

### A person holds these

OpenTofu looks them up. It does not create them.

| Thing | Why a person holds it |
| --- | --- |
| Cloudflare zone `<domain>` | DNS for every hostname above. |
| PlanetScale organization (`external.planetscaleOrganization`) | The account the databases are created in. The slug is configuration. |
| Shared secrets, seeded once with `bun run secrets:seed` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_ADMIN_TOKEN`, `GRAFANA_CLOUD_API_TOKEN`, `PLANETSCALE_SERVICE_TOKEN_ID`, `PLANETSCALE_SERVICE_TOKEN`, `TOFU_STATE_PASSPHRASE`, `TURBO_TOKEN`, `ELEVEN_LABS_API_KEY`, `WEB_CLIENT_GOOGLE_CLIENT_ID`, `WEB_CLIENT_GOOGLE_CLIENT_SECRET`. Unknown keys in the store are left alone. |
| The Google OAuth client | One redirect, `https://auth.<domain>/api/auth/callback/google`. Google's console has no API. |

### Data stays

An environment rebuilds from its env file. `prevent_destroy` covers the state bucket, the Grafana stack, the repository, the shared secrets environment, the shared Railway project, and production's Postgres branch. `libs/infra-shared-ts/policy/stateful.rego` allow-lists what an ordinary apply may delete: credentials, DNS, routing, connection config, and derived secrets. Postgres branches and roles stay protected. A plan that deletes most of a type in production is refused. To stop managing a stateful resource, use `removed { lifecycle { destroy = false } }`. Neon is forgotten that way and still exists at Neon. The Railway EMQX project is deleted; those addresses stay forgotten so an apply does not recreate the broker. A `removed` block cannot name one instance of a `for_each`, so a generated secret retired on purpose is listed in the policy's `retired` set. The previous Neki branch and roles are forgotten with `destroy = false` and stay listed there so a plan that still deletes one instance is allowed. Their rows stay on the old database. Drop each entry once every environment has applied without it. Production MQTT is AWS IoT Core. Before every apply, encrypted state is copied to `backups/<stack>/<env>/<timestamp>.tfstate`.

When Grafana archives its instance, foundation first plans a targeted, state-only retirement of the instance's views and service-account credentials. Only `forget` actions at those addresses are allowed; the normal plan policy and encrypted state backup still run. Remote dashboards and credentials are preserved. This retirement alone skips managed-resource refresh because archived instances cannot answer it; the subsequent release plan always refreshes the whole foundation. A read-only preview reports the retirement first, since the full plan needs its state applied. Restoring an archived instance requires importing its preserved views and credentials before managing them again.

Fleet manages the shared-data bucket, token, secrets and version records at their original addresses. Their former retirement blocks are removed when ownership returns to the fleet configuration; the bucket remains protected from destruction.
The one-time `global_imports.shared_data` flag adopts the bucket, token and five
write-only secrets forgotten by the earlier deployment. Imported tokens retain
their matching saved S3 credential; missing or mismatched credentials fail the
plan. Clear the flag after adoption; fresh installations leave it false.

```sh
bun run infra:destroy -- --env <env> --confirm <env>
```

That refuses `protection: "production"`. It runs deploy in reverse: edge domains, delete the application Worker and any superseded scripts, empty the bucket, then foundation (that database, Hyperdrive, bucket, IoT, trace tokens, secrets), then that env's fleet entries. The env file stays. The next deploy builds a new empty database and reconciles the schema. Deleting the env file alone deletes nothing.

A new environment is `envs/<env>.tfvars.json` with `protection: "standard"` and no `imports`, registered in `libs/infra-shared-ts/src/envs.ts`. Release creates the rest once `deploy.yml` has a job for it (a test fails until it does): `Release development`, then `Release production`. Health probes every env hourly. Rehearse before merging a change to deploy, infra, secrets, Workers, or health, and merge soon after: a rehearsal adopt sits in dev state until the branch lands. Rehearsals execute in GitHub Actions, dispatched on a named branch with `gh workflow run` and managed locally with `gh run view`, `gh run watch`, and `gh run download`; never run them on the developer machine. Reuse Release's dev job, secrets authentication and deployment concurrency lock. A branch rejected by AWS's deployment trust remains an infrastructure-rehearsal blocker; an application deploy and health run must be reported separately, never as a full infrastructure apply.

```text
Verify commit                  main-only release guard + the full Verify PR gate
Release shared services         shared secrets -> auth relay -> fleet stack
Release development             foundation -> migrate -> product (assets + API + rooms)
                                -> edge -> billing:sync -> health -> retire superseded Workers
Release production              the same chain, once development is green
Publish release                tag and GitHub release
Preview infrastructure changes rehearsal only: plan fleet and dev foundation
```

Development and production reuse one deployment step list in `deploy.yml`. The release branch guard runs before setup in Verify PR's planning job; `verify:start`, `verify:shards` and `verify:end` keep their required status names. Rehearsal runs the same Verify PR gate, then read-only infrastructure plans, with the release path closed.

`bun deploy` ships `main` only. Do not `tofu apply` from a laptop against production. Non-deploy commands cannot reach production Postgres (`@libs/db/public/database-url-policy`). `bun run db:wipe:dev` refuses `ALLOW_PRODUCTION_DATABASE_URL=1`.

## Laptop

Agent and workspace environment setup is documented in [`docs/AGENT_ENVIRONMENTS.md`](docs/AGENT_ENVIRONMENTS.md).

`./libs/tools-harness-ts/workspace/run.sh` is the one-stop workspace launcher used by the Run pane. It installs mise when missing, installs the system tools pinned in `mise.toml` on every launch, and loads their environment before installing app dependencies. The first launch also prepares local files; later launches reuse them. Failed preparation prints its cause and still attempts to start the stack; system tools and incomplete dependency installs are retried on the next launch.

`bun run dev` (alias `bun run stack`) runs one supervised boot per checkout. Repeating the command reuses the live boot. A boot is live while its supervisor and the processes that launched it are alive; once its launcher is gone the supervisor stops it, and a start that still finds it collects it and boots in its place. The boot is one Turborepo run, `@apps/product-ts#dev`, with a persistent task per process and a pane for each in the terminal UI: `dev:postgres` (Mockingbird Postgres, migrated and seeded), `dev:s3`, `dev:mqtt` (Aedes), `dev:openai`, `dev:observability`, `dev:idp` (simulated Google and Apple), `dev:billing` (simulated Stripe), `dev:server` (N API nodes behind the balancer), `dev:population` (Synthetic Population Workers), `dev:web` (the product web app: `/`, `/harness`, `/simulator`) and `@pkgs/ui-root-harness-ts#dev:storybook` (Storybook on `http://localhost:6006`, sharing the boot supervisor). `dev:prepare` plans every port first; each service publishes itself under `.cache/localhost-stack/<instance>/services/` when it can serve, and its dependents wait for that. Ports are OS-assigned on the first boot, reused on later boots, and published to `.cache/localhost-stack/<instance>.json` once the whole stack is up. Processes that run side by side are Turborepo tasks: add a task, not a process runner. `source libs/tools-harness-ts/workspace/port.sh` before a sidecar. EMQX (`1883` / `8083` / `18083`) and the wrangler preview (`8788`) are machine-wide; one workspace binds them at a time.

`bun run own -- <command> [arguments]` runs other long-lived tools through the same supervisor, including Node, Expo, JVM, browser, and media workers. Agent-launched long-lived commands use `bun dev`, `bun dev:client`, or this entry point.

`bun run gc` collects abandoned boots for this checkout, preserving live ones. `bun run stop` (also `bun run kill`) intentionally stops all its boots. Ownership records live in `.cache/dev-owner/`: boot identities, per-PID ledgers, listen-port claims, resource records, the admission lock, and `gc.log`. A stopping boot records what it signalled in `gc.log` and never writes to its launch terminal, which may no longer be read. Launch gates stamp `DEV_OWNER_ROOT` and `DEV_OWNER_BOOT` and record service and Node/Bun worker leaders before execution. An independent watchdog and GC collect stamped descendants, including separate sessions after supervisor death. Cleanup compares process birth identities and refuses foreign checkout stamps; it never kills by a machine-wide name or port.

Run initializes the local population controller with one synthetic opponent per worker
(default one), then starts workers that sign in and use the normal space and registered-game
matchmaking controls. Synthetic users sign in with an emailed link that is never
sent: the API keeps it in an internal inbox only their worker can read, in every
environment ([worker](apps/synthetic-population-worker-ts/README.md)). People only
ever see Google and Apple. `--synthetic-population-workers 3` starts three; `0` disables
them for isolated scenarios. The committed puzzle pool supplies 2,000 puzzles. Stack spec suites default to no background population workers so fixtures own their participants; an explicit worker count still overrides that test default.
Child processes inherit only process plumbing, with service bindings supplied by
the stack. API reports use local Mockingbird S3; the development reports page shows
workspace reports without fetching shared cloud credentials. Local data is fresh
unless a named instance is reused with `--keep-data`.

`bun run --filter @apps/product-ts test:stack specs/profile/apple-sign-in.feature`
boots the same services for automated browser scenarios. Feature paths select their
owning suite. The suite runs asynchronously so emulator listeners continue serving
requests while its child process runs.

Migration status and outstanding Mockingbird service/compatibility gaps are tracked in [`libs/tools-harness-ts/MOCKINGBIRD_MIGRATION.md`](libs/tools-harness-ts/MOCKINGBIRD_MIGRATION.md).

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

Both local choosers also list **Admin One** (`admin@gmail.com`) and **Admin Two** (`admin2@gmail.com`). Stack startup seeds their linked app accounts and grants them puzzle-management permission through the local API binding. Sign in with either account, then open `/more/puzzles` to load the Lichess database. These fixtures are confined to the loopback stack.

Shared reference data lives in the global fleet's R2 bucket, `<namespace>-shared`, protected by `prevent_destroy`. Its bucket-scoped S3 credentials are managed once by OpenTofu and imported through the shared secrets environment. Local APIs use those same `SHARED_DATA_*` bindings from the process or development secrets; automated harness and stack checks explicitly use disposable stores. Environment teardown never empties the shared bucket.

The puzzle loader stores the first Lichess source as bounded CSV parts and publishes its manifest only after every part is present. Every environment imports from that manifest by default, pinning the source version for its job. Finished, stopped and failed imports retain the source. Catalog rows, progress and other application objects stay in their own environment's database and bucket. See [the saved-file contract](specs/chess/saved-puzzles.feature).

`--idp-state` is `memory` (default, forgotten on exit), `instance` (survives a restart when `--keep-data` is set), or `path` (never deleted by stack cleanup). Signing keys are not persisted, so a restarted provider invalidates ID tokens it already issued. API sessions already issued stay valid. Local Stripe (`BILLING_PROVIDER=stripe`) is reconciled by `billing:sync` at boot. Pay with `4242 4242 4242 4242`. State is `<instance>/billing.sqlite`. `[stack] ready` means every API node answered a real request. `/api/health` can pass while the worker is in `api misconfigured`.

`@apps/client-ts` setup writes local `VITE_*` values and refuses the production API unless `VITE_ALLOW_PRODUCTION_API_URL=1`. `bun run pwa:generate` (from `apps/client-ts`) refreshes the manifest and icons. `bun run build` there runs Vite, then Workbox writes `dist/sw.js`. A stuck cache is cleared at `/unregister.html`, or by Clear local data & reload. Optional bundle treemap: `ANALYZE=1 bun run --filter @apps/client-ts build`.

`bun run dev` is for building. A green `bun verify` is the release decision. Looking at the app is not evidence. If a behavior cannot be reached by a verification, change the product until one can.

The app imports screens, session providers, game plugins, avatars, mutation definitions and sync-engine modules eagerly. Initial loading pays for the full application so navigation and interactions never wait for application chunks. The startup entry retains its error boundary around the initial graph load, and `index.html` preloads that graph alongside it (`preloadDynamicEntry`) so the two never load one after the other. Nothing gates the first frame: fonts swap in, and SQLite opens asynchronously through its broker as soon as an identity is bound; database readiness is not code lazy loading. The harness is not application code: `@apps/product-ts` loads its graph only at `/harness`, and the service worker never precaches it. Boot-path modules import the narrowest build of a dependency (`node-sql-parser/build/postgresql`, not the all-dialect package root). No third-party `<script src>` in `index.html` unless `INDEX_HTML_SCRIPT_ALLOWLIST` names it. Prefer the system font stack (0 KB). An added `@font-face` uses `font-display: swap` or `optional`. Production assets are Workers on `www.<domain>`; the edge picks brotli, then gzip. There is no bundle-size budget. The gates enforce eager application imports and exclude harness modules from the shipped client.

## Correctness machinery

Time, timers, ids, randomness, HTTP, and filesystem content are injected. Product code (`apps/`, `libs/`, `pkgs/`, scripts) does not call `Date.now`, zero-arg `new Date()`, `performance.now`, `setTimeout`, `setInterval`, `fetch`, `crypto.randomUUID`, `Math.random`, or `crypto.getRandomValues`. Composition roots (`createClient`, `createServer`, `createRoomServer`, `createHarness`) unpack ports. Solid reads them from context (`useClock`, `useTimers`, `useHttpClient`, `useCreateId`). Wall adapters live in tests or in files marked `// @io-wall-ok`. SQL does not mint time or ids (`now()`, `gen_random_uuid()`, and the rest are rejected). `Session` is harness-only. Libraries require the ports. An optional `io?` in shared game or domain code is rejected. File content goes through `@pkgs/object-store` (`sidecar` for blobs, `tree` for path-keyed trees). Process spawn, chmod, and path roots stay on `@pkgs/os`. Same seed produces the same path, bit for bit.

Every outbound HTTP response must be read to EOF, canceled, or forwarded to its caller. `HttpResponseScope` rejects unread bodies, partial stream reads, unconsumed clones and unfinished requests at the invocation boundary. The harness checks injected server HTTP; standard API Worker deployments check request and scheduled work; the localhost API also wraps wall fetches, including Room bindings. Local invocation helpers join `waitUntil` work before checking ownership and propagate rejections. Standard Workers return the foreground response without waiting for background work; a platform `waitUntil` completion joins that work and checks ownership, so later failures remain observable. Requests without background work finish their scope before replying. Production delegates background work to the platform. Worker span and log processors keep records in memory until the invocation explicitly flushes in `waitUntil`: ending a span or filling a log batch opens no collector connections and starts no timer. Each flush acknowledges its own batch without joining another invocation's I/O. Worker telemetry uses injected JSON OTLP exporters with a 64 KiB acknowledgement limit and a five-second virtualizable deadline; HTTP and partial-record rejections fail export rather than silently passing.

Shared game, domain, and sync code also avoids: IEEE floats in room event payloads (integers or strings; Glicko may float and then `Math.round` before it is stored); unsorted `Object.keys` for a hash, a serialization, or a turn order (`hashRoomState` / `canonicalJson`, or a `Map`); `localeCompare`, `Intl`, and `toLocaleString` (compare code units); `Promise.race` or microtask order as a durable winner (use `io.timers`); branching on `WeakRef`, `FinalizationRegistry`, or GC. Every `RoomModule` implements `hash(state)`. Social merge is server-arrival last-write-wins, not a CRDT. A new merge rule names its tie-break.

Specs are the definition of done. A rewrite that passes `specs/` is the same product. Kinds required by `specs/conformance.yaml`: behavior, decisions, dynamics, structure, objectives, accessibility. `UNKNOWN`, skipped, not run, manual, or stale evidence fails the release. Manual QA does not satisfy a gate.

Tests are black-box against package `exports`, live in `tests/`, and run with `bun test` in-process on virtual time. Only `*.contract.test.ts` may touch the wall, and those boot their own Postgres, S3, and EMQX sidecars. Spec steps are thin wrappers over a package's `./harness` actions and reads. No skipped, `.only`, `.todo`, `.if`, `.failing`, `--pass-with-no-tests`, or retries. A verdict never branches on `CI`.

New behavior is a property or a model. `assertProperty` from `@pkgs/property-shared-ts` is the only entry: seed `FC_SEED` default `424242`, runs `PBT_NUM_RUNS` default `40`. Raw `fc.assert`, `fc.check`, `fc.sample`, and `fc.statistics` are banned. Name the file `<topic>.property.test.ts`. A fingerprint binding replays its longest trace twice in fresh worlds and the hashes must match. `bun run test:pbt:random` hunts past the pin; whatever it finds is pinned before it is fixed. Product dynamics are a Quint model in `specs/<domain>/`, not a random walk in a test. A bug pins the shrunk input with `// regression: <bug-id>` (or `@regression:<bug-id>` on a scenario) and its own file `libs/tools-harness-ts/goal/known-bugs/<bug-id>.json`. That guard is an example, never a property file. A decided number, wire shape, or migration output is also an example. An example that a property fully covers, and that is neither a bug nor a decided value, is deleted.

Gates that enforce this: `behavior-tests.ts`, `no-skipped-tests.grit`, `no-unpinned-property.grit`, `no-wall-time-in-tests.grit`, `test-scripts.ts`, `tc-scope.ts`, `@libs/tools-harness-ts#ci:goals`, `verify-worker-bundle.ts`, `verify-offline-shell.ts`, `no-ci-verdict.grit`, `no-bare-io.grit`, `verify-budget.ts`. Local `bun verify` and `bun verify-nightly` set `VERIFY_TIME_LIMITS=off`: the full run, executed tasks and model solvers may finish without computation time cutoffs. All assertions, proof bounds, model properties and product timing rules remain enabled. Cancellation still stops the owned process tree. The limit mode participates in every task's cache key, so unlimited local results cannot satisfy a bounded CI run. Set `VERIFY_TIME_LIMITS=on` to run locally with the bounded allowances: 10 min for the whole run and 300 s per task. A Verify shard stays 20 min; Release's run deadline is 45 min; CI doubles per-task allowances. A task budget is raised only after the task is made faster, with the measurement in the commit body. The nightly profile widens bounded allowances in `verify-profile.ts` (a task four times, a shard 50 min, each nightly suite its own deadline). `VERIFY_DEADLINE_SECONDS` overrides one bounded run.

Continuous integration and continuous delivery: every pull request runs every gate, a green pull request is releasable by definition, and merging it ships it. Nothing a merge needs is deferred: Release verifies the exact commit again before shipping, and the nightly run only goes deeper on what already shipped:

| Command | Question |
| --- | --- |
| `bun verify` | Fast, deterministic, merge-blocking validation: the package-owned Turbo verify tasks, locally; Verify PR runs the same tasks in duration-balanced shards. Keeps no test report. |
| `bun verify-nightly` | Comprehensive verification and exploration: the same tasks at the nightly depth plus the nightly suites. `bun verify-nightly <group>` runs one group (`gate`, `random`, `browser`, `visual`, `coverage`, `performance`). Verify Nightly runs it on `main` every night and owns the reports. |
| `bun health` | Dispatch Health. Local forms are `bun health:local` and `bun health:prd`. |
| `bun deploy` | Release `main` by hand, as the push to main does: verify the exact commit with the whole gate, then ship it. Local environment forms are `bun deploy:local`, `bun deploy:dev`, and `bun deploy:prd`. |

Every Turbo run, local and CI, shares one remote cache: Vercel Remote Cache, team `crvougas-projects` (`remoteCache` in `turbo.json`). On a laptop, `turbo login` once per machine is enough: every checkout and worktree of this repo then reads and writes it, and their local caches are shared too (Turbo's shared worktree cache). In CI, `.github/actions/setup` injects secrets before `bun install`, so even the install's generation tasks use it; only jobs that inject no secrets fall back to a GitHub cache. `TURBO_TOKEN` is a Vercel access token for that team; without it a local run uses its local cache only, and CI and deploy refuse to start. `bun run secrets:turbo-token` creates one with the Vercel CLI, writes it to Infisical, revokes the one it replaces, refreshes the local secrets cache and runs `turbo login`; rerun it to rotate the token. A CLI signed in with "Sign in with Vercel" cannot create tokens: create one at https://vercel.com/account/tokens scoped to the team and pipe it in with `--stdin`. `bun run check:turborepo-remote-caching` checks the whole setup under the injected secrets: the token, no env `TURBO_TEAM` / `TURBO_API` overriding `turbo.json`, a write and read back on the remote cache, and a `turbo` dry run that must not report the remote cache disabled.

The capacity contract for a pull-request verification (under five minutes, and under three minutes for a leaf package) is [docs/CI_REQUIREMENTS.md](docs/CI_REQUIREMENTS.md).

Local verifications share one admission slot per user on the machine, held from before snapshot preparation through diagnostics archival. A waiting invocation prints its queue status and sleeps without preparing files or running verifications. Admission uses an OS-backed SQLite lock at `~/.cache/<namespace>/local-verify.sqlite`, independent of worktree paths and `TMPDIR`; closed connections and dead workers release it without stale PID files. A lightweight launcher supervises the worker over IPC, so a launcher exit cancels active verification processes before the worker releases admission. Local defaults are one task, one model solver, one concurrent product/Quint test case and one cache transfer/decompression worker. `TURBO_CONCURRENCY`, `MODEL_VERIFY_CONCURRENCY`, `VERIFY_SOLVER_SLOTS`, `VERIFY_TEST_CONCURRENCY` and `VERIFY_CACHE_CONCURRENCY` explicitly tune those concurrency limits; raising them increases peak memory. Interrupted invocations retain passing task artifacts for the next invocation.

`bun verify` and `bun verify-nightly` run their package-owned Turbo tasks on this machine in a private temporary snapshot of the current files (including uncommitted edits) and private copies of installed dependencies, including native library links created during installation. Each invocation owns its Git metadata, generated files, task outputs, caches, logs and evidence; after exit, inputs, logs and reports remain in the printed compressed diagnostics archive while disposable working files are released. Runs atomically publish complete task artifacts with summary-confirmed passing verdicts to `.cache/verify-artifacts`; later invocations copy them into their private cache, so warm verifications reuse results without sharing writable cache files. They publish nothing and never restore outputs into the working checkout. Turbo hashes each package task against its declared package files and external inputs; contract fixtures use private local sidecars. Four things are hashed into every task at once: `mise.toml`, `tsconfig.base.json` (compiler options only: the import aliases live in `tsconfig.paths.json`, which no task hashes, so adding or renaming a package does not miss the corpus), the root manifest's external dependencies, and any workspace package the root manifest depends on. The root `package.json` therefore depends on no workspace package (`verify-cache-keys.test.ts`): a package it listed would rerun the whole corpus on each of its edits, as the Atlas packages did. The plan prints these as `repo-wide hash inputs`, so a run that misses everything shows which one moved. The Synthetic Population Worker test hashes the package. Its hosting verification hashes the OpenTofu module. The planner fetches current registry advisory evidence on every run; the pure vulnerability gate caches against that normalized snapshot and the lockfile. Advisory changes invalidate the security result even when repository inputs stay the same. A pull request and Verify Nightly enforce the verdict; Release (`VERIFY_ADVISORIES=report`) records the same evidence in its log without failing, because an advisory published after a pull request cleared its code is not a change to that commit, so a green pull request is a green deploy. `lint` is naming, Biome (import boundaries and size caps), oxlint for Solid, package boundaries. Known-bug regressions are one task, `@libs/tools-harness-ts#ci:goals`: it reads every proof the register names, so a new known bug reruns that task and no package's lint. Typecheck is `tsc --noEmit -p tsconfig.tc.json` per package. Format with `bun fmt`.

Exactly four GitHub Actions workflows: Verify PR, Verify Nightly, Release and Health. Verify PR (`.github/workflows/verify-pr.yml`, `SECRETS_ENV=dev`) is the merge gate: it runs on every pull request to `main`, on a manual dispatch, as Release's release verification, and as the gate group of Verify Nightly. A pull request runs the `release` profile, the very gate Release runs on the commit it ships: lint, typecheck, unit tests, the repository `ci:*` checks, secret scanning, the advisory audit, actionlint, the workflow security audit (zizmor, `.github/zizmor.yml`), the brand policy and the synthetic rebrand (docs/BRANDING.md), schema evolution, the Worker bundles, and the slow suites — Gherkin spec parts, Quint models, the symbolic contract models, the release journeys, the board contracts and the population worker's hosting check. A pull request that would turn Release red is red itself, and every task it passes writes the remote-cache entry Release restores, so Release re-runs only what `main` changed since. (Until Release run 40628012072 a pull request ran a faster `pr` profile without the slow suites; Release then met them cold, failed them first, and ran out of shard time.) A pull request plans the fleet and foundation stacks only when it changes `libs/infra-shared-ts` or `libs/infra-server-ts`. One Turbo task list covers every package's lint, typecheck, unit and contract suite, Gherkin spec part, Quint model, schema evolution, worker bundle, offline shell and bespoke package verifications, including the Synthetic Population Worker hosting verification. The gate is bounded and never explores. Each Quint model replays only the fewest drawn traces that between them take every bound action, the same traces every run; every trace is still drawn, and the model's invariants and action coverage are judged on the whole draw; pinned regression histories always replay. That is the default wherever a model runs: a pull request, Release's verification and a dispatch share one bounded verdict and cache key, so Release restores what the pull request proved. Local verification keeps the same assertions and model bounds with computation time limits off and a separate cache key. Exploration is the `nightly` profile: `QUINT_REPLAY_TRACES=all` and `PBT_NUM_RUNS=200` are part of each task's cache key, only `libs/tools-harness-ts/scripts/verify-profile.ts` sets them, and Verify Nightly is the one workflow that runs it. A trace it fails is a defect to fix, pinned in the model binding's `regressions` so the gate replays it from then on. Three jobs: `verify:start` plans the shards, `verify:shards (N)` run them, and `verify:end` has the ending word. CI verifies only what runs on Linux, macOS and Windows alike: the native Swift packages and the POSIX-only `test:posix` suites are not checked in CI ([`docs/CI_REQUIREMENTS.md`](docs/CI_REQUIREMENTS.md#runner-operating-systems)). Planning asks the remote cache about every task and assigns the misses to duration-balanced shards; the shards and the fan-in consumers `verify:end` runs continue after failures so one red task does not hide the rest. A task that outruns its time budget is killed and fails its shard, but the shard then runs Turbo again over the tasks that can still pass (inside the shard's own deadline), so work that passes reaches the remote cache even in a red run and the next run does not repeat it. Only uncached work starts a runner: the plan packs the misses into as many shards as their measured durations need (about three minutes of work each, up to the shard count), records the cached verdicts itself, and hands the workflow a matrix of the shards that have work. A fully cached run is the start and the end; shards with nothing to execute are skipped, and the verdict accepts that only when the plan scheduled none. A solver task (a package's models verification, a part of one, or the product app's proofs) gets a runner to itself, where a proof's deadline has the same 2-core correction as a task's budget; a package whose proofs outlast one runner splits its models verification into `verify:models:<k>` parts (`modelParts` in its `package.json`). Durations are measured, not committed: `verify:end` saves what each task took to the Actions cache and the next plan restores it, falling back to `verify-task-costs.json`, then to the task's own suite, then to its family. `verify:end` reads every shard verdict and writes one summary to the job log and the run page. The `release` profile keeps no test report: no JUnit file, no trace, snapshot, coverage or run-summary upload, and no publication. The artifacts that carry the plan, the shard verdicts and build outputs between its jobs live a day at most, and `verify:end` deletes them; a failure is read from the log of the shard the verdict names. Under the `nightly` profile the same job retains the `verify-verdict` artifact (`verdict.md`, `verdict.json`, `verdict.junit.xml`) and aggregates and publishes reports as its last step, after the verdict and including after failures; they never change it. Each spec part hashes a generated fingerprint of its assigned sources and imported models. The spec gate verifies those fingerprints for freshness against current sources and refuses missing or stale ones. Feature ownership is stable across unrelated edits, while model batches retain their bounded allocation. Cached `prepare:spec` prerequisites draw each model once and distribute immutable traces to all consuming shards; replay depth, invariants, action coverage and regressions are unchanged. Setup caches generation artifacts separately from verification artifacts, and still performs a frozen install and hashes current generation inputs. A newer push cancels its pull request's superseded run; dispatched and release runs never cancel one another. The most shards a run may start and Turbo slots per shard are dispatch inputs (`VERIFY_SHARDS` and `VERIFY_CONCURRENCY` repository variables set the defaults). `VERIFY_MAX_PARALLEL` (default 16, GitHub's free plan's 20 concurrent jobs minus four) caps how many of a run's shards run at once, so a large run leaves slots for the next pull request's `verify:start` and `verify:end` instead of queuing them behind all of its shards. Every job runs on a standard GitHub-hosted runner (`runs-on: ubuntu-24.04`, bash as the shell), with conservative concurrency. The repository is public, so pull-request code is untrusted: each job gets a fresh GitHub-hosted VM that no later job (a deploy) reuses, setup installs dependencies before any secret is in the environment, every third-party action is pinned to a commit SHA, and no checkout keeps the job token. Exact task hashes reuse successful verifications and already-published report sources, so Release's verification of a merged pull request restores the verdicts its Verify PR run already produced.

`@apps/product-ts#test:release-journeys:<k>` (three parts, `--part=<k>/3`; one process running every feature outran its 600 s task budget and killed the shard, and the features are split by scenario count so no part holds the others up) is part of the `release` gate Release runs. Each part builds the production web client with its service worker and isolation headers, then discovers every health spec the local environment supports (the journeys, including Custom Game, join-link, offline, multiplayer chess and Connect Four, and the Connect Four health check), leaving out only what a `HOST_LIMITS` entry says needs a deployed environment, and runs them in Chrome against an isolated localhost API stack with its telemetry collector enabled. Signed-in journeys use the stack's own monitor credential. Each second person has a separate browser process so opening their device cannot erase the first person's storage. It uses the live journey host rather than the in-process client harness; the full browser spec corpus remains in the nightly browser group. Health workflow dispatch accepts an optional `spec` path to diagnose one live feature; an empty path runs every feature.

The release journeys reach Postgres the way the deployed API does (`--production-database`, `apps/product-ts/scripts/database-link.ts`). Releaseed, every statement is a round trip through Hyperdrive and a pool of `origin_connection_limit` sessions (`libs/infra-shared-ts/tofu/modules/database`) serves every request in transaction mode: a session is held from a request's first statement to the end of its transaction, and a request that waits 15 s for one is refused with `Timed out while waiting for an open slot in the pool`. A laptop's loopback database has neither, so a request that sent two hundred statements passed the gate and starved the pool in Release. The journeys' database now sits behind a wire-protocol link that adds the round trip (`PRODUCTION_DATABASE` in `production-database.ts`), serves the same number of sessions (a test holds the two numbers together) and bills each connection, which is one request: round trips, and round trips inside its longest transaction. A run fails when a request exceeds `REQUEST_BUDGET`, or when the pool refuses one. The counts do not depend on machine speed. `STACK_DATABASE_PROFILE=1 bun run --cwd apps/product-ts scripts/test-release-journeys.ts <feature>` prints every statement of the costliest requests. The API Worker is placed in the cloud region of the database declared in `global.tfvars.json` (`databasePlacement`), where a statement costs a few milliseconds; the link adds 3 ms, because the emulated Postgres already spends more than that per statement on a CI runner and a longer modelled distance would fail the journeys' wall-clock windows for a reason production does not have. What the link decides is deterministic: the pool and the per-request bill.

The release journeys also cross a network (`--edge-latency-ms=50`, `apps/product-ts/scripts/edge-latency.ts`). Loopback answers in microseconds, so a gesture made before the screen takes it, or a command sent before the app has finished its first sync, passed the gate and failed Release's dev health on a real network. The balancer in front of the API now delays every request, response and socket frame by 50 ms each way, in order. The delay is a constant, so what it decides does not depend on machine speed. A journey gesture that a person would repeat (play the move again, wait for the connection notice to clear before finding an opponent) does so; a gesture that cannot be repeated waits for the screen to be ready. A health spec that reads a deployed environment's secrets, addresses or infrastructure is left out of the gate by a named `HOST_LIMITS` entry (`needs: 'deployment'`), so a new health spec runs here unless it says why it cannot. A journey gesture the app can ignore while it settles, such as a chess move on a board that takes no input yet, repeats until the app takes it, as a person would; a live scenario's cleanups run on the activated host page, and a cleanup that fails prints both devices' state.

The release journeys' broker is not open. Browsers connect to AWS IoT through a Lambda authorizer that turns the API's token into session policy, and IoT refuses every connect, subscribe and publish the policy does not grant (at most ten documents of 2,048 characters; a topic filter only as written). A broker that allows everything let `system:chess_puzzles`, subscribed by every device and granted to none, pass the gate and loop every device's session in Release. The stack's Aedes broker now runs that authorizer (`libs/infra-shared-ts/src/iot-session-admission.ts`, called from `apps/product-ts/scripts/boot-infra.ts`) and records what it refuses. A refusal a fresh token cures (a `user:` or `room:` topic, held by a device that has not yet reconnected as its new self) is waited for. Any other refused topic, or a refused connection, fails the run (`apps/product-ts/scripts/broker-denials.ts`). A topic is granted by the sub that owns it (`pubsubTopics`).

A green `release` verification is meant to predict a green Release. Each step of Release's dev job, and what proves it first:

| Release runs | Proven first by |
| --- | --- |
| Verify commit | The whole gate (`release` profile) on the exact commit; it restores what pull requests and earlier releases proved. |
| Apply the fleet stack | `plan:fleet` against the real state, in `verify:end` of every pull request that changes the infrastructure. |
| Apply dev's foundation | `tofu validate`, tflint and the plan policy (`@libs/infra-server-ts#lint`); `plan:foundation` in `verify:end` once a person has applied bootstrap, which trusts the read-only AWS role for pull requests and sets `INFRA_PLAN_ON_PULL_REQUEST`. |
| Migrate, then the puzzle catalog | `verify:schema-evolution` and the validated load file, both on the emulated Postgres. |
| Release the application Worker | `verify:worker-bundle`, `verify:rendered-worker` (wrangler dry-runs the config rendered for each environment, placement included) and `verify:offline-shell`. |
| Health journeys | The release journeys through the production-shaped database link, against a broker that admits browsers by the deployed IoT authorizer's own rules (below). |
| Health: the app sits beside its data | Release only: the deployed environment is the thing measured (`specs/runtime/serving-people.feature`). It fails dev, before production, if the placement does not do what its documentation says. |
| `verify:api`, apply the edge stack, billing sync, the Synthetic Population Worker release, retire Workers | Nothing before Release. They need the real Workers runtime, Cloudflare, the payment provider or Railway. The population worker's hosting is verified offline by `verify:synthetic-population-foundation`. |

Two things no verification can promise. A commit that reaches `main` without a pull request has only Release's own run of the Verify PR gate in front of it, because the ruleset on `main` allows a direct push and does not require `verify:end`. And a provider outage (Railway, Grafana, PlanetScale) fails Release whatever the change.

Release (`.github/workflows/deploy.yml`) is the only path to production: on every push to `main` it verifies and ships that exact commit, and by hand through `bun deploy`. Merges and direct pushes start a release; pending releases queue without replacing one another. It runs the whole sharded gate (`release` profile) against the exact commit before shipping standard environments, then production, and tagging the commit `release-<run number>` with a GitHub release. Nothing deploys unless every gate passed. `//#deploy` contains only live deployment steps; the workflow's Verify job supplies the release verdict before those steps run. Health (`.github/workflows/health.yml`) runs hourly, deploys nothing, and probes every environment file. Release and Health run the same journeys as the same synthetic accounts against the same environment and plan the same OpenTofu state, so they never run together: an hourly check yields to a Release under way (its `health:matrix` job reads the Release runs), and each Release environment job waits out a Health run already in progress before it starts. A manual Health dispatch always runs. `bun health` git-syncs, including `main`, and dispatches Health. `bun deploy` does not commit: it fast-forwards local `main` and dispatches Release on `origin/main`. Cancelling Release does not roll back an apply that already started. Every Verify workflow gate is a cacheable task owned by its package and runs through Turbo; the sharded Verify task list is the release gate. The release gate is `verify:end`. Release runs it on that commit before anything ships, and the gate's jobs keep the `verify:` prefix wherever it runs. The ruleset on `main` blocks deletion and a force-push. There are no git hooks. Pull requests merge with a merge commit.

Verify Nightly (`.github/workflows/verify-nightly.yml`, `SECRETS_ENV=dev`) runs on the newest `main` every night and by hand. It never gates a merge or a deploy, and it deploys nothing. It is the same tests at another profile, never a second implementation: `verify-profile.ts` selects the tasks, their depth, their budgets and whether reports are kept, and a workflow only names a profile. Its groups run independently, so a red one never hides another:

| Group | What it runs | Evidence kept |
| --- | --- | --- |
| `verify-nightly:gate` | The whole Verify PR task list through the same four jobs, replaying every drawn trace of every Quint model at five times the property runs. Covers every unit, contract and Gherkin spec suite, the model verifications, and the fault, recovery and concurrency scenarios inside them. | Published reports, `verify-verdict` (JUnit), traces, run summaries, failed reports and model counterexamples (`verify-evidence-*`), and `profile.json` with the depth and the command to run it again. |
| `verify-nightly:random` | `test:pbt:random` (property runs on a fresh seed), `@apps/product-ts#test:fuzz` (determinism fuzz), `@pkgs/db-indexes-root-shared-ts#mutants`. | Every seed drawn and the replay command of a failure (`apps/product-ts/.cache/randomized/`). |
| `verify-nightly:browser` | `@apps/product-ts#test:stack`: every spec suite in real browsers against a booted localhost stack. | Step timelines, screenshots, recordings and traces of every scenario. |
| `verify-nightly:visual` | `@apps/product-ts#verify:ui-quality` on the corpus the gate group recorded. | Scores, failing screenshots and context clips. |
| `verify-nightly:coverage` | `verify:coverage`. | `lcov.info` and `summary.json`. |
| `verify-nightly:performance` | `@pkgs/room-root-harness-ts#bench`, `@libs/pong-harness-ts#bench`, `@pkgs/sql-root-shared-ts#perf`. | Each benchmark's output; [Pong profile scope](libs/pong-harness-ts/README.md#performance-profile). |

Manual debugging can select a group with `gh workflow run verify-nightly.yml --ref <branch> -f group=random` (or `gate`, `browser`, `visual`, `coverage`, `performance`). These runs report `verify-nightly:diagnostic`, verify only the requested scope (`visual` also runs its gate prerequisite), and never open or close the full Nightly issue. The scheduled run and the default `group=all` still run every group. While fixing a failure, use its narrow group and batch related changes before pushing; run the complete verification once the fix is ready. Superseded diagnostics cancel only another diagnostic of the same group and ref; complete runs retain their queue.

`verify-nightly:end` gives one verdict over every group and fails when any group did not succeed. On `main` it keeps one issue, "Verify Nightly is failing on main", open while the night is red, with each group's result, its artifact and its command; the next green night closes it. `bun verify-nightly <group>` runs a group on this machine at the same depth. Whatever a night finds is pinned as a regression in the suite that found it, which puts it in the `release` profile; a nightly-only test does not exist. Not in any workflow, each for a stated reason: `@apps/product-ts#explore:quint-system` (its pinned Rust evaluator is not in `mise.toml`, and it refuses to download tools), `@apps/product-ts#test:max` (the same suites as `test:stack` on fixed ports, at lower fidelity), and the `@pkgs/ui-quality-check-server-ts` and Synthetic Population capacity benchmarks (local measurements). Browsers are Chrome on the Linux runners; no workflow runs another browser or platform.

If Verify PR terminates before Turbo returns a task verdict, the shard retains that task's exact planned hash as a failure. Under the nightly profile, report-producing tasks also retain a termination report alongside any partial timelines, so failed evidence can still be published without a successful cache artifact. Missing verdicts never supply a passing result or a measured duration.

The required `verify:end` status is green only when every sharded Turbo task passes. Report publication is the nightly profile's last step of that job: a failed publication is visible on the step and leaves the verdict as it was. One private R2 bucket (`reports` in `global.tfvars.json`) holds per-attempt commit manifests and shared report content keyed by task hash and cache generation. The standalone Atlas server reads it through the storage adapter in `libs/harness-ts/scripts/atlas-reports-app.ts`; the product app exposes no reports screen or API. Snapshots are recorded on every harness step and published as compressed chunks, rather than one R2 write per snapshot. Identical chunks are reused across report layers; successful sources are reused across commits with identical task inputs. Report maintenance preserves earlier evidence and referenced content regardless of branch or commit changes. Release and hourly Health can remove unused branches without erasing report layers. `bun reports:cleanup` previews maintenance; `--apply --branches` performs it. A red nightly suite still publishes. Pull-request verifications, Release's verification and local verifications do not.

`@apps/product-ts#verify:ui-quality` is the nightly visual gate (`verify-nightly:visual`), and on demand locally. It is not in the sharded Verify PR task list or Release: the full corpus takes minutes on a 16-core runner, too slow for the standard release gate. Its artifact producer waits for every product spec part listed in [sources.json](apps/product-ts/scripts/ui-quality/sources.json), copies unique recorded states into the product's own cache, and compiles the same local stylesheet used by the reports viewer. Before replay, the producer deduplicates unreferenced DOM metadata and generated SVG identifiers while retaining visible text, styles, classes, image geometry, and every scenario reference. On the first complete CI corpus, that reduces 30,355 HTML documents to 10,565 inputs from 101,035 references across 789 reports. The gate replays existing HTML snapshots through four reusable headless Chrome pages at their recorded 390×844 phone viewport, reuses scores for identical rendered PNGs, scores remaining screenshots in batches with one local [ui-quality-check](pkgs/ui-quality-check-server-ts/README.md) instance, and checks any existing WebM/MP4 recordings directly. Matching document heads reuse their stylesheet and font context; one bounded replay batch is prefetched while the single model scores the current batch. Native inference waits for the existing product model contracts so it does not compete with symbolic verification. No scenario instrumentation or second UI exploration run is needed. Missing, failed, corrupt, or entirely absent evidence fails closed.

The checked-in [visual configuration](apps/product-ts/scripts/ui-quality/config.json) pins UIClip, CPU inference, minimum aggregation, and an explicit **experimental 0.5 threshold**. This is the model's neutral caption boundary, not a calibrated product quality claim; see its measured limitations in [EVALUATION.md](pkgs/ui-quality-check-server-ts/EVALUATION.md). Current artifacts are snapshots from the in-process harness: replay checks their composition, and cannot detect animation jank between steps or prove that a deployed browser painted the same UI. Real recordings retain their actual sampled timestamps.

Run it on demand: prepare the model once with `bun run --filter ui-quality-check setup --model-dir ../../.cache/ui-quality-model`, then run `bunx --no-install turbo run @apps/product-ts#verify:ui-quality`. The explicit `prepare:ui-quality-model` task verifies the installed model in `.cache/ui-quality-model`, or downloads and verifies its pinned checkpoint when absent. It is outside the offline gate; the 351 MB model exceeds the shared cache's artifact size limit. Replay drives a local Chrome through `Bun.WebView`. Chrome version participates in the platform cache key; upstream test hashes, CSS/font inputs, model package, and configuration invalidate the cached visual verdict. Passing cache hits also restore or reuse their evidence. Failures include scenario, step, actor, timestamp, score, and PNG in the harness report; stable JSON, model startup/inference and elapsed totals in `metrics.json`, and video context clips stay in `apps/product-ts/.cache/ui-quality/`.

Standing live checks are Gherkin features tagged exactly `@synthetic` on the feature line, after `@domain:`, in the context that owns the promise. The environment is where the runner points. A `.feature` has no schedule. The harness does not run `@synthetic`. `specs/journeys/` stays untagged: those journeys run on the harness in `bun verify` and live on Health. Tagging them `@synthetic` would take them out of the harness.

Tagged: `specs/runtime/reaching-the-app.feature`, `serving-people.feature`, `declared-environment.feature`, `connected-services.feature`, `stored-files.feature`, `request-records.feature`; `specs/auth/sign-in.feature`; `specs/billing/payments.feature` (production checks that the keys are real and charges nobody); `specs/spaces/spaces.feature`, `live-updates.feature`; `specs/profile/finding-a-person.feature`. The `# live` objectives (`specs/<context>/*.openslo.yaml`) do not gate a deploy. Some count these checks (each health run records one sample per feature), some Grafana Synthetic Monitoring's checks every minute, the rest the requests people really make, all judged over 7 days with burn-rate alerts generated from them ([Service level objectives](libs/observability-shared-ts/README.md#service-level-objectives), [`docs/SLO_COVERAGE.md`](docs/SLO_COVERAGE.md)).

| Command | What it checks | Where |
| --- | --- | --- |
| `bun run synthetic` | `@synthetic` only | dev |
| `bun run synthetic:prd` | `@synthetic` only | production |
| `bun health` | journeys and `@synthetic` | dev (hourly Health) |
| `bun health:prd` | journeys and `@synthetic` | production |
| `bun run --filter @apps/product-ts health:objectives` | `# live` objectives | the `SECRETS_ENV` already loaded |

`@synthetic` added no workflow. `--synthetic` and `--objectives` together are refused. `--target staging` is refused. There is no staging: `test` means `dev`, `production` means `prd`. `--target` sets `SECRETS_ENV` for the host lookup inside the product script; pick the environment with `synthetic` or `synthetic:prd` so those secrets load. A failure names the scenario, the step, and the environment. `synthetic.check` is not its own span; the evidence record already names the feature and scenario.

Leave a check untagged until it can run on a dedicated synthetic identity, clean up, and leave no real side effect. That includes journeys that host, end, or join a space, solve a puzzle, or change an avatar (they already run live as journeys on the synthetic monitor account), anything that reads a real person's data, sends a real notification, or takes a real payment, and edge cases, destructive admin, and checks that are not idempotent. A synthetic check uses dedicated identities, never a real person's data. Host limits are `HOST_LIMITS` in `apps/product-ts/scripts/health.ts`. Specs carry no host tags. Infrastructure health, runtime invariants, and OpenSLO stay their own checks. The availability objective is `# live` so `bun verify` does not measure CI history from the harness.

`specs/journeys/` runs in `bun verify` against the full composition and, on Health, in a real browser against the deployment, one fresh device per scenario. Signed-in journeys trade `SYNTHETIC_MONITOR_TOKEN` at `POST /api/auth/synthetic-monitor/code` for fresh dedicated accounts; ratings and unfinished games never carry into another scenario. A live failure saves a screenshot under `apps/product-ts/.cache/critical-journeys/<scenario>/`. Liveness is `GET /api/health`. Readiness is `GET /api/health/ready` (`503` when `SELECT 1` fails within 3 s). UI tests in Check use happy-dom. `HARNESS_MODE=real` and `stack` use the same `Driver` on `Bun.WebView`.

While iterating, prefer `bunx turbo run tc test --filter=<pkg>` before a full verification; an unchanged package is a cache hit.

A journey that opens another signed-in device keeps a server-issued monitoring
continuation in its runner. It lasts ten minutes, is bound to the callback and
the deployment's secrets, and grants another normal single-use sign-in code for
that same monitoring account. It never reaches the browser. Omitting it starts
a fresh account, so separate journeys still share no personal state.

Live Health scenarios run serially: the primary Chrome storage is shared, so each scenario must finish its cleanup before the next opens a device. Other participants use isolated browser processes.

Health authenticates AWS with its read-only role on a named branch. Use `gh workflow run health.yml --ref <branch>` (from a clone of the repository) for infrastructure health evidence. This does not grant a branch deployment access.

Health objectives run on `main` (scheduled or manual), so the rolling historical deficit is reported there rather than on a fix's PR. Branch Health runs still probe every environment. Objectives read GitHub Actions history with the workflow's `GH_TOKEN` and `actions: read` permission, including every run attempt and job page. No organization API credential is needed. Missing history credentials fail the objective with a setup error; they never count as passing checks. The request objectives read the metrics backend with `OBS_PROMETHEUS_URL`, `OBS_PROMETHEUS_USER` and `OBS_TEMPO_TOKEN`; missing credentials, no data or an unreachable backend fail them by name. A firing burn-rate alert fails the same job, which is how an alert reaches people while no Grafana instance is active.

CI keeps no GitHub Actions artifact: a full artifact quota stopped every Verify run at its plan upload. Jobs hand files to each other, and keep their reports, in the CI artifacts bucket through [`ci-artifacts.ts`](libs/tools-harness-ts/scripts/ci-artifacts.ts), under `runs/<run id>/<artifact name>/`. The bucket deletes every object after 7 days, and `verify:end` deletes a pull request's transfers as soon as it has read them. To read a run's artifacts, `bun run libs/secrets-server-ts/scripts/secrets-run.ts -- bun run libs/tools-harness-ts/scripts/ci-artifacts.ts --run <run id> download-all <name prefix> <directory>`.

Debug with `bun obs` before adding logs. Exit `0` found, `1` no match, `2` usage, `3` store unreachable. `--json` is for programs.

| Need | Command |
| --- | --- |
| It just happened | `bun obs last --window 10m` |
| Any id | `bun obs find <id>` |
| Everything one person did around a time | `bun obs person --name "…" --at "7pm MST" --place "Gilbert, Arizona" --source prod` |
| Failures only | `bun obs errors --since 24h` |
| Slow | `bun obs slow --since 1h --layer db` |
| A write | `bun obs mutation <mutation-id>` |
| A CI spec | `bun obs test '<exact test name>' --source <artifact>` |

`person` takes a name and an approximate time with a zone, and rebuilds everything that happened to every account of that name. It reads the traces carrying the account's `user.id`, then follows every `session.id` and `app.device.id` seen on them, so a crash before sign-in, a `client.error` and socket frames join; a trace naming another account is left out and counted. The report is the accounts and why each matched, the window in UTC, counts (traces, requests, errors, mutations, rejected), builds, devices, sessions, then PROBLEMS (every error, worst first, each with its `bun obs trace` and `bun obs span` command), then a TIMELINE in the person's zone and UTC: navigation, interactions, requests, mutations (`app.mutation.name` when recorded), rejections, room messages, errors, and spans over `--slow-ms` (default 1000). Database spans stay out of the timeline and are summed per trace; identical neighbours collapse; `--all` lifts the row and problem caps. An active account with no error says so and still shows the timeline. With nothing in the window it reports the last and next time the account was seen within 7 days, with the command to re-run there, and tells an unknown name from an account with no telemetry. `--json` is the same structure, `obs.person/v1` (`PersonData` in `@pkgs/observability-root-shared-ts/person-types`). Exit codes are unchanged.

Searches read their whole range: a full Tempo page is split by time until complete, `last` and `errors` list every error trace and then the newest activity, and a search that stops at its limit prints `WARNING truncated` (`truncations` in `--json`); `--all` raises the limit. Arizona is UTC−7 all year. Place matches the connection's city, region, or country, separate from the device clock, over all of an account's activity. `--source prod` loads `OBS_TEMPO_*` and `OBS_READONLY_DATABASE_URL`. It does not load `DATABASE_URL` or `GRAFANA_CLOUD_API_TOKEN`. Never hand an agent that admin token. Display names resolve in Postgres. Only the account id goes to Tempo. Email is never a span attribute.

Traces: harness writes `.cache/harness-report/traces/spans.ndjson` and Verify Nightly uploads `observability-traces-<run-id>`. `bun run dev` collects OTLP in a durable local journal (`--observability lgtm` also forwards to Grafana in Docker; `--no-observability` turns collection off). The journal and its discovery index survive stack shutdown and fresh starts. The supervisor writes unexpected process exits and their redacted stderr independently of the collector. `bun obs platform --service <worker-name>` reads retained Cloudflare runtime failures when platform termination prevents application export. Browser trace and log batches persist in local object storage before upload, retry after failures and reopening, and expire after 30 days. Releaseed Workers export traces, logs and metrics to the existing Grafana Cloud stack (Tempo, Loki and Mimir). Foundation manages environment-specific dashboard folders and alerts. `OBSERVABILITY_ENABLED=0` is the kill switch. Release fails closed without the collector URL and write token. Seed `GRAFANA_CLOUD_API_TOKEN` once with `bun run secrets:seed`.

Recording uses the OpenTelemetry API at boundaries (runtime entry, interaction, route, error, HTTP, SQL, room, sync, logger, test-failure sink). Domain code may import typed event, metric and reproducible-error contracts; recording stays in the shared root boundaries, and other manual observability imports stay confined to boundaries (`observability-boundary-imports.grit`). Span names are stable lowercase `{domain}.{action}` with no interpolated id. Attributes come from `ATTR`. Redaction is default-deny. Sampling is 100% locally and in CI. The default head sampler records all spans, including requests with an unsampled incoming context; an explicit sampler can override it. Who a span is for is bound once per unit of work with `bindIdentity` (`@pkgs/observability-root-shared-ts/identity-scope`, opened per request by the request telemetry middleware): spans open at that moment and every span started afterwards carry `user.id` and `app.device.id`, so stamping one span by hand is a lint error (`observability-identity-via-scope.grit`). The telemetry ingress states `service.name` and `deployment.environment.name` for every browser trace batch; a page reports `unstated`, because it cannot know which deployment served it, and a record under a name no deployment owns is missed by every per-environment query, dashboard and objective. Each outbox delivery runs in a savepoint and has an `outbox.deliver` span naming its consumer, event and attempt; a lost race (`40001`, `40P01`) is retried without spending an attempt. `request-records.feature` checks the trail itself on every Health run: the scheduled drain wrote to it in the last five minutes, every record names a deployed environment (or `health-probe`, the planted spans of `finding-a-person.feature`), and requests that need an account carry `user.id`. Telemetry is not the source of truth. A mutation stores its id and `traceparent` in the outbox. Independent signals, reliable event contracts and their limits: [observability framework](pkgs/observability-root-shared-ts/README.md). Product coverage and deployment gaps: [observability audit](libs/observability-shared-ts/README.md).

## How a change lands

Commit and push only through `bun run git-sync` (message is a Conventional Commit, subject ≤ 72 characters, no trailing period). The script commits, pushes the feature branch, merges `origin/main`, pushes again, and fast-forwards local main. It does not force-push and does not push `main`. On conflict it aborts unless `--leave-conflicts`.

A commit that touches `specs/` or any `.feature` file is `spec:` or `spec(scope):` and may only change `specs/`, `.feature` files, and `docs/*.md`. Implementation follows in a later commit. `STEPS_CATALOG.md` files are generated and gitignored; refresh them with `bun run spec:catalog` after a step change. The ownership gate also recognizes those generated documentation files in historical commits.

`main` moves only when a person merges a green PR. Agents do not merge and do not use `--admin`. They may create branches and worktrees, push them and open pull requests ([`AGENTS.md`](AGENTS.md)). PR body follows `.github/PULL_REQUEST_TEMPLATE.md`.

Repo file names: markdown docs are `SCREAMING_SNAKE_CASE.md` (`README.md` matches); every other file and directory is `lower-kebab-case`. `bun run lint:naming` verifies; `bun run naming:fix` rewrites.

## Invariants that make a patch wrong

- Specs describe what a person observes. This file is a briefing. It is not a second product definition.
- One write path: `mutate()` / `defineMutation`. Domain SQL runs inside the mutation. No sub REST for synced data. Billing and external webhooks are the exception list; do not grow it.
- No `DELETE FROM` on a domain table. Framework `sync_engine_*` tables may hard-delete.
- No bare I/O. No `Io` bag, no silent wall-clock fallback.
- No access checks by reading `is_anon`, subscription rows, role names, or plan names from sub code.
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

**Games** (`specs/games/`), run for every game offering each: the game's choices shown to the whole space; custom games with people and bots; rematches; returning after time away; the offline host's bot game; turns and a finished game; finding an opponent for the same game; history, review and per-game statistics.

**Connect Four** (`specs/connect-four/`): gravity and full columns; winning alignments; the full-board draw; Hard bots; accessible columns.

**Friends** (`specs/friends/`): friends require an account; friends need a connection; request accepted; declined or cancelled; requests reach the inbox; remove; block and unblock; another person's profile; profile changes reach other people; people search; friends in an open space.

**Billing** (`specs/billing/`): what the plans offer; what the plans tell a person; paid access belongs to one person; subscribe; trial and renewal; switch Plus plans; Plus credit from switching; switch payment provider; portal; cancel and subscribe again; failed payments; expired card; when paid access runs out; paid access while offline; refunds.

**Sync** (`specs/sync-engine/`): write, delete, checked notes, refused edits; count once; across devices; offline; a long time offline; after a crash; across app updates; arrive quickly; leave a shared space and rejoin; online-only actions.

**Room** (`specs/room/`): shared tally; who is in the room; owning the room; timed match.

**Matchmaking** (`specs/matchmaking/`): waiting for a match; being matched.

**Live checks** (`@synthetic`, in the owning context): reaching the app; serving people; the environment as planned; outside services; uploads; the request trail; signing in; payments; spaces; live updates; finding a person's trouble. Availability: `specs/runtime/availability.openslo.yaml`.

**Journeys** (`specs/journeys/`): critical journeys; joining from a link, and opening with no connection.

### Atlas specification explorer

`bun atlas:viz` opens the standalone Atlas development server. Its header is the product's name and one tab per kind of spec: the statechart map, then Gherkin, Quint, DMN, Alloy and OpenSLO. Each tab's index lists every spec under `specs/` with what was recorded for it (and filters to those with results, failing, or with none), so a spec without evidence is visibly different from a passing one. A spec page shows each scenario, trace or check with its outcome, recorded steps, error, timings, recording and every other run of that check. Results combine across backends (this machine's `.cache/local-reports` and the shared reports store), branches and runs: for each check and parameter set the newest completed result is shown, an absent or unfinished run preserves older outcomes, and **Sources** switches any backend, branch or run off to read what earlier runs recorded. Every result keeps its origin. Spec fingerprints and related working-tree changes qualify potentially outdated results without discarding them. This fast accumulated view is not a fresh verification verdict.

`bun atlas:run` runs the spec suite of every package (`bun run spec --keep-going`: features, models, decision tables, structures, objectives and each package's `tests/harness`). While a suite runs, `bun atlas:viz` reads the tests it has finished straight from its report bucket, so each result appears within a couple of seconds of its test ending; when the package finishes, its collected report layer (recorded under the current branch) takes over. A red package does not stop the others; the command still exits with the first failure. It takes the same arguments as `bun run spec`. `bun atlas:build` builds a standalone static Atlas site and exports available report layers into it. Export reads existing results; it never executes tests or turns missing evidence into a pass. `bun reports:collect` retains completed local results from earlier commits and modified checkouts with provenance warnings; completion time is kept separately from virtual timeline time. `bun reports:part` and `bun reports:performance` remain producer adapters. Report models, publication, retention, readers, API and visualization belong to Atlas.
