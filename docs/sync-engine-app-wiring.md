# Sync-engine app wiring (product)

Product composition for `@pkgs/sync-engine`. Keep product names here — the package README stays domain-agnostic.

**Client** (`apps/client/src/sync/create-local-sync-engine.ts`)

1. Open identity SQLite → `createLocalSyncEngine({ sessionQueries, postQueries,
   postMutations, push: { rowImageFanout: true, … }, lifecycle, … })`
2. `SyncEngineProvider` + `SqlClientProvider` + `SyncEnginePaintGateContext`
3. `MutationClientProvider` with `MutationEnv` + `{ clientId: deviceId }`
4. Feature: `useQuery(sql\`… AND deleted_at IS NULL\`)` +
   `useMutationClient().mutate(def, args)`

**API** (`apps/server/src/sync/sync-app.ts`)

1. `SyncEngineDatabaseMigration` during migrate (package-local `defineTable` schema)
2. `createSyncApp({ resolveAuth, getSql, queries, mutations, pubsub,
   rowImageFanout: true })`
3. Non-mutation DOMAIN writes must `notifyChannels({ pubsub, sql, topics, … })`

Registries: `apps/client|api/src/sync/app-queries.ts` + `app-mutations.ts`.

---

