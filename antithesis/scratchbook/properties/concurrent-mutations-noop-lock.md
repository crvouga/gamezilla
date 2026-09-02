# concurrent-mutations-noop-lock

Focus: Concurrency. Confidence: high.

## Claim to test (not a fact)

Concurrent `POST /api/mutations` for the same actor (or two actors touching the same friend/space row) produce a Postgres domain state that is a **serial interleaving** of those batches. Unique `mutation_id` prevents double-apply of the *same* id; it does **not** serialize different ids. The route comments claim per-user serialization via “outer request txn + unique mutation idempotency keys” while `acquireLock` is an explicit no-op.

This is distinct from `mutation-id-first-wins-ack-applied` (same id, retry) and `lww-upload-arrival-under-partition` (partition winner). Here the hazard is **READ COMMITTED read-modify-write** on a single live origin.

## Why this property

`acquireLock` in `sync-app-mutations-route.ts` takes `_tx` / `_lockUserId` and returns immediately. Comment: no `pg_advisory_*` (not portable). `@pkgs/sql-client` `agnostic-sql.ts` **bans** `FOR UPDATE` and `pg_advisory_*` in shared SQL — there is no in-tree replacement lock.

Postgres isolation is never set (default READ COMMITTED). Two Worker isolates, or one isolate paused across the flattened nested txn, can both pass a `SELECT` that a serial replay would make the second fail.

`existing-assertions.md`: no Antithesis SDK. All suggested instrumentation is **missing**.

## Failure scenario

**A → B and B → A send friend request (different `requestId`s), overlapping:**

1. `validateSendFriendRequest` SELECTs no pending A→B and no pending B→A.
2. Both txns pass; both `INSERT INTO friends_requests` (`ON CONFLICT (id)` only — not unique on the pair + pending).
3. Serial order would reject the second with `FRIENDS_REQUEST_EXISTS`. Concurrent commits leave **two pending rows**, two outbox events, two notifications.

**Same-direction double send (two devices, two ids):** both `hasPendingRequest` false; two pending A→B rows. Serial path returns early on the second.

**joinSpace visibility TOCTOU:** `areFriends` true → concurrent `removeFriend` / `blockUser` commits → `INSERT spaces_users` still runs. Serial order would throw `SPACE_VISIBILITY_DENIED`.

**claimUsername seed:** `SELECT` username free → concurrent claim of the same candidate → one unique-constraint 23505. If that unique is **not** mapped in `constraintErrors`, the batch 500s / retries instead of a clean rejection.

Sim pin `concurrent-topic-seq-allocation-monotonic.sim.test.ts` stresses `allocateTopicPushSeq` (atomic upsert) with *different* note ids — it does **not** exercise friend-pair uniqueness or the no-op lock.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/server/sync-app-mutations-route.ts` `acquireLock` (~45–51) | Documented no-op. Called first inside `prepareMutationNotify`’s request txn. |
| `sync-app-mutations-route.ts` `asNestedTxClient` (~34–43) | `transaction: async (fn) => fn(tx)` — flattens `replayMutation`’s inner txn onto the request txn. Whole batch is one commit. |
| `pkgs/sql-client/src/agnostic-sql.ts` | Bans `FOR UPDATE` / `SKIP LOCKED` / `pg_advisory_*` — portable claim is why the lock cannot exist in shared SQL. |
| `pkgs/sync-engine/src/mutations/server/replay-mutation.ts` | Per-id `SELECT mutations_applied` then domain `run` then INSERT. Serializes *one id*, not one user. |
| `libs/friends/src/use-cases/friend-request-send/shared/send-friend-request-mutation.ts` `validateSendFriendRequest` (~102–136) | SELECT pending / reverse pending / block / friendship, then INSERT. Pair uniqueness is application-level only. |
| `libs/spaces/src/use-cases/join-space/shared/join-space-mutation.ts` (~24–57) | SELECT membership + `areFriends`, then upsert `spaces_users`. Visibility is TOCTOU vs concurrent unfriend/block. |
| `libs/profile/src/use-cases/claim-username/shared/claim-username-mutation.ts` `seedProfile` (~71–78) | SELECT taken username then INSERT. Relies on unique + mapped 23505. |
| `apps/server/src/app/create-server.ts` (~279–290) | After successful `/mutations`, `drainAndNotifyOutbox` on the same request SQL — a second concurrent mutations POST is a second session. |

## What goes wrong if violated

Two pending friend requests both directions; inbox shows a request that the product rules say cannot exist; join of a private space after unfriend; username unique 500 storm. Users see “confirmed success then contradiction” (sut-analysis product ranking).

## SUT instrumentation (all missing)

- `Reachable` — two `/mutations` txns for the same `actorId` overlapping (`sync.mutations.same_actor_overlap`).
- `Reachable` — `acquireLock` returned (always today) (`sync.mutations.lock_noop`) — search hint that the portable path ran.
- `Always` — at most one `friends_requests` row with `status='pending'` per ordered pair `(from_user_id, to_user_id)` (`friends.pending_pair_unique`).
- `Always` — if A→B and B→A pending both exist, that state was never produced by a serial replay of `mutations_applied` (`friends.no_bidirectional_pending`).
- `Always` — `spaces_users` live row for a non-public space implies friendship or host at *commit* time, not only at SELECT time (`spaces.join_visibility_at_commit`).
- `Sometimes(cond)` — overlapping same-actor batches both committed (`sync.mutations.concurrent_commit`).

## Open questions

None remaining after code investigation.

### Notes that stay in evidence (not catalog questions)

- `friends_requests` has **no** pair unique index. Concurrent A→B / B→A (or same-direction double send) can commit two pending rows. That is the property, not a hidden 23505.
- Two devices of one user share `actorId` (`myId` = `users.id`) and differ on `deviceId` / body `clientId`. The no-op lock is exactly that multi-device case.
- Unmapped `mutations_applied` 23505 aborts the **whole** flattened batch (see `mutation-id-first-wins-ack-applied`). Different-id friend/space races do not hit that unique.

## Related

- `mutation-id-first-wins-ack-applied` — same-id retry, not different-id RMW.
- `lww-upload-arrival-under-partition` — intended last commit wins on the *same* row; this property is states that serial rules forbid.
- `outbox-unlocked-double-claim` — send-friend-request writes outbox in the same txn; a forbidden double insert implies double notify.

### Investigation Log

#### Is there a unique index on `(from_user_id, to_user_id)` for pending requests that `ON CONFLICT (id)` hides?

- Examined: `libs/friends/src/shared/schema/tables.ts` `friendsRequests` / `friendsFriendships` / `friendsBlocks`; `send-friend-request-mutation.ts` `INSERT … ON CONFLICT (id) DO NOTHING`; `defineTable` uniqueIndexes emission.
- Found: `friends_requests` declares no `uniqueIndexes`. Friendships unique on `(user_low, user_high)`; blocks unique on `(blocker_id, blocked_id)`. Pair + pending uniqueness is `hasPendingRequest` SELECT only. `ON CONFLICT (id)` is the mutation’s own `requestId` PK, not the pair.
- Not found: a later migration or `uniqueIndexes` on `(from_user_id, to_user_id)` or a pending-only unique.
- Conclusion: resolved — no pair unique. Concurrent bidirectional / same-direction sends can commit two pending rows. The property stays “serial-equivalent domain rules,” not “mapped 23505 vs 500.”

#### Do two devices of one user share `actorId` but different `clientId` / `deviceId` on `/mutations`?

- Examined: `apps/server/src/sync/query-auth.ts` `resolveSessionReplayAuth`; `libs/auth/src/shared/auth/auth-context.ts` `appAuth`; `sync-app-mutations-route.ts` body `clientId`; `apps/client/src/sync/create-local-sync-engine.ts` `getClientId: () => args.auth.getDeviceId() ?? args.databaseName`.
- Found: `actorId` is session `myId` (`users.id`) — same account, both devices. `deviceId` is session device. Body `clientId` is the client-supplied device id (not used for auth). Comment: “Never trust client body for identity.”
- Not found: a per-device `actorId` or a server lock keyed by `deviceId`.
- Conclusion: resolved — yes. No-op `acquireLock(actorId)` is the multi-device same-account overlap.

#### Under Neon READ COMMITTED, does a unique 23505 on `mutations_applied` abort the entire flattened request txn?

- Examined: same path as `mutation-id-first-wins-ack-applied` (flattened `asNestedTxClient`, unmapped 23505 rethrow, `impl-pg.ts` ROLLBACK, no savepoint).
- Found: yes — the losing request rolls back all siblings in that batch. This is a **same-id** race (`mutation-id-first-wins`), not the friend-pair / join TOCTOU (those INSERTs do not hit `mutations_applied` unique unless the ids collide).
- Not found: a savepoint around per-mutation replay.
- Conclusion: resolved — abort-siblings is real and documented on the same-id property. This property’s hazard remains application-level RMW without a pair unique.
