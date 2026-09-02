# denied-scope-no-fanout-leak

Focus: Security Boundaries.
Existing Antithesis SDK: **missing**. Suggested assertions are new.

## Why this property

Two isolation claims that share a mechanism:

1. **Cross-tenant hydrate deny** — a query whose `authorize` fails must not snapshot another actor's rows onto the caller (`run-query.ts` returns `{ status: 'denied' }` with no tables).
2. **Denied query keeps domain rows** — `detachScope` tombstones `sync_engine_scope_meta` only; domain tables stay (`merge.ts`). Product wants offline-usable leftovers, not a wipe.
3. **Must not leak via fanout** — after deny (or never-authorized), MQTT row images / later snapshots must not **add** stranger rows. `applyRowImages` upserts whatever arrives on a subscribed topic; it only filters `device_id` ownership (`filterDeviceOwnedRows`), not tenant/`owner_id`.

Acme pin `cross-tenant-rows-never-hydrate.sim.test.ts` **turns `rowImageFanout` off** with the comment "authorize deny must not be bypassed by images." That is an explicit admission that images can skip `authorize`. Product Worker and client both set `rowImageFanout: true` (package `createSyncApp` default is false). Sim kit default is on (`!== false`).

Antithesis unique value: real EMQX + 15-minute MQTT JWT ACL (`mintPubSubToken`) that still allows `room:{spaceId}` after leave until refresh; incremental `syncTopics` vs in-flight `handlePush`; overlapping `handlePush` (SUT analysis concurrency).

## Code paths

| File | What it does |
|---|---|
| `pkgs/sync-engine/src/queries/server/run-query.ts` | Unknown name, bad params, `authorize` false/throw → `{ status: 'denied' }`. Success path runs `def.run` and returns tables. |
| `pkgs/sync-engine/src/client/subscription-runtime-sweep.ts` `handleSweepResponse` | `denied` → `detachScope`, `entry.stopped = true`. No merge of tables. |
| `pkgs/sync-engine/src/client/merge.ts` `detachScope` | Soft-deletes scope meta only. `applyRowImages` / `filterDeviceOwnedRows`: keep rows unless `device_id` is present and ≠ local device. |
| `pkgs/sync-engine/src/client/attach-push-handle.ts` `handlePush` / `tryApplyFanoutRows` | If topic still in `topicToScopes` and `pushSeq` contiguous, apply images **without re-running query authorize**. |
| `pkgs/sync-engine/src/client/attach-push.ts` `syncTopicsIncremental` | Drops topics when no active scope wants them; `wakeAll` after change. Race: message between deny and unsubscribe. |
| `pkgs/sync-engine/src/shared/partition-fanout-rows.ts` | Server splits images by topic-map (device-private off user topic). Does not stop a still-subscribed room/user topic from delivering sibling rows. |
| `apps/server/src/sync/pubsub-token-routes.ts` + `libs/pubsub/src/root/server/mint-pubsub-token.ts` | JWT ACL = `user:{actorId}` + `system:client_config` + `room:{spaceId}` for **current** membership, TTL 15 min, subscribe **and** publish. Stale JWT after leave still authorizes the broker. |
| Pins | `denied-query-detaches-scope-keeps-rows.sim.test.ts`, `mid-session-authorize-deny-keeps-domain-rows.sim.test.ts`, `membership-revoked-mid-session-scope-denied-topics-dropped.sim.test.ts`, `cross-tenant-rows-never-hydrate.sim.test.ts`. |

## Failure scenario

**Never authorized (cross-tenant):** Alice writes private notes. Bob's `notesOwned` authorize fails. HTTP snapshot is denied. If Bob is still on `user:alice` or a shared topic (mis-minted JWT, wild subscribe, or topic-map bug) and fanout is on, `handlePush` upserts Alice's rows. `filterDeviceOwnedRows` does not drop them (no `device_id`).

**Was authorized, then denied:** Bob joined a private space (friend/ACL), hydrated space notes, then **unfriended / authorize flipped** (leave-while-friends is not a deny — remint ACL still lists the host’s live room). Scope detaches; local rows stay (intended). Alice writes after the deny. If Bob’s MQTT subscription or a stale 15-minute JWT still includes `room:{spaceId}` (remint only on reconnect), images land and **new** secret rows appear next to the retained leftovers.

## Invariant (checkable)

At every quiet point (after sweep + push apply):

- Client B's live domain rows whose query `authorize(B)` would be false **and that B never successfully snapshotted** must be absent (cross-tenant never-hydrate).
- After a scope transitions to `denied` / detach: previously hydrated rows for that scope **may remain**. Rows with `updated_at` / id **created after the deny** that only that denied query would have returned must **not** appear on B (no fanout/snapshot leak).
- Device-private rows (`device_id` ≠ B) never appear on B via user-topic fanout (existing `partition-fanout-rows` + `filterDeviceOwnedRows` claim).

`Always` for the safety split (never-hydrate vs no-new-rows-after-deny). Do not use `Sometimes` for "deny happened" — that is `Reachable` on the deny/detach path so the Always is exercised.

## Suggested SUT instrumentation (all missing)

- `Always` in `tryApplyFanoutRows` after apply: every applied row is permitted by the still-active scopes' authorize (or topic-map membership). Expensive if done naively — cheaper: tag connections with `deniedScopes` and `Unreachable` if an image table intersects a just-denied query's tables.
- `Reachable` on `handleSweepResponse` denied branch.
- `Always` in `run-query.ts` denied returns: response has no `tables`.
- Workload oracle: after deny, diff B's domain ids vs server rows B is not authorized to see; new intersections fail.

## Open questions

None. SDK missing (`existing-assertions.md`).

## Assumptions

- "Leak" means **new** unauthorized rows after deny, not retention of already-hydrated leftovers (that retention is a separate claimed safety property and is in-scope as the "keeps rows" half).
- Acme `notesOwned` is the fixture analog of product space/profile queries; product topic map must be the workload's authorize oracle.

### Investigation Log

#### Product `rowImageFanout` default in `createSyncApp` / worker?

- Examined: `apps/server/src/sync/sync-app.ts`; `apps/client/src/sync/create-local-sync-engine.ts`; `pkgs/sync-engine/src/server/create-sync-app.ts`; README defaults table.
- Found: package `createSyncApp` is **opt-in false**. Product Worker sets `rowImageFanout: true`. Product client push sets `rowImageFanout: true`. Sim kit default is `!== false` (on).
- Not found: a Worker mount that leaves fanout off.
- Conclusion: resolved — product has fanout on. Property’s Always is live on the Worker, not only sim.

#### After leave, how soon is MQTT JWT reminted vs 15-minute ACL?

- Examined: `mint-pubsub-token.ts` (`TOKEN_TTL_SEC = 15 * 60`); `create-emqx-pubsub.ts` `openConnection` (calls `auth()` only on connect/reconnect); `create-client-pubsub.ts`; `leave-space-mutation.ts`; `MySpaceIdsLoader` + `actorVisibleLiveSpacesPredicateSql`; `attach-push.ts` incremental unsubscribe.
- Found: no leave-triggered remint. Fresh JWT only on MQTT connect/reconnect. Incremental unsubscribe can drop the topic from the honest client. Stale JWT still authorizes broker subscribe+publish on old `room:{id}` until expiry. Remint ACL is **current** membership **or live friendship with the host** — leave-while-friends still lists the room on the next token.
- Not found: a timer refresh or leave hook that remints before 15 min.
- Conclusion: resolved — remint is reconnect-only. 15 min stale ACL is a leak window for a client that keeps the subscription. Leave-while-friends is not a deny; unfriend/authorize-false is.

#### Does `applyRowImages` apply `user:{self}` images that include other users’ rows?

- Examined: `partition-fanout-rows.ts`; `merge.ts` `applyRowImages` / `filterDeviceOwnedRows`; product topic maps (`spaces`, `profile`, `friends`, `chess`).
- Found: partition assigns each captured row to that table’s topic-map topics. Client upserts whatever arrives on a subscribed topic; only `device_id ≠ local` is dropped. Live `spaces` rows also go to `user:{mutator}`, host user topics, `room:{id}`, and **host friends’** user topics (`hostFriendTopics`). Profile is `user:{row.id}`. Friends rows go to both parties. Chess images use `user:{ctx.actorId}` (mutator), not `owner_id`.
- Not found: a client authorize re-check on images. Mixed-table capture can put a stranger row on `user:{self}` only if the topic map names that topic for that row (friend-visible space rows are the intended case).
- Conclusion: resolved — partition is the guard; `applyRowImages` will persist stranger rows that the map placed on a subscribed topic. Friend-visible space images on `user:{self}` are not a deny leak. Never-authorized / post-unfriend room images are.
