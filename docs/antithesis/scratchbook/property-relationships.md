---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Property Relationships

Lightweight clusters from discovery synthesis. Dominance is suspected, not proven.

## LWW merge and wipe/clobber

Properties: `lww-merge-no-wipe-clobber`, `lww-upload-arrival-under-partition`, `tombstone-sync-and-pending-revive`, `stale-push-images-after-snapshot-merge`, `mixed-schema-column-intersect-merge`, `rejected-write-still-paints-optimistic`, `own-ack-optimistic-body-no-flicker`

Notes: Same merge upsert (`merge-upsert.ts` / `applyRowImages`). Wipe/clobber is “what a single apply may not destroy.” Arrival-order is “which body wins after heal.” Tombstone/revive is LWW applied to `deleted_at`. Stale fanout is a TOCTOU that can reintroduce clobber after a good snapshot. Mixed-schema is the same upsert restricted to column intersect. Reject-paint is the writer’s optimistic body **after permanent reject** (no inbox; not post-snapshot). Own-ack flicker is the writer’s body **after applied** vs a stale snapshot/echo.

Suspected dominance: `lww-upload-arrival-under-partition` after heal implies replicas match server, which implies `lww-merge-no-wipe-clobber` for ids the server still has — **not** for omitted-key / empty-image cases, so do not drop wipe/clobber. Heal also hides reject-paint (tombstone Always is post-snapshot) — keep reject-paint. Own-ack is not dominated by arrival-order (mid-window flash can heal).

## Mutation idempotency

Properties: `mutation-id-first-wins-ack-applied`, `concurrent-mutations-noop-lock`

Notes: Same route (`acquireLock` no-op, flattened txn, unique `mutation_id`). First-wins is same-id retry. Noop-lock is **different ids** racing domain RMW.

No dominance: passing same-id idempotency does not serialize friend-request unique pairs.

## Client SQLite durability vs epoch

Properties: `memory-journal-crash-wipes-queue`, `schema-epoch-preserves-durable-queue`, `account-switch-close-then-open-sqlite`

Notes: Three different fates of `sync_engine_mutations`. web SQLite MEMORY crash may **delete the file** (queue gone — claimed); first Node topology applies MEMORY journal but fail-closes (no auto-wipe). Epoch bump must **keep** the queue when migrate/heal runs. Account switch must not **copy** A’s queue into B; the abandoned `user_<anon12>` file is left on disk.

Do not merge: a pass on epoch-preserve can still fail MEMORY-wipe (opposite intended outcomes).

## MQTT vs HTTP truth path

Properties: `mqtt-http-independent-fault-domains`, `overlapping-handle-push-seq-toc-tou`, `emqx-url-hydrates-over-http-without-push`, `outbox-processed-without-notify`

Notes: All rest on “snapshots heal; MQTT is lossy.” Overlapping handlePush is the in-process race on that lossy path. EMQX URL bootstrap is the chicken-and-egg so HTTP can run before MQTT exists. Outbox skip-notify is the server-side allocate-then-drop cousin.

Suspected dominance: `mqtt-http-independent-fault-domains` after a long enough **foreground** reconcile should cover `outbox-processed-without-notify` — `notificationsActive` is in `SESSION_QUERIES`. Background clears the 30s tick, so the quiet period is foreground-gated.

## Auth 401 classification

Properties: `upgrade-required-no-local-wipe`, `unclassified-401-defaults-expired`, `oauth-exchange-code-consumed-once`, `mutation-actor-from-session-only`

Notes: Wipe policy is a client parse of `{ error: 'auth', reason }`. Protocol-cut and malformed body are two ways to hit that parser. OAuth consume is IdP, not sync 401. Session actor is a different boundary (never trust body).

Suspected dominance: product `isAuthRevoked === reason === 'revoked'` is the shared predicate for the first two.

## Room identity vs social membership

Properties: `room-gateway-fallback-not-host`, `presence-online-matches-room-actor-id`, `sync-membership-and-room-seat-agree`, `room-command-id-applies-once`, `room-single-log-per-topic`, `room-welcome-truncation-resync`, `private-space-join-requires-acl`, `denied-scope-no-fanout-leak`

Notes: Gateway fallback can change who `x-actor-id` is; that feeds host checks **and** leave-seat vs leave-mutation disagreement. Presence is **naming**: account online iff roster actor is the account (`getRoster()` + session — no Solid UI). Room commandId/log/welcome are the event-log plane. Private join and denied fanout are the SQL/sync plane. Cross-plane: `sync-membership-and-room-seat-agree`. First topology RoomServer is memory; api kill wipes the log — presence Always is on the live roster only.

Suspected dominance: gateway-not-host is a precondition for “host checks are meaningful”; it does not imply seats match `spaces_users` or that the online bit tracks the actor. Presence does not imply host privilege.

## Isolation (tenant / device / account)

Properties: `device-private-rows-stay-local`, `multi-device-same-actor-converge`, `denied-scope-no-fanout-leak`, `account-switch-close-then-open-sqlite`

Notes: Device-private is a row filter. Multi-device adds converge. Denied-scope is authorize + leftover rows. Account-switch is file isolation.

`device-private-rows-stay-local` is likely dominated by `multi-device-same-actor-converge`’s isolation half — keep both so a converge-only check cannot hide a leaked session row that both devices “agree” on incorrectly.

## Health / origin gate

Properties: `health-ok-db-down-opens-gate`, `health-200-while-boot-fatal`

Notes: Same lying `/api/health`. DB-down vs fatal boot latch are different api states (500 vs 503 `api misconfigured`). Upload storm is the client symptom of both.

No dominance: fixing one origin-gate bug does not fix the other server status.

## Outbox drain

Properties: `outbox-handler-at-most-once`, `outbox-processed-without-notify`, `outbox-exhausted-park-not-delivered`

Notes: Safety vs liveness of the same unlocked drain, plus the **failed** park path. Cron-without-ALS is the shared mechanism for the first two. Exhausted park (`available_at` +365d, `processed_at` NULL) must not inherit processed-heal liveness.

No dominance: at-most-once success does not imply park; snapshot heal applies only after `processed_at`.

## Web tab owner (topology-blocked / deferred)

Properties: `web-sync-owner-single-uploader`

Notes: Isolated cluster. First Node topology cannot exercise it. Related in spirit to account-switch (one active engine) but different lock (`sync-owner:` vs pool `opChain`). Deferred from the first-pass catalog body.

## Auth liveness vs wipe

Properties: `upgrade-required-no-local-wipe`, `upgrade-required-retry-bounded`, `unclassified-401-defaults-expired`, `expired-token-refresh-then-drain`, `oauth-exchange-code-consumed-once`, `oauth-consume-orphan-no-client-session`

Notes: Wipe classification (safety) vs retry/drain (liveness) of the same 401 envelope. OAuth consume-once (safety) vs consume-orphan (liveness) of the same SELECT-then-DELETE. Expired-token drain is the bearer half of mqtt-http heal.

Suspected dominance: product `isAuthRevoked === reason === 'revoked'` is the shared wipe predicate. Consume-once passing does not imply the client ever stored a bearer.

## API remake vs snapshots

Properties: `api-remake-foreground-query-applies`, `mqtt-http-independent-fault-domains`

Notes: Isolate-local checkpoint allocator. User-visible freeze after `api` kill + clock jump. Domain-vs-Postgres oracle is shared with mqtt-http heal. `three-seq-spaces-unconflated` stays deferred (needs seq probes).

