# paint-ready-before-first-sync

Focus: Lifecycle Transitions (init ordering). Product paint gates vs network first-sync.

## Why this property

The product claims local paint is an **identity + assets** latch, not a hydration latch. `bootReady` hides the splash once fonts, Skia, and a local engine exist. `paintReady` is true only when `SyncEngineBoot` is serving an engine whose SQLite name matches the current `users.id`. Neither waits for `hasSynced` / `waitForFirstSync`. Query hooks (`useFriendRequests`, spaces miniplayer, profile) enable on `paintReady` and will read **empty or stale local rows** on a cold file.

If a future change waits for first-sync before paint, cold start blocks on the network. If `paintReady` goes true on a sticky prior-account engine, the UI paints the wrong user’s SQLite.

## Code paths

- `apps/client/src/providers/shell/local-paint-latch.tsx`
  - `bootReady = fontsReady && engineReady && assetsReady`.
  - Comment: “Never waits on network first-sync.” `hideSplash()` runs when `bootReady`.
  - `markEngineReady()` is called from `SyncEngineBoot` when `engine !== null` **or** `boot.phase === 'error'` — a failed open still releases the splash (error screen), not a hydrate wait.
- `apps/client/src/providers/shell/boot-paint-gate.tsx` — navigator children hidden until `bootReady`.
- `apps/client/src/providers/local-database/use-sync-engine-boot-state.ts`
  - `ready` after `await engine.connect()`, explicitly: “Does **not** wait for network first-sync — session queries continue in the background after `connect()`.”
- `pkgs/sync-engine/src/client/create-local-sync-engine.ts` `connectState` (319–340)
  - Sets `connected`, starts upload + `runtime.start()`, `await attachPushIfConfigured` (no-ops if no broker URL), patches `connection: 'syncing'`.
  - `hasSynced: true` is only in subscription `onSynced` (222–227), after first-sync of session queries — **not** on the `connect()` path that unblocks paint.
- `apps/client/src/providers/local-database/sync-engine-boot.tsx`
  - `paintReady = boot.phase === 'ready'`.
  - `resolveMountedEngine` may still show a **sticky prior** engine while the new identity is loading (`paintReady === false`). Embedded playground never sticks.
  - Identity / `databaseName` change clears the sticky ref (231–238) so OPFS close cannot leave the old connection painted as ready.
- `pkgs/sync-engine/src/client/sync-engine-paint-gate.ts` — context default `true` (dangerous if a tree mounts without the provider). Product boot always wraps with `SyncEnginePaintGateContext.Provider value={paintReady}`.

## Failure scenario

Cold install: local SQLite empty, `client_config` missing, `hasSynced === false`. `connect()` returns, `paintReady` flips true, friend/space/profile hooks fire `useQuery`. UI can render “no friends / no spaces / no username” as truth until the first `POST /api/query` lands.

Account switch: `userId` changes → new `databaseName` → `paintReady` false while prior engine may still be mounted (non-embedded). If `paintReady` stayed true, hooks would read the old file.

Antithesis: delay or drop first-sync while local open succeeds; pause between `connect()` and `onSynced`; kill the API after health 200 so first-sync never completes; switch accounts mid-open.

## Key observations

- `paintReady` is **not** a liveness property for hydration. SUT analysis already flags this. The lifecycle invariant is ordering: local identity open ⪯ paint ⪯ first-sync (first-sync may never happen).
- `connect()` **does** await `attachPushIfConfigured`. Missing EMQX URL → immediate return. Present URL → MQTT attach is on the paint critical path, still not first-sync.
- Error open (`boot.phase === 'error'`) marks the latch ready so the user sees `LocalDatabaseBootErrorScreen` instead of an infinite splash. That is a distinct outcome to mark `Reachable`, not a hydrate success.

## Existing instrumentation

Missing. No SDK. Sim worlds `addClient` wait for first-sync (`world-ops-add-client.ts`) — the opposite of product paint. Porting sim `until(hasSynced)` would **hide** this property.

Suggested (all **missing**):

- `Always("paint-ready-implies-current-identity-engine", !paintReady || boot.phase === 'ready')` next to the `paintReady` assignment.
- `Always("paint-ready-does-not-require-hasSynced", !paintReady || true)` is tautological — instead `Sometimes("paint-ready-before-hasSynced", paintReady && !status.hasSynced)`.
- `Always("paint-ready-false-during-identity-switch", dbName === currentDbName || !paintReady)`.
- Workload: after `bootReady`, assert UI queries ran while `hasSynced === false` at least once (`Sometimes`).

## What goes wrong if violated

- Paint waits for first-sync: splash hangs on partition; users think the app is broken.
- `paintReady` true for the wrong file: previous anon/Google account’s spaces and friends flash, then vanish — the “confirmed success then contradiction” class in the SUT analysis.
- Treating empty local rows as authoritative before first-sync: “you have no friends” / blank profile on returning users.

## Open questions

- Which product screens treat an empty `useQuery` result as a terminal empty state vs a loading state when `paintReady && !hasSynced`? If any empty state is terminal, the property should include “no durable empty-state commit before first-sync of that scope.”
- Does `attachPushIfConfigured` hanging (EMQX `waitUntilConnected` has no timeout, per SUT analysis) block `connect()` and therefore `paintReady` forever when a stale `client_config` URL is already in the file? If yes, paint is not “local-only” on warm upgrades.
- Default `SyncEnginePaintGateContext = true`: are there test or explorer trees that enable queries without `SyncEngineBoot`?
