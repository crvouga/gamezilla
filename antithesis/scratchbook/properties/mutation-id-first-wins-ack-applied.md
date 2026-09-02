# mutation-id-first-wins-ack-applied

Focus: Idempotency and Replay.

## Property (catalog draft)

A `mutation_id` is applied at most once. A later `POST /api/mutations` with the same id — including different `args` / `seq` — must not re-run domain SQL, and the wire verdict must be `applied` (not a distinct `duplicate` status).

## What led here

SUT analysis A8 and the sync safety claims: replay is idempotent by mutation id, including crash-after-accept. The batch processor explicitly maps both `applied` and `duplicate` replay outcomes to the same client-visible `applied` ack.

This is the server half of at-least-once upload. Clients re-POST the durable `sync_engine_mutations` queue after lost HTTP, `uploadQueue.stop()` orphaning an in-flight POST, or a hostile replay of an already-acked id.

## Code paths

- `pkgs/sync-engine/src/mutations/server/replay-mutation.ts`
  - `replayMutation` opens a txn, `SELECT 1 FROM sync_engine_mutations_applied WHERE mutation_id = $id AND deleted_at IS NULL`, returns `{ status: 'duplicate' }` if any row exists.
  - Fresh ids run `mutation.run` then `INSERT INTO sync_engine_mutations_applied` with `status = 'applied'`.
  - Permanent failures also insert an applied row with `status = 'rejected'` so a retry does not re-execute.
  - Dedup is **id-only**. Args, `client_id`, and `seq` are not compared.
- `pkgs/sync-engine/src/mutations/server/process-mutations-batch.ts` (~91)
  - Comment: `applied + duplicate both ack as applied (idempotent retry).`
  - `duplicate` is omitted from `result.applied`, so a retry must not allocate a new `pushSeq` / republish.
- `pkgs/sync-engine/src/shared/schema/tables.ts`
  - `sync_engine_mutations_applied.uniqueIndexes: ['mutation_id']`; PK `id = mutation_id` via `mutationAppliedId`.
- `pkgs/sync-engine/src/server/sync-app-mutations-route.ts`
  - `acquireLock` is a documented no-op. Comment: serialization is “outer request txn + unique mutation idempotency keys.”
  - `asNestedTxClient` flattens `replayMutation`’s inner `transaction` onto the request txn.
- `pkgs/sync-engine/src/mutations/server/map-constraint-error.ts`
  - Maps Postgres `23505` only when the **domain mutation** declares `constraintErrors` for that index name. The framework unique on `mutations_applied.mutation_id` is not mapped to `duplicate`.

## Existing pins (sim, not Antithesis)

- `duplicate-mutation-id-different-args-first-wins.sim.test.ts` — sequential hostile re-POST of the same id with a different body: wire `applied`, server/peer note stays first body.
- `crash-after-post-before-ack-retry-idempotent.sim.test.ts` — client crash after accept; restart re-drains; one domain row.
- `reupload-idempotent-no-duplicate-rows.sim.test.ts` — reconnect after offline set does not duplicate rows.

## Failure if violated

A retry or hostile replay would apply a second domain write (wrong LWW winner, double increment, revived tombstone). A retry that returned a non-`applied` verdict would leave the client queue stuck. A concurrent same-id pair that both passed the `SELECT` and both committed domain SQL would break first-wins even if the unique insert later failed on one side.

## Antithesis angle

- Kill / drop the response after the request txn commits (`mutations_applied` inserted) and force the client to re-POST the same id.
- Concurrent `POST /mutations` of the same id with **different args** (two isolates, READ COMMITTED, no advisory lock).
- Replay a rejected id and confirm it stays rejected and does not run `mutation.run`.

## Instrumentation

No Antithesis SDK in tree (`existing-assertions.md`). Missing SUT-side assertions:

- `Always`: after replay, `COUNT(*)` of live `sync_engine_mutations_applied` rows for that `mutation_id` is 1.
- `Always`: if the id was already `applied`, domain row images equal the first apply (args of the retry ignored).
- `Always`: HTTP verdict for a seen id is `applied` (or `rejected` if the stored status is `rejected`).
- `Reachable`: `replayMutation` returned `duplicate` (the retry path actually fired).

Sim already has `permanent-vs-transient-verdicts` / seq pins; those are in-process oracles, not SDK.

## Open questions

None remaining after code investigation.

### Notes that stay in evidence (not catalog questions)

- Concurrent same-id: the unique index should abort the loser’s **entire** flattened request txn (unmapped `23505` rethrows; `asNestedTxClient` has no savepoint). Sibling mutations already replayed in that same batch roll back with the loser. The client retries the batch; after the winner commits, the `SELECT` returns `duplicate` → wire `applied`. That concurrent window is the interesting Antithesis case, not an ambiguity in the invariant.
- “First wins” under concurrency is first-to-**commit**, which matches the system’s “LWW by upload arrival” claim.
- `pruneMutationArtifacts` is sim-only today (`pkgs/sync-engine/src/sim/server.ts`). It only soft-deletes acknowledged `sync_engine_write_rejections`. Production `apps/server` never calls it. The “post-prune retry” angle is a future caller / sim pin, not a live Worker path.

### Investigation Log

#### Are `args` compared when the id is already in `mutations_applied`?

- Examined: `replay-mutation.ts` seen-check (id + `deleted_at IS NULL` only); `process-mutations-batch.ts` ack mapping; `duplicate-mutation-id-different-args-first-wins.sim.test.ts`.
- Found: no args/seq compare. Hostile different body still acks `applied` and keeps the first body.
- Not found: any “args mismatch → reject” path.
- Conclusion: resolved — first id wins; later args are ignored.

#### Does a concurrent unique violation surface as `duplicate` or as a 500?

- Examined: `map-constraint-error.ts`, `replay-mutation.ts` catch, `acquireLock` no-op, schema `uniqueIndexes: ['mutation_id']`.
- Found: `23505` maps only via the mutation’s `constraintErrors`. Framework unique name is not in that map, so the exception rethrows (retryable infra). After the winner commits, a later POST hits the `SELECT` and returns `duplicate` → wire `applied`.
- Not found: a test that races two POSTs of the same id on real Postgres.
- Conclusion: resolved for the property statement. Concurrent race is an Antithesis target, not an open definition question.

#### Does a unique-violation on a raced retry abort sibling items in the same batch?

- Examined: `sync-app-mutations-route.ts` `asNestedTxClient` + `prepareMutationNotify` outer `db.transaction`; `process-mutations-batch.ts` loop; `replay-mutation.ts` catch; `impl-pg.ts` `BEGIN`/`ROLLBACK` (no savepoint); `map-constraint-error.ts`.
- Found: inner `replayMutation` `transaction()` is flattened to `fn(tx)`. Unmapped `23505` on `mutations_applied.mutation_id` rethrows. `processMutationsBatch` does not catch infra errors. The outer request txn rolls back — every sibling already applied in that batch is undone. Postgres would also mark the txn aborted, so later items in the same loop cannot commit even if the throw were swallowed.
- Not found: `SAVEPOINT` / nested real txn on the mutations path; a product test that races two batches on real Postgres.
- Conclusion: resolved — yes, the losing request’s whole batch aborts. At-most-once still holds (winner committed, loser rolled back). Workload must treat a raced mixed batch as all-or-nothing for the loser.

#### Is `pruneMutationArtifacts` called from production, or sim-only?

- Examined: ripgrep of `pruneMutationArtifacts` / `prune-mutation-artifacts`; `apps/server`; `pkgs/sync-engine/src/sim/server.ts`; `prune-mutation-artifacts.ts` body.
- Found: sole runtime caller is the sim server. Public re-export from `@pkgs/sync-engine/server` and `test`. The function `UPDATE`s acknowledged `write_rejections` only — comment says applied ids are retained so late retries cannot double-apply. No `apps/server` call site.
- Not found: a Worker cron / outbox consumer that prunes artifacts.
- Conclusion: resolved — sim-only today. Instrumentation about prune remains missing (`existing-assertions.md`). Drop “post-prune retry” from the production invariant wording; keep the function’s “never delete applied rows” as a pin if a caller is added.

## Synthesis merge (orchestrator)

Also covers: `crash-after-apply-before-ack`, `applied-mutation-ids-never-pruned`, `mutations-applied-survives-prune-and-lost-ack`, `upload-stop-orphans-inflight`.

Same invariant: a recorded `mutation_id` is applied at most once; lost HTTP ack, Worker isolate death mid-response, `stop()` orphan, and prune of artifacts must not re-run domain SQL. `pruneMutationArtifacts` must never delete `sync_engine_mutations_applied`. Instrumentation: all missing.
