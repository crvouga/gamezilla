# api-remake-foreground-query-applies

Focus: Lifecycle Transitions / Protocol Contracts. User-visible half of deferred `three-seq-spaces-unconflated` scenario 3 (isolate-local checkpoint remake). Does **not** require seq-column probes.

## Claim to test (not a fact)

After the `api` process is remade (optionally after a forward clock jump), a **foreground** client that can complete `POST /api/query` eventually applies a snapshot whose subscribed domain matches Postgres. A 200 `ok` whose checkpoint compares ≤ the client’s `last_checkpoint` must not be the last word while the server has newer rows — the next accepted snapshot (or a hash-miss refetch) must merge.

SUT `[concurrency]`: checkpoint allocator is isolate-local (`checkpointSeq` in `createSyncApp`), not a DB sequence. `[architecture]` three-sequence table. Wildcard A5: remake + corrected `now()` can mint checkpoints below every client’s stored high-water so every `ok` looks `isStale`.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Why this property

Product `apps/server/src/sync/sync-app.ts` does **not** use `createMonotonicCheckpoint` and does **not** pass `initialLast`:

```ts
let checkpointSeq = 0;
nextCheckpoint: () => {
  checkpointSeq += 1;
  return `${String(time.now())}${String(checkpointSeq).padStart(6, '0')}`;
}
```

Framework `createMonotonicCheckpoint` documents the remake hazard and offers `initialLast` from the prior `highWater`. Sim remake can pass `checkpointFloor`. Product `createServer` calls `createSyncApp({ now, createId })` with no floor. A new Node process starts `checkpointSeq = 0` at current `now()`.

Client `merge.ts` `isStale`: if `compareCheckpoint(incoming, last_checkpoint) <= 0`, `applyFullMerge` returns `'stale'` and **does not** upsert tables. `not_modified` is hash equality (`run-query.ts`); a hash miss still returns `ok` + a new checkpoint, which `isStale` can drop. `healNotModifiedIfDrifted` refetches without `lastHash` but still runs `applyFullMerge` with whatever checkpoint the remade allocator minted.

Sim keeps one `createSyncApp` for the world lifetime. Antithesis process kill of `api` is the remake the in-house harness declined.

## Code paths

| Path | Role |
|---|---|
| `apps/server/src/sync/sync-app.ts` `nextCheckpoint` | Isolate-local `checkpointSeq`; no `initialLast`. |
| `pkgs/sync-engine/src/shared/commit-checkpoint.ts` | Documents remake-after-forward-skew; `last + 1n` if `now()` went backwards. Product bypasses this helper. |
| `pkgs/sync-engine/src/server/create-sync-app.ts` | Default allocator is `createMonotonicCheckpoint(deps.now).next` — still no persisted floor. |
| `pkgs/sync-engine/src/queries/server/run-query.ts` | `ok` always calls `nextCheckpoint()`; `not_modified` when `lastHash` matches. |
| `pkgs/sync-engine/src/client/merge.ts` `isStale` / `applyFullMerge` | Drop merge when checkpoint ≤ stored. |
| `pkgs/sync-engine/src/client/subscription-runtime-sweep.ts` | `ok` → merge; `not_modified` → heal-by-hash then merge. |
| `pkgs/sync-engine/src/sim/server.ts` | Remake may pass `initialLast: checkpointFloor`. |

## Failure scenario

1. Alice (foreground) hydrates; `sync_engine_scope_meta.last_checkpoint` is a high epoch-shaped string (long-lived api, or a forward clock jump while the old process issued checkpoints).
2. SIGKILL / remake `api`. New process: `checkpointSeq = 0`, `now()` is the corrected (or same-ms) clock.
3. Bob writes a user-scoped row (or alice already has pending that the old process applied). Postgres has a newer body than alice’s SQLite.
4. Alice `POST /api/query` (foreground; headless `alwaysOnLifecycle`). Server returns `ok` with `${now}000001` (or similar) **below** alice’s `last_checkpoint`, or `not_modified` if hashes accidentally match a stale local hash.
5. **Bug if** after a foreground reconcile window alice’s intersecting domain still ≠ Postgres. Freeze is silent: HTTP 200, `online` may flip true on `not_modified` / `onSynced`, MQTT optional.

First topology: process faults on `api` must be enabled. A same-ms remake can stale only when remade `now()` equals the last issued prefix; wall-clock restart usually advances `now()` and does **not** freeze. Inject a **forward clock jump then remake with corrected now()** so `last_checkpoint` ≫ remade checkpoint. Two clients: bob writes after remake; alice is the frozen reader. No OPFS. Oracle is **domain rows vs server**, not `last_checkpoint` / `pushSeq` columns (`three-seq-spaces-unconflated` stays deferred for the column Always).

## What goes wrong if violated

Peers can upload after remake; the lagging client looks synced (`hasSynced`, health 200) and never paints the new rows until wall clock + seq exceeds the stored checkpoint — or never, if the operator keeps correcting the clock. User-visible “social state frozen after API restart,” not an MQTT gap (`mqtt-http-independent-fault-domains` still holds if checkpoints are monotonic).

## SUT instrumentation (all missing)

- `Always` after api remake + foreground query window: for each subscribed user-scoped table, alice’s live rows match Postgres (or bob’s post-heal snapshot of the same actor).
- `Sometimes(sync.checkpoint.remake_below_client_highwater)` — remade `ok` checkpoint `compareCheckpoint` ≤ client `last_checkpoint` while server hash ≠ local `last_hash`.
- `Sometimes(sync.checkpoint.stale_ok_dropped)` — `applyFullMerge` returned `'stale'` after a 200 `ok`.
- `Reachable` — `api` process remake with clients that already have non-null `last_checkpoint`.
- `Unreachable` — `onSynced` / `hasSynced` true because of `not_modified` while local domain ≠ Postgres for that scope.

Workload can detect freeze without SDK: after remake, bob mutates; alice’s SQLite body for that id stays pre-remake across a foreground `/api/query` 200.

## Open questions

- Will setup persist checkpoint high-water across `api` restart, or is the product `checkpointSeq = 0` path what the container runs? `(partial: product createSyncApp is checkpointSeq=0; setup Dockerfile not written)`

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### Will setup persist checkpoint high-water across `api` restart, or is the product `checkpointSeq = 0` path what the container runs?

- Examined: `apps/server/src/sync/sync-app.ts` `nextCheckpoint`; `apps/server/src/app/create-server.ts` `createSyncApp({ now, createId })`; `pkgs/sync-engine/src/shared/commit-checkpoint.ts` `initialLast`; `antithesis/scratchbook/deployment-topology.md` api container; sibling log on `three-seq-spaces-unconflated`.
- Found: product allocator is isolate-local `checkpointSeq = 0` and does not pass `initialLast`. `createServer` mounts that helper with no floor. Topology api is `createServer` (new Dockerfile, not written). No Postgres / kv high-water for query checkpoints.
- Not found: a setup adapter that persists `highWater` across process remake.
- Conclusion: tagged `(partial: product createSyncApp is checkpointSeq=0; setup Dockerfile not written)` — the in-tree product path is the remake hazard. Property tests that path; a later persist would shrink the Sometimes, not invalidate the Always (domain must still catch up).

#### Is a same-millisecond remake without clock jump enough to get `seq` reset below the old padded suffix, or must the campaign inject a forward jump?

- Examined: `formatCheckpoint` / `compareCheckpoint` (`${nowMs}${seq padded 6}` as BigInt); product `nextCheckpoint`; `merge.ts` `isStale` (`compare <= 0` drops).
- Found: same-ms remake **can** go stale: last `T000005` vs remade `T000001` (or equal `T000001`) → `isStale`. If remake’s `now()` is a **later** millisecond, `${newNow}000001` is larger than any `${oldNow}999999` because `nowMs` is the high-order digits — wall-clock process restart usually advances `now()` and does **not** freeze.
- Not found: an injected frozen `now()` on product `createServer` (it uses `env.clock.now()`).
- Conclusion: resolved — same-ms remake is enough only when remade `now()` equals the last issued prefix. A normal kill/restart is usually a later ms. Campaign should inject a **forward clock jump then remake with corrected now()** for a reliable `last_checkpoint` ≫ remade checkpoint. Property type unchanged; clock jump is the reliable trigger, not optional flavor.
