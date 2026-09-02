# multi-device-same-actor-converge

Focus: Distributed Coordination. Same `actorId` / `users.id`, two (or more)
devices with distinct `deviceId` / sync `clientId` and distinct local SQLite
files (`user_<first12HexOfUsersId>` is per-user, but each install has its own
file). This is multi-replica coordination without a membership protocol.

## Why this property

Same-account fanout is a documented hotspot: empty profile fanout blanking a
peer username; device-private `spaces_open_sessions` leaking across devices;
`not_modified` clobbering pending (`sut-analysis` bugs). Those pins live in
`@pkgs/sync-engine` Acme fixtures, not `@libs/profile`.

User-scoped rows must converge after partition/heal (LWW on the server).
Device-owned rows must **not** appear as live state on the other install,
even if they ride a `user:{id}` MQTT topic.

## Code paths

| Path | Role |
|---|---|
| `pkgs/sync-engine/src/client/merge.ts` `filterDeviceOwnedRows` | Drop peer-install rows whose `device_id` ≠ local `env.deviceId` (lines 204–218). Applied on snapshot and row-image merge. |
| `pkgs/sync-engine/src/client/attach-push.ts` | Special-cases `spaces_open_sessions` table presence on push (around line 260). |
| `pkgs/sync-engine/src/tests/apps/acme/shared/membership-query.ts` | Open-session query is `WHERE device_id = ${env.deviceId}`. |
| `pkgs/sync-engine/src/tests/apps/acme/assert.ts` | Helpers that fail if a foreign `device_id` is live locally. |
| `pkgs/sync-engine/src/tests/scenarios/same-actor-empty-profile-fanout-does-not-wipe-peer.sim.test.ts` | Same-account peer must keep assigned username. |
| `pkgs/sync-engine/src/tests/unit/fallback-topics-actor-wake.test.ts` | `spaces_open_sessions` touch without images stays device-private. |
| `apps/client/src/sync/create-local-sync-engine.ts` | `getClientId: () => auth.getDeviceId() ?? databaseName`. |

Room `clientId` is a **per-tab UUID**, not the sync device id
(`apps/server/src/room/route.ts`). Do not use room clientId as the
device-replica key.

## Failure scenario

1. Device A and device B signed in as the same user.
2. Partition A from the API; B creates/renames a space, patches profile,
   opens a session (`spaces_open_sessions` for B).
3. Heal HTTP (MQTT optional). A refetches / receives fanout.
4. **Bug if** A never sees B’s user-scoped writes after heal+reconcile
   (liveness of multi-replica sync).
5. **Bug if** A’s local SQLite contains B’s `spaces_open_sessions` row as
   a live (`deleted_at IS NULL`) session, or A’s UI treats B’s device as
   this install (`sut-analysis` wipe/clobber cluster).
6. **Bug if** empty `ensureProfile` fanout blanks B’s username on A (or
   vice versa) — `dropRegressiveProfileImages` in `attach-push-handle.ts`
   is the MQTT-path guard; HTTP snapshot merge must not regress either.

Account-switch (A’s pending must not appear in B’s DB) is a related
isolation property; this file is **same actor, two devices**.

## Partition / heal instrumentation (SUT)

All **missing**:

- Tag every client with `actorId` + `deviceId` + `db_path`.
- `Sometimes("sync.multidevice.partitioned_divergence")` when two devices
  of the same actor disagree on a user-scoped row mid-fault.
- `Always("sync.multidevice.user_rows_match_after_http_heal")` after HTTP
  heal + foreground refetch: user-scoped tables (`profile`, `spaces`,
  friends, …) match server for both devices.
- `Always("sync.multidevice.device_private_not_leaked")` — for each
  device, no live `spaces_open_sessions` row owned by a foreign
  `device_id`. That is the only product `defineTable` with a `device_id`
  column (`libs/spaces`). The merge filter is still structural (any
  image whose sample row has a `device_id` key).
- `Sometimes("sync.multidevice.foreign_device_row_on_wire")` if a snapshot
  or push **includes** a foreign `device_id` row (Reachable is useful:
  the filter must run). `AlwaysOrUnreachable` on “filter dropped it.”

Heal signal is HTTP reachability + a completed `POST /api/query` (or
reconcile tick), not MQTT session resume. Partition A from API while B
stays connected is the interesting schedule.

## Existing assertions

Acme sim pins and `filterDeviceOwnedRows` are oracles to port. **Missing**
as Antithesis SDK. DST `assertConverged` typically compares domain match
after heal but is harness-only.

## Key observations

- Same-account replicas share one MQTT ACL topic `user:{id}`. Device
  privacy is a **client merge filter**, not a broker ACL.
- Two hashers (`hashRoomState` vs `canonicalJson`) are a room-vs-sync
  issue; this property is sync-plane only.
- `SCHEMA_EPOCH` wipe must not drop `sync_engine_mutations` (durable
  queue). A device that crashes mid-heal still owes an upload.
- Product HTTP `openSpaceSessions` is already `WHERE device_id =
  env.deviceId` (tombstones of **this** device only). Foreign live
  sessions are not on that snapshot wire. `filterDeviceOwnedRows` runs
  only in `applyRowImages` (MQTT), not `applyFullMerge`. Always still
  inspects SQLite after merge because fanout is the leak path.

## Open questions

- None

### Investigation Log

#### Which product tables besides spaces_open_sessions carry device_id?

- Examined: `libs/**/schema/**` for `device_id`; `libs/spaces/src/shared/schema/tables.ts`; `libs/auth` (no `device_id` column); `merge.ts` `filterDeviceOwnedRows`; Acme fixture schema (test-only).
- Found: the only product table is `spaces_open_sessions`. The filter keeps a row when `device_id` is absent as a key, or is a non-string, or equals `env.deviceId`.
- Not found: another synced domain table with that column.
- Conclusion: resolved — Always names `spaces_open_sessions`. Structural filter remains a footgun for a future table; that is an assumption, not an open SUT question. SDK **missing**.

#### Does the HTTP membership snapshot still select other devices’ open sessions?

- Examined: `open-space-sessions-query.ts`; Acme `membership-query.ts`; `use-open-space-session-ids.ts` / `use-current-space-ids.ts` (UI also filters local `device_id`); `applyFullMerge` vs `applyRowImages`.
- Found: product (and Acme) query is `WHERE device_id = ${ctx.env.deviceId}` and selects `deleted_at` for that device’s rows only. `applyFullMerge` does not run `filterDeviceOwnedRows`.
- Not found: a product snapshot query that returns foreign-device open sessions.
- Conclusion: resolved — HTTP wire is already device-scoped. Always still checks local SQLite after merge because MQTT `applyRowImages` can carry a foreign image (see `device-private-rows-stay-local`).
