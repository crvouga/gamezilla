# Feature subsystems

The product is a set of bounded contexts folded together by a composition
root. Each context — a *feature* — owns a vertical slice: its tables, its
synced reads and writes, its screens, its routes. Nothing else knows what is
inside it, and it knows nothing about anything else.

This exists so a feature's tests can run when that feature changes and stay
cached when it does not. Everything below follows from that.

## The three folds

A feature exports three manifests, and the composition root folds each one.
The fold is the same function in production and in a test harness — that is
the point of it, so test wiring cannot drift from production wiring.

| Manifest | Declared in | Folded by | Holds |
| --- | --- | --- | --- |
| `FeatureManifest` | `libs/<feature>/src/root/feature.ts` | `composeFeatures` | domain tables, wake topics, synced queries, session queries, a thunk for mutations |
| `FeatureClient` | `libs/<feature>/src/root/client/feature-client.tsx` | `composeFeatureClients` | routes, tabs, docked widgets, chrome and session providers |
| `FeatureServer` | `libs/<feature>/src/root/server/feature-server.ts` | `composeFeatureServers` | HTTP routes, outbox consumers, pubsub topics, compose-time registrations |

The algebra lives in `@libs/feature` and is generic over what features
declare. It imports no feature, and a check keeps it that way.

## The layers

```text
apps/            entry points: a browser bundle, a Worker, the product console
  client           index.html, main.tsx, Vite, the service worker, bundle gates
  server           the Worker handler, wrangler, deploy and preview scripts
  product          the super-app: wall client, Simulator, sim fabric, harness

libs/
  feature          the manifest algebra and the three folds. Knows no feature.
  client-app       the app shell: providers, router, chrome, sync boot
  server-app       the API shell: request scope, auth, sync, rooms, matchmaking
  runtime          the composition root: the one list of features, and the fold
  auth             \
  permissions       |  platform: cross-cutting, every app needs them
  client-config    /
  spaces  chess  friends  profile  billing  notifications  search
                   the bounded contexts

pkgs/            project-agnostic: sim, sync-engine, ui, sql, room, …
```

`client-app` and `server-app` are shells, not applications: they take the
features they run as an argument. `createClient(env, { features, loadApp })`
and `createServer(env, { app, servers })` boot one bounded context or all of
them with the same code, which is what lets a feature's own test run the real
shell instead of a second one written for tests.

## Where a new test goes

- **It exercises one feature** → `libs/<feature>/tests/e2e/`, black-box
  against the package's exports, booting a composition of only the slices it
  needs (`composeSimSlices` + `defineProductSystem` from `@libs/sim-harness`).
  The actions, reads and slice it drives live in that feature's `./sim`
  surface (`libs/<feature>/src/sim/`). The suite's home is the lowest package
  that may depend on every feature it composes — turbo rejects cycles.
- **It spans features** (a friend joining a space, a puzzle limit opening the
  billing screen) → the full-composition layer. Do not stretch a subsystem
  test across a boundary; that is what makes every test depend on everything.
- **It is not an e2e at all** (validating a fixture, checking a static
  policy) → next to the thing it checks, as an ordinary test.

The full-composition layer boots the real app composition and is about a tenth
of the coverage. It invalidates whenever any feature changes, by design. That
is the price of checking that the whole thing still assembles, which is why it
stays small, stays fast, and is **never skipped**: it is the only test that
would notice a feature that folds correctly on its own and not with the
others.

## Adding a feature

1. `libs/<name>/` with `package.json` (`exports` for `./public/*` and
   `./root/*` only), `tsconfig.tc.json`, and `src/{public,shared,use-cases,root}`.
2. Declare its tables with `defineTable` in `src/shared/schema/`, export them
   from `src/public/schema.ts`.
3. Write `src/root/feature.ts`: `defineFeature({ name, tables, topicMap,
   sessionQueries, queries, mutations })`. The topic map may only name tables
   the feature declares — that is a type error otherwise.
4. Add it to `APP_FEATURES` in `@libs/runtime/root/app-features.ts`. That is
   the only edit outside the feature.
5. For UI: `src/root/client/feature-client.tsx` and add it to
   `APP_FEATURE_CLIENTS`. For API: `src/root/server/feature-server.ts` and add
   it to `appFeatureServers`.
6. Tests in `libs/<name>/tests/`.

Order matters in those lists and is the composition root's to choose: a
provider listed earlier is mounted outside one listed later, so a feature can
read context a feature above it published. Friends is listed before
notifications because it registers a notification source the inbox reads.

## Cross-feature needs are ports

A feature never imports another feature. When one needs something another
owns, the *consumer* declares the hole from its own point of view and the
composition root fills it:

- `profile` declares slots on its screen; `friends` fills them with a friend
  count and add/remove buttons. A profile with no friends feature composed in
  has no friends row — a real state, not a degraded one.
- `notifications` declares a source registry; `friends` registers into it.
  The inbox renders what it was given and does not know what a friend request
  is.
- `client-app` declares that a client may need a room transport; `spaces`
  supplies one that knows a room is a space.
- `search` declares a result-row slot; `friends` fills it with the friendship
  status and add / accept / cancel pills. Search with no friends composed in
  shows plain rows.

`readsForeign` on the manifest is the exception that proves the rule: a
feature may declare that its queries read another's table (friends joins
`profile` for names and avatars). It is checked — the table must be real, the
queries must actually read it — so the coupling is visible and countable
rather than implicit. Prefer a port.

## What is enforced, and how

| Boundary | Enforced by |
| --- | --- |
| A feature's topic map may only name its own tables | the type system (`TopicMapFor`) |
| Two features may not declare the same table | `composeFeatures` |
| A feature's queries may only read its own tables plus declared `readsForeign` | `libs/runtime/tests/feature-boundaries.test.ts`, from the SQL AST |
| A shell may not depend on a feature or the composition root | that package's `lint` (`libs/tools/scripts/package-boundaries.ts`) |
| A feature may not depend on the composition root | that package's `lint` (`libs/tools/scripts/package-boundaries.ts`) |
| Tier pyramid, `shared/` purity, client/server split | Biome `import-*.grit` rules, in each package's `lint` |
| The sim harness may not depend on a feature | that package's `lint` (`libs/tools/scripts/package-boundaries.ts`) |
| A package declares no workspace dependency it does not use | that package's `lint` (`libs/tools/scripts/unused-dependencies.ts`) |
| A package imports only what its `package.json` declares | Biome `noUndeclaredDependencies`, in each package's `lint` |

The package-boundary check reads `package.json` dependencies *and* import
specifiers, because turbo builds its task graph from `package.json`: a
dependency there is a cache invalidation everywhere downstream, and a shell
that names one feature quietly puts every feature in every feature's test
closure. A per-file import rule cannot catch that — the dependency is in the
manifest, whether or not a file imports it.

## Hidden table reads (debt)

A subsystem sim fails loudly when a feature reads a table its composition does
not declare, which is how these three surfaced. They bypass the manifest, so
`feature-boundaries.test.ts` (which checks `defineQuery` reads) does not see
them, and turbo does not rerun the reader when the owner's schema changes.

| Reader | Reads | Consequence today | Fix |
| --- | --- | --- | --- |
| `permissions` (`use-access-facts.ts`, `read-access.ts`) | billing's `billing_subscriptions` | every sim composes billing; a billing change reruns every feature's e2e | a membership-facts port billing fills (it must stay inside the mutation transaction, so the port goes through the mutation env) |
| `spaces` (`friendship-sql.ts`, `actor-visible-spaces-sql.ts`, `use-is-friend-of-host-local.ts`, `topic-map.ts`) | friends' `friends_friendships` | spaces cannot run without friends, so its e2e lives in `libs/friends`, and chess composes friends | a friendship port friends fills, or the friendship schema in a package below spaces |
| `search` (people search) | friends' `searchProfiles` sync query and `friends_blocks` | search cannot run without friends, so search-people lives in `libs/friends` | the search query in search, with block filtering behind a port friends fills |

## What reruns

A change reruns its package's checks and its dependents'; an e2e suite reruns
when anything in its composition's closure changes. The full-composition
suite (`@libs/runtime#test:e2e`) is small — shell boot, the platform's Quint
model, critical journeys — and is the only e2e that reruns for every feature.

Measured with `turbo run test:e2e --filter=...<pkg> --dry=json` (the e2e
tasks in a package's dependents). Before the split, every row was "all 46
specs, one task".

| Touch | E2e suites that rerun |
| --- | --- |
| `@libs/chess`, `@pkgs/chess-board` | chess, product |
| `@libs/runtime` (the composition root) | product |
| `@libs/friends`, `@libs/spaces`, `@libs/search`, `@libs/notifications` | chess, friends, product |
| `@libs/profile` | chess, friends, profile, product |
| `@libs/billing` | all (hidden read above) |
| `@libs/sim-harness`, a shell, `@pkgs/ui`, `@pkgs/sync-engine` | all — correct by design |
