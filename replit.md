# gamezilla — Expo Router Project

## Overview

A React Native / Expo Router application that runs on web (via Metro bundler), iOS, and Android. This project uses Expo Router for file-based routing and expo-sqlite for local database support.

## Project Structure

- `src/app/` — Expo Router file-based routes (tabs layout)
  - `(tabs)/index.tsx` — Home tab
  - `(tabs)/explore.tsx` — Explore tab
  - `_layout.tsx` — Root layout with navigation theme
  - `modal.tsx` — Modal screen
- `src/components/` — Shared UI components
- `src/constants/` — Theme and other constants
- `src/hooks/` — Custom React hooks
- `src/assets/` — Images and icons
- `src/backend.ts` — Bun static file server (for production preview)
- `src/@shared/` — Shared utilities (static file server, SQL client, patch-db)

## Tech Stack

- **Framework:** Expo / Expo Router ~6.0 with React Native 0.81
- **Runtime:** Node.js 20 + Bun 1.2 (for backend/scripts)
- **Language:** TypeScript
- **Package manager:** npm (node_modules installed)
- **Web bundler:** Metro (via Expo)

## Development

The app runs as a web app via Metro bundler on port 5000.

**Workflow:** `EXPO_NO_TELEMETRY=1 npx expo start --web --port 5000`

### Replit-specific Notes

- The CORS middleware in `node_modules/expo/node_modules/@expo/cli/build/src/start/server/middleware/CorsMiddleware.js` has been patched to allow all hosts (required for Replit's proxy/iframe preview). The `_isLocalHostname` function always returns `true`.
- After `npm install`, re-apply the patch if the middleware file gets overwritten.

## Deployment

Configured as a **static** deployment:

- **Build:** `npx expo export -p web` (outputs to `dist/`)
- **Serve:** Static files from `dist/`

The `src/backend.ts` Bun server can also serve the static export for self-hosted deployments.

## Scripts

- `npm run start` — Start Expo dev server
- `npm run web` — Start Expo web
- `npm run export:web` — Export static web build to `dist/`
- `npm run backend` — Run Bun static file server (serves `dist/`)
- `npm run lint` — ESLint
- `npm run tc` — TypeScript type check
- `bun test` — Run all tests

## Shared Libraries (`src/@shared/`)

### patch-db

An entity-as-patches abstraction. Entities are represented as an ordered series of patches. Each patch carries a set of attributes to merge; setting an attribute to `null` deletes it from the entity. Supports branching via `parentId` so multiple concurrent writers can contribute patches.

Uses a **snapshots** table that holds the current merged state of each entity. Snapshots are recomputed on every `write()` within the same transaction. `entities()` queries snapshots directly (all filtering, ordering, pagination at the SQL level). `patches()` uses a subquery against snapshots when `where` filters are present, then returns matching patches.

- **Interface:** `src/@shared/patch-db/interface.ts` — `PatchesDb` interface with `write()`, `patches()`, `entities()` methods
- **SQLite implementation:** `src/@shared/patch-db/impl-sqlite/impl-sqlite.ts` — backed by the `SqlClient` abstraction
- **Schema:** `src/@shared/patch-db/impl-sqlite/migrations.sql` — `patches` + `snapshots` tables
- **Tests:** `src/@shared/patch-db/interface.test.ts` — tests against the interface, not the implementation

### sql-client

A minimal SQL database client abstraction with `connect`, `disconnect`, `query`, `run`, and `transaction` methods.

- **Interface:** `src/@shared/sql-client/interface.ts`
- **Bun SQLite impl:** `src/@shared/sql-client/impl-bun-sqlite.ts`
- **Expo SQLite impl:** `src/@shared/sql-client/impl-expo-sqlite.ts`
- **PubSub decorator:** `src/@shared/sql-client/impl-with-pub-sub.ts` — `SqlClientWithPubSub` wraps any `SqlClient` + `PubSub`, publishes `SqlClientEvent` on connect, disconnect, query, run, transaction begin/commit/rollback
- **Tests:** `src/@shared/sql-client/interface.test.ts`

### pub-sub

A synchronous topic-based publish-subscribe module. Provides a `PublishSubscribe` interface with `publish()` and `subscribe()` methods. Generic message types, returns an `Unsubscribe` function.

- **Interface:** `src/@shared/pub-sub/interface.ts` — `PubSub` interface, `Listener`, `Unsubscribe` types
- **In-memory impl:** `src/@shared/pub-sub/impl-in-memory.ts` — `InMemoryPubSub` class
- **Tests:** `src/@shared/pub-sub/interface.test.ts`

### static-file-server

Static file serving with SPA fallback, path traversal protection, and configurable MIME types.

- **Core:** `src/@shared/static-file-server/static-file-server.ts`
- **Bun adapter:** `src/@shared/static-file-server/static-file-server-adapter-bun.ts`
- **Tests:** `src/@shared/static-file-server/static-file-server.test.ts`
