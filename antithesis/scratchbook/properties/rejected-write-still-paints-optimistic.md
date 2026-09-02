# rejected-write-still-paints-optimistic

Focus: Data Integrity + Wildcard (product-shaped confirmed-then-contradicted). Confidence: high.

Existing Antithesis SDK: **missing**. All suggested assertions are new.

Fills coverage-balance F10 / wildcard A2. Distinct from `tombstone-sync-and-pending-revive` (reject does not revert domain; next snapshot does) and from `mutation-id-first-wins-ack-applied` (applied vs duplicate). This card is the **painted-success window**: local `mutate()` returned `ok: true`, the server later stored a permanent reject, and product has **no inbox**.

## Why this property

`createMutationClient.mutate` applies domain SQL and inserts `sync_engine_mutations` in one local txn, then returns `{ ok: true, mutationId }`. That is the only product success signal. Upload is async.

On a `rejected` verdict, `applyUploadResult` inserts `sync_engine_write_rejections` and soft-deletes the queue row. It does **not** rewrite domain. `clearOptimisticRowsForMutation` runs only on `applied`. README: “Domain optimistic rows are not auto-reverted on reject alone — the next successful merge without a pending rebase restores server truth.”

Framework surfaces exist (`listUnackedWriteRejections`, `acknowledgeWriteRejectionMutation`, `mutationStatus`). Grep under `libs/` finds **no** product hook, screen, or modal that reads them. `useMutationButton` / `MutationModal` complete on the local `ok`. After reject, the live `deleted_at IS NULL` row is still the optimistic body.

Acme pins (`pending-reject-surfaces-write-rejections`, `permanent-reject-stored-peer-never-applies`) wait for a peer bump + `assertConverged` before asserting domain rollback. They prove the framework table and the heal, not the product lie in between. `not_modified` (no hash change) can skip the confirming snapshot entirely.

Product mutations that throw `MutationError` on **server** replay after a local apply: `USERNAME_TAKEN` (concurrent claim), `SPACE_VISIBILITY_DENIED` (join after unfriend), `FRIENDS_BLOCKED` / uniqueness, `SPACE_HOST_REQUIRED`. Local ACL can look fine on a stale SQLite.

## Code paths

| File | Role |
|---|---|
| `pkgs/sync-engine/src/mutations/client/create-mutation-client.ts` | Local apply + queue → `{ ok: true, mutationId }`. |
| `pkgs/sync-engine/src/client/mutation-upload-queue.ts` `applyUploadResult` / `storeRejection` | Reject: write_rejections + soft-delete queue; no domain revert. Ack fence only if any verdict is `applied`. |
| `pkgs/sync-engine/src/mutations/client/mutation-status.ts` | `rejected` iff write_rejections row; unused by product UI. |
| `pkgs/sync-engine/src/mutations/shared/acknowledge-write-rejection.ts` | Framework ack mutation; no `libs/` caller. |
| `libs/profile/.../claim-username-mutation.ts` | Server `USERNAME_TAKEN`. |
| `libs/spaces/.../join-space-mutation.ts` | Server `SPACE_VISIBILITY_DENIED` after ACL change. |
| `pkgs/sync-engine/src/tests/scenarios/pending-reject-surfaces-write-rejections.sim.test.ts` | Oracle for reject-then-heal, not painted-success. |

`existing-assertions.md`: no Antithesis SDK.

## Failure scenario

1. Alice `mutate(joinSpace)` or `claimUsername` while offline or racing Bob. Local txn succeeds; UI / live query paints the optimistic row.
2. Server replay throws `MutationError`. Wire verdict `rejected`. Alice stores write_rejections and drops the queue row.
3. No product inbox. Live SQLite still has the optimistic `spaces_users` / `profile.username`.
4. Confirming snapshot may wait for 30s foreground reconcile, a peer hash bump (`not_modified` otherwise), or never if the client is backgrounded.
5. **Violation:** `mutationStatus(id) === 'rejected'` (or unacked write_rejections for that id) **and** the writer’s live intersecting columns still equal the optimistic args **and** those columns differ from Postgres for that id.

Do not wait for heal to fire the Always — heal is `tombstone-sync-and-pending-revive`. This Always is the post-reject, pre-heal (or never-heal) window.

## Invariant

- `Always` after a `rejected` verdict is applied locally (queue row gone): the writer’s live domain row for that write set must not remain the optimistic body while the server row differs. Equivalently: painted live columns match Postgres **or** the optimistic body is no longer what a `deleted_at IS NULL` read returns.
- `Reachable`: permanent reject with `listUnackedWriteRejections` non-empty and no product observer (framework-only).
- `Sometimes(reject.not_modified_leaves_paint)`: reject + `not_modified` while a sweep has not completed `healNotModifiedIfDrifted` (background / partitioned `/api/query`). A completed heal refetch overwrites paint even with no peer hash bump.
- `Unreachable` is the wrong type for the current product — the painted window is the designed reject path plus a missing inbox. The Always above is the user-visible contract to test.

## Antithesis angle

Two clients, real HTTP. Concurrent `claimUsername` same handle, or `removeFriend` ∥ `joinSpace` on a private space. Partition Alice from `POST /api/query` after the reject 200 so no confirming snapshot. Background the client (30s tick pauses). First topology: Node API + Postgres + EMQX + 2 SQLite clients — no UI required; oracle is Alice’s SQLite vs Postgres (or workload `POST /api/query` as a third session).

## What goes wrong

User sees join / username / friend action succeed, then later (or never) the row disappears. No rejection inbox. Same “confirmed success then contradiction” class as leave-but-seated, but on the sync plane.

## Suggested SUT instrumentation (all missing)

- `Always("sync.reject.writer_live_matches_server_or_unpainted")` after `storeRejection` once a later merge could have run — prefer workload sample of live columns vs server.
- `Reachable("sync.reject.stored_no_domain_revert")` at the end of the reject txn (queue gone, domain still optimistic).
- `Sometimes("sync.reject.not_modified_after_reject")`.

## Open questions

None.

SDK (`existing-assertions.md`): **missing**. Suggested assertions remain new.

### Investigation Log

#### Which product mutations can the first-topology workload force into a server-only `MutationError` after a successful local apply?

- Examined: `libs/**` `throw new MutationError` in mutation defs; `claim-username-mutation.ts` (`requiresOnline: true`); `join-space-mutation.ts`; `send-friend-request-mutation.ts`; `space-mutation-helpers.ts` `requireHost`; two-client first topology.
- Found: first-topology **without extra seed**: (1) concurrent `claimUsername` same handle — both local applies (must be online; `requiresOnline`), server second is `USERNAME_TAKEN`; (2) `removeFriend` ∥ `joinSpace` on a private space — Alice’s SQLite still friends, server `SPACE_VISIBILITY_DENIED`; (3) `sendFriendRequest` after Bob’s block landed on Postgres but not Alice — `FRIENDS_BLOCKED`; (4) host-only mutations (`setVisibility` / `endSpace` / `renameSpace` / add-remove user) if Alice’s local `spaces` host row is stale vs Postgres — `SPACE_HOST_REQUIRED`; (5) `joinSpace` after host `endSpace` applied on server only — `SPACE_ENDED`.
- Not found: a product mutation that throws only on server for a reason that cannot be arranged with alice/bob + partition. Validation (`USERNAME_EMPTY`, etc.) fails locally too.
- Conclusion: resolved — the obvious pair is enough; (3)–(5) are also reachable with two clients and a stale snapshot. No extra seed required.

#### Can `not_modified` after reject leave the optimistic body for the rest of a timeline if no other writer bumps the scope hash?

- Examined: `run-query.ts` `lastHash === hash` → `not_modified`; `subscription-runtime-sweep.ts` `healNotModifiedIfDrifted`; `applyFullMerge` / `isStale`; reject path (no domain revert).
- Found: reject does not change Postgres, so server hash can still match the client’s stored `last_hash` → `not_modified`. Heal then computes **local** hash; optimistic rows make `localHash !== last_hash`, so it refetches without `lastHash` and `applyFullMerge`. A later sweep **should** overwrite paint unless: no sweep (background / 30s tick paused), `last_hash` null, query registry miss, refetch not `ok`, or heal merge `isStale`.
- Not found: a path that treats `not_modified` as terminal while local hash drifted and a sweep ran to completion.
- Conclusion: resolved — `not_modified` does **not** permanently leave paint if a later sweep completes heal. `Sometimes(reject.not_modified_leaves_paint)` is the pre-heal / skipped-sweep window (partition `/api/query`, background). Always stays the post-reject, pre-heal (or never-heal) window. Not invalidated.

#### Does any uncommitted product screen start reading `listRejections`?

- Examined: grep `listRejections` / `listUnackedWriteRejections` / `acknowledgeWriteRejection` / `mutationStatus` under `libs/` and `apps/`.
- Found: callers are framework (`create-local-sync-engine.ts`, `sync-engine-context.tsx`), acme tests, and sim. `libs/` has only a hard-cutover drop of a legacy `write_rejections` table name. Profile handle screen switches on `USERNAME_TAKEN` from the **local** mutate result, not the upload reject table.
- Not found: a product hook, screen, or modal that reads `listRejections`.
- Conclusion: resolved — “no inbox” still holds in this tree.

## Assumptions

- First topology is headless `createClient`; “UI” means live `deleted_at IS NULL` domain reads the product hooks would paint.
- Rejected ids are not re-queued (`applyUploadResult` soft-deletes the queue). Re-queue would be a different bug (`mutation-id` / upload loop).
- SDK missing; checks are workload-visible on client SQLite + server row.
