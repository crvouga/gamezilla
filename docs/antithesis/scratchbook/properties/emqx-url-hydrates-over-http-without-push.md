# emqx-url-hydrates-over-http-without-push

Focus: Wildcard (push URL is a synced row). Confidence: high.

Existing Antithesis SDK: **missing**. All suggested assertions are new.

Distributed Coordination filed `mqtt-http-independent-fault-domains` (MQTT down / HTTP up must still converge). That note mentions the broker URL lives in `client_config` but does not assert the **boot order**: you must learn the URL over HTTP without already having MQTT, and you must not require MQTT in order to run the query that contains the URL.

## Why this property

Product MQTT is created only when a WSS URL is known:

- `createAppLocalSyncEngine` `createPubSub` returns `null` when `emqxUrlHolder.url` is empty — “Cold start / missing broker: poll-only until client_config hydrates.”
- Holder is filled from a **local SQLite** `SELECT` of `client_config` id `emqx_wss_url` at engine open, then again from `useClientConfig` → `SyncEmqxPushFromClientConfig` → `engine.ensurePush()`.
- `clientConfig` is a normal `defineQuery` session query (`POST /api/query`). The Worker materializes desired rows in `materializeClientConfigIfNeeded` on the first **non-health** request (not on `/api/health`).
- `attachPushIfConfigured`: `createPubSub() === null` is poll-only; `ensurePush` retries later.

There is no compile-time EMQX URL in the web bundle. The only production path to the broker address is a **synced domain row**.

That is a chicken-and-egg if anyone later gates session queries on push attach, or if a cold client treats “no MQTT” as “not ready to query.” Today HTTP query does not wait for push. The property pins that bootstrap so it cannot invert under faults.

A second boot hazard: health is 200 without materializing `client_config`. Origin gate opens. First `/api/query` is what writes the row. If that query is skipped because the engine thinks push is required, or because a follower tab has no `pushOptions` **and** no query owner, the URL never arrives.

## Code paths

| File | Role |
|---|---|
| `apps/client/src/sync/create-local-sync-engine.ts` `pushOptions` / `readEmqxWssUrlFromLocalDb` | `createPubSub` returns null when URL empty. Session queries include `'clientConfig'`. Only the Web Lock **owner** gets `pushOptions`. |
| `apps/client/src/sync/create-client-pubsub.ts` `readEmqxWssUrlFromLocalDb` | Live row `id = emqx_wss_url` AND `deleted_at IS NULL`. |
| `apps/client/src/providers/local-database/sync-emqx-push-from-client-config.tsx` | After hydrate, `setEmqxUrlForDatabase` + `ensurePush`. |
| `pkgs/sync-engine/src/client/attach-configured-push.ts` | null pubsub → poll-only; `ensurePush` remakes. |
| `pkgs/sync-engine/src/client/create-local-sync-engine.ts` `ensurePush` | No-op if `!state.connected`. |
| `apps/server/src/app/request-db-middleware.ts` `materializeClientConfigIfNeeded` | First non-health request; isolate latch. Health path never runs this. |
| `libs/client-config/src/use-cases/load-client-config/shared/client-config-query.ts` | Snapshot includes tombstones (`deleted_at` selected). |

## Failure scenario

1. Fresh install: local `client_config` empty. Engine connects poll-only (`createPubSub` → null).
2. Antithesis partitions MQTT (or never starts EMQX). HTTP to the API is up.
3. **Bug if** session `clientConfig` query never runs, or `waitUntilAvailable` / connect waits on push attach — URL never hydrates; client stays poll-only **and** never queries. Deadlock.
4. Query runs, materialize writes `emqx_wss_url`, snapshot merges. Solid effect calls `ensurePush`. **Bug if** `ensurePush` is never invoked after a non-null local URL (effect unmounted, follower tab, `!state.connected`).
5. Materialize fails (secrets missing) → URL stays null. That is **not** a deadlock: HTTP sync must still proceed. MQTT attach is optional. The safety is “HTTP progress without MQTT,” not “MQTT always attaches.”

Web follower: `tryAcquireSyncOwnerLease` false → no `pushOptions` at all. Followers must still receive `client_config` via the shared SQLite (owner query) or they stay URL-less. If the owner is hung-not-dead, no one hydrates the row — that is the existing Web Lock hazard applied to the broker URL.

## Invariant (checkable)

**Safety (no deadlock):** A client whose origin HTTP is reachable (a `POST /api/query` or `/api/mutations` has completed with any HTTP response, or a health probe is 2xx) must be able to complete a `clientConfig` snapshot merge **without** an MQTT `connected` status. `createPubSub` returning null must not block `connect` / session queries.

**Liveness:** After a successful `clientConfig` snapshot that contains a live `emqx_wss_url` (non-null string, `deleted_at` null), that process’s sync **owner** eventually calls `ensurePush` and `createPubSub` is invoked with a non-empty URL. If Worker desired config has a null/empty URL (secrets omitted), poll-only-forever is intended — liveness does not apply. Followers mount `SyncEmqxPushFromClientConfig` and call `ensurePush`, but without `pushOptions` that call is a no-op (`attachPushIfConfigured` returns when `push` is undefined). The owner must attach.

`Always` for the safety half (every connect-with-empty-URL that then talks HTTP). `Sometimes(cond)` for “poll-only connect then URL row appears then `ensurePush`” — a meaningful bootstrap state, not `Sometimes(true)`. `Reachable` on `createPubSub` returning null at connect.

## Suggested SUT instrumentation (all missing)

- `Always("sync.boot.query_without_mqtt")` after session query success: MQTT status may still be down/absent.
- `Always("sync.boot.null_pubsub_does_not_block_connect")` at end of `attachPushIfConfigured` when `created === null`: engine `status` is not stuck pre-connect.
- `Sometimes("sync.boot.poll_then_emqx_url")` when local `emqx_wss_url` transitions empty → non-empty via HTTP merge.
- `Sometimes("sync.boot.ensure_push_after_url")` when `ensurePush` runs and holder URL length > 0.
- `Unreachable("sync.boot.waiting_for_push_to_query_client_config")` if any wait on pubsub appears on the session-query path.

## What goes wrong if violated

Cold clients never learn the broker, stay on 30s poll, and look “online” (health) while peers’ MQTT images never arrive. Or they never query at all — social state stays empty after `paintReady` (paint does not wait for first-sync). A later “fix” that starts MQTT from a baked URL and waits for push before query would invert the bootstrap.

## Open questions

- None

## Assumptions

- Product clients mount `SyncEmqxPushFromClientConfig`. A headless Antithesis driver that never calls `ensurePush` after hydrate would false-fail the liveness half — the driver must call it or mount the effect.
- This is a production boot property, not the sim `max` fidelity skip of mesh partitions.

### Investigation Log

#### If Worker secrets omit EMQX, is poll-only-forever intended?

- Examined: `buildDesiredClientConfig` / `resolveEmqxWssUrlForClientConfig`; `EnsureClientConfigMaterialized` (`trimOrNull` upsert of `emqx_wss_url`); `ClientConfigRepository.upsert` (`deleted_at = NULL`); `create-local-sync-engine.ts` `createPubSub` empty-URL → null; `attach-configured-push.ts` (`null` is poll-only; connect still succeeds).
- Found: omitted/blank secret becomes a live row with `value: null`, not a missing row. `readEmqxWssUrlFromLocalDb` treats that as no URL. Comments call this “Cold start / missing broker: poll-only.” HTTP sync is not gated on attach.
- Not found: a path that treats a null URL as a boot failure.
- Conclusion: resolved — poll-only-forever is intended when desired URL is empty. Liveness Sometimes only when the live row is a non-empty string. SDK **missing**.

#### Does a follower tab’s useClientConfig + ensurePush run without pushOptions?

- Examined: `create-local-sync-engine.ts` (`pushOptions` only if `syncLease.isOwner`); `sync-engine-boot.tsx` mounts `SyncEmqxPushFromClientConfig` for every engine; `sync-emqx-push-from-client-config.tsx` always `engine.ensurePush()`; `create-local-sync-engine.ts` `ensurePush` → `attachPushIfConfigured`; that function returns immediately when `state.options.push` is undefined.
- Found: follower tabs still run the effect (and `setEmqxUrlForDatabase`). `ensurePush` is a no-op without `pushOptions`. Only the owner can attach MQTT.
- Not found: a follower retry that later receives `pushOptions` without remounting as owner.
- Conclusion: resolved — effect runs; attach cannot. Owner must. Property already exempted followers.

#### Can client_config.emqx_wss_url be tombstoned by LWW?

- Examined: `libs/client-config` for `defineMutation` (none); `EnsureClientConfigMaterialized` (`softDelete` only for ids **not** in `CLIENT_CONFIG_KEYS`; `emqx_wss_url` is known); `ClientConfigRepository.upsert` always clears `deleted_at`.
- Found: no client write path. Materialize never tombstones a known key. A later materialize with a URL revives via upsert `deleted_at = NULL`.
- Not found: any mutation or inbox action that sets `deleted_at` on `emqx_wss_url`.
- Conclusion: resolved — no tombstone write path. Re-`ensurePush` after revive stays out of scope.
