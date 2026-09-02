# Device-private rows never land on another install

Focus: Data Integrity. Slug: `device-private-rows-stay-local`.

## Evidence trail

`spaces_open_sessions` is device-owned (`device_id`, unique `(device_id, space_id)`). Creating a space writes `spaces` + `spaces_users` (user/room wake) **and** an open-session row. Same-account peers must learn the space via live fanout but must **not** apply the writer’s open-session. A leaked row makes the tablet believe it is seated in a space it never opened (product: `use-current-space-ids` joins `spaces_open_sessions` on local `device_id` — a foreign `device_id` would still pollute the table and any unfiltered read).

Defense is layered: topic map returns **no topics** for `spaces_open_sessions`; `partitionFanoutRowsByTopic` keeps those images off sibling user/room publishes; `filterDeviceOwnedRows` drops `device_id !== env.deviceId` on **push** apply; session queries filter `WHERE device_id = env.deviceId`.

The Acme scenario comment calls this a product bug the framework must keep from recurring. Sim pins it with in-process MQTT. Antithesis uniquely: real MQTT payload mixing, optimistic + authoritative images, HTTP snapshot of a mis-scoped query, crash between partition and publish.

`existing-assertions.md`: no Antithesis SDK. All suggested assertions are **missing**.

## Code paths

**Writer / topic map**

- Product: `libs/spaces/src/public/topic-map.ts` — `spaces_open_sessions.topics()` and `fallbackTopics()` return `[]` (same shape as Acme `pkgs/sync-engine/src/tests/apps/acme/shared/topic-map.ts`).
- Product query: `libs/spaces/src/use-cases/list-open-sessions/shared/open-space-sessions-query.ts` — `WHERE device_id = ${ctx.env.deviceId}`, returns `{ spaces_open_sessions: rows }`.
- Acme: `openSpaceSessionsQuery` in `membership-query.ts` — same filter; comment points at the scenario test.
- Schema: `libs/spaces/src/shared/schema/tables.ts` `spacesOpenSessions` — `device_id`, unique `(device_id, space_id)`. Row id convention: `` `${deviceId}:${spaceId}` `` (`participation-ids.ts`).

**Fanout partition + merge filter**

- `pkgs/sync-engine/src/shared/partition-fanout-rows.ts` — each image is published only on topics the topic map assigns **that row**. Prevents device-private tables from riding a sibling table’s `user:{actor}` wake in the same mutation.
- `pkgs/sync-engine/src/client/optimistic-fanout.ts` `buildOptimisticFanout` — uses partition; comment: “device-private tables do not ride along on a sibling table's user wake.”
- `pkgs/sync-engine/src/client/merge.ts` `filterDeviceOwnedRows` — if the sample row has `device_id`, keep only `owner === deps.env.deviceId` (or non-string owner). Used **only** in `applyRowImages`, not in `applyFullMerge`.

**Pin**

- `pkgs/sync-engine/src/tests/scenarios/same-actor-open-session-stays-device-private.sim.test.ts` — phone `createSpace`; tablet has the space, zero live open-sessions, `expectNoForeignOpenSessions`.

**Readers that assume device filter**

- `libs/spaces/src/use-cases/list-open-sessions/client/use-open-space-session-ids.ts` — live UI filters `device_id = localDeviceId`.
- `libs/spaces/src/root/client/use-current-space-ids.ts` — join on `o.device_id = ${deviceId}`.

## Failure scenario

1. Phone (same `actorId`, different `deviceId`) creates/joins a space. Write capture includes `spaces`, `spaces_users`, `spaces_open_sessions`.
2. MQTT publishes a combined payload on `user:{actor}` that still includes the open-session image (topic-map or partition bug, or a stale client).
3. Tablet `applyRowImages` without filter (or `applyFullMerge` of a snapshot whose query omitted the `device_id` predicate).
4. Optimistic `pushSeq: '0'` images skip the contiguous seq check (`tryApplyOptimisticRows` returns early) — a second path besides authoritative fanout.
5. Process kill after publish accept, before tablet filter runs; retry/replay of the same payload.

Violation: tablet SQLite contains a `spaces_open_sessions` row with `device_id` ≠ tablet `deviceId` and `deleted_at IS NULL` that this install did not write locally.

## Key observations

- `filterDeviceOwnedRows` is **push-only**. HTTP `applyFullMerge` will upsert whatever the snapshot query returns. Integrity for hydrate depends on every `defineQuery` that includes this table filtering `device_id`. A widened “user dump” query would bypass the MQTT defenses.
- Product mutation fanout (`prepareMutationNotify`) calls the same `partitionFanoutRowsByTopic` as `buildOptimisticFanout` when `topicMap` is set. `spaces_open_sessions.topics()` / `fallbackTopics()` return `[]` (`libs/spaces/src/public/topic-map.ts`). `notifyChannels` itself does not partition; OOB `notifyUserChannels` / outbox-drain publish **no row images** (topics + optional `tables` only).
- Empty topic map is necessary but not sufficient if partition is skipped (`topicMap === undefined` → `buildOptimisticFanout` returns `[]`; mutation route then publishes unpartitioned `rows` on every topic). Receiver-side `filterDeviceOwnedRows` remains the MQTT backstop.
- Optimistic apply does not require contiguous `pushSeq`. A leaked optimistic image is enough.
- Foreign **tombstones** (`deleted_at` set) for another device’s session are also device-private; the filter should drop those too (it filters on `device_id`, not liveness).
- Product synced `defineTable` with a `device_id` column is only `spaces_open_sessions`. `auth_devices` has no `device_id` column (id is the device). The generic filter is unused on other product tables today.
- The only `defineQuery` that returns `spaces_open_sessions` is `openSpaceSessions` (`WHERE device_id = ${ctx.env.deviceId}`). Client joins (`use-current-space-ids`) are live SQLite reads, not snapshot hydrates.
- Local mutations write `env.deviceId` (`openSession`). A local foreign `device_id` would be a mutation-authoring bug, not this isolation property. Catalog Property already scopes to rows that **arrived via merge or push**.

## Open questions

None remaining after the investigation below.

## Instrumentation status

All missing (`existing-assertions.md`: no Antithesis SDK).

Suggested (do not exist today):

- `Always` — for each client DB, every live `spaces_open_sessions` row has `device_id` equal to that engine’s `env.deviceId`, unless the row’s id was inserted by a local mutation on this device.
- `AlwaysOrUnreachable` — if `filterDeviceOwnedRows` ran, every dropped row had `device_id` ≠ local device.
- `Reachable` — a mutation write-capture includes both a user-wake table and `spaces_open_sessions` in one batch (the dangerous sibling-fanout shape).
- `Unreachable` — `applyRowImages` / `applyFullMerge` upserts a `spaces_open_sessions` row whose `device_id` ≠ `env.deviceId`.

### Investigation Log

#### Does server-side `notifyChannels` / `select-fanout-rows` use the same `partitionFanoutRowsByTopic` as optimistic client publish?

- Examined: `sync-app-mutations-route.ts` `prepareMutationNotify` / `publishMutationPushes`; `optimistic-fanout.ts` `buildOptimisticFanout`; `notify-channels.ts`; `apps/server/src/sync/notify-user-channels.ts`; `outbox-drain.ts`.
- Found: mutation replay partitions with `partitionFanoutRowsByTopic` when `topicMap` is set (product registers `appTopicMap`). If `topicMap` is missing, `rows` (not `rowsByTopic`) go on every allocated topic. `notifyChannels` only allocates seqs and publishes. OOB user/outbox notifies pass topics ± `tables`, no `rows`.
- Not found: an OOB path that SELECTs `spaces_open_sessions` images onto `user:{actor}`.
- Conclusion: resolved — server mutation fanout matches client partition when the topic map is present. Receiver filter is still the backstop if unpartitioned `rows` are published.

#### Are there other `device_id` tables besides `spaces_open_sessions`?

- Examined: `libs/*/src/shared/schema/tables.ts` (`spacesOpenSessions`, `authDevices`, friends/profile/chess/notifications/client-config); filter `'device_id' in sample` in `merge.ts`.
- Found: the only product synced table with a `device_id` column is `spaces_open_sessions`. `auth_devices` stores platform/user metadata; no `device_id` column. Acme fixture mirrors the same table.
- Not found: another domain table whose snapshot/fanout rows include `device_id`.
- Conclusion: resolved — this property stays on `spaces_open_sessions`. The generic filter would apply if a later table added that column; no extra catalog slug today.

#### Can `applyFullMerge` of `openSpaceSessions` ever include another device’s rows?

- Examined: `open-space-sessions-query.ts`; other `defineQuery` return shapes; `applyFullMerge` (no `filterDeviceOwnedRows`).
- Found: `openSpaceSessions` is the only defineQuery that returns `{ spaces_open_sessions: rows }` and it filters `device_id = ctx.env.deviceId`. Other `spaces_open_sessions` SQL is client `useQuery` (already-local).
- Not found: a session query that `SELECT *` joins this table into a snapshot without the predicate.
- Conclusion: resolved — current HTTP hydrate should not include foreign rows. Property still covers `applyFullMerge` because that is the wipe surface if a query is widened. Unreachable on HTTP upsert of a foreign `device_id` remains the right assertion.

#### Should a locally written foreign `device_id` be treated as a violation?

- Examined: `space-mutation-helpers.ts` `openSession` / `closeSession` (bind `env.deviceId`); catalog Property text (“arrived via merge or push”).
- Found: product writes the local device. Wrap would capture a buggy INSERT of another `device_id` into this install’s SQLite; topic map returns `[]` so it should not fan out.
- Not found: a product mutation that writes a foreign `device_id` by design.
- Conclusion: resolved — only merge/push arrivals are this property. A local foreign write is a different authoring bug; the Always already exempts “unless this device wrote it.”
