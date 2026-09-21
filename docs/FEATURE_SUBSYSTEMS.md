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

- **It exercises one feature** → `libs/<feature>/tests/`, black-box against
  the package's exports, defined with `@pkgs/sim` `defineSystem`. The actions
  and reads it drives live in that feature's `./sim` surface.
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
| A feature's queries may only read its own tables plus declared `readsForeign` | `@libs/runtime#check:feature-boundaries`, from the SQL AST |
| A shell may not depend on a feature or the composition root | `//#ci:package-boundaries` |
| A feature may not depend on the composition root | `//#ci:package-boundaries` |
| Tier pyramid, `shared/` purity, client/server split | `//#ci:depcruise` |

The package-boundary check reads `package.json` dependencies *and* import
specifiers, because turbo builds its task graph from `package.json`: a
dependency there is a cache invalidation everywhere downstream, and a shell
that names one feature quietly puts every feature in every feature's test
closure. depcruise cannot catch it — it resolves relative paths, and these are
workspace aliases.

## What reruns today

Measured on this tree with `turbo run tc test --dry`, warm cache. The numbers
are tasks that would *execute*; everything else is a cache hit.

| Touch | Tasks that run |
| --- | --- |
| nothing | 0 of 273 — `FULL TURBO`, 202ms |
| one test file (`apps/product/tests/chess-puzzle-play.test.tsx`) | 1: the product test task. Typechecks stay cached. |
| `libs/chess/src` | 17: chess, games (which registers it), the composition root, and the apps |
| `libs/profile/src` | 27: profile plus the five features that still import it, the root, the apps |
| `libs/runtime/src` (the composition root) | 13: the root and the apps |
| `libs/client-app/src` or `libs/server-app/src` (a shell) | 29: the features that contribute to it, the root, the apps |
| `pkgs/sync-engine/src` | 52: everything. Correct by design — keep that package small. |

Two things to read out of this. Touching a feature no longer reruns the
shells, which is the whole point of the fold; and the apps rerun for every
feature because **all 46 e2e specs are still one task in `@apps/product`**.
Splitting them into the features is what makes the first column narrow, and is
tracked in [`E2E_MIGRATION_LOG.md`](E2E_MIGRATION_LOG.md).

`libs/profile` reruns more than `libs/chess` because five features still
import it directly. Each one of those is a port waiting to be declared; the
number is the debt, and it is visible.
