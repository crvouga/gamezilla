---
sut_path: /Users/chrisvouga/gamezilla
commit: ddde94db466ae77df20385c54ead0c79ae20b2c8
updated: 2026-09-01
external_references: []
---

# Deployment Topology

Minimal useful topology for the first Antithesis campaign. Every extra container is justified below. Cloudflare Workers / Durable Objects / Neon / Railway EMQX / B2 are **not** in the VM — use the isomorphic Node composition plus protocol-compatible sidecars.

## Principle

The in-house sim already covers in-process mesh + virtual clock. Antithesis only pays off if **HTTP, MQTT, Postgres, and client SQLite are separate fault domains**. Putting API + EMQX + Postgres in one container would hide the properties this catalog cares about.

Room play uses an in-process `RoomServer` behind the API's `/api/room` gateway (same process as production's HTTP upgrade, without a second Worker). A dual-room-process variant is deferred (`room-single-log-per-topic` split-brain).

## Diagram

```text
                    +------------------+
                    | workload         |
                    | (test template)  |
                    +--------+---------+
                             | HTTP to clients + API
           +-----------------+-----------------+
           v                                   v
 +------------------+                 +------------------+
 | client-alice     |                 | client-bob       |
 | SQLite + MQTT    |                 | SQLite + MQTT    |
 +--------+---------+                 +--------+---------+
          | HTTP / WS                          |
          +----------------+-------------------+
                           v
                  +------------------+
                  | api              |
                  | Hono createServer|
                  | + RoomServer     |
                  +---+----------+---+
                      |          |
           SQL        |          | HTTP publish
                      v          v
             +------------+   +--------+
             | postgres   |   | emqx   |
             +------------+   +--------+
                                   ^
                                   | MQTT WSS
                     client-alice -+
                     client-bob ---+
```

## Containers

| Name | Role | Image | What it runs | Replicas | Network |
|---|---|---|---|---|---|
| `postgres` | dependency | official `postgres:16` | Product server SQL (appSchema + IdP + sync-engine + outbox). | 1 | api only |
| `emqx` | dependency | official `emqx` | MQTT 5 broker. HTTP API for Worker-style publish. WSS for clients. | 1 | api (publish), clients (subscribe) |
| `api` | service | **new Dockerfile** (Node/Bun + `createServer`) | Isomorphic Hono from `apps/server` composition, listening on TCP (not Wrangler). In-process `createRoomServer` for `/api/room`. Fake Google / oauth-dev. No Stripe/TTS/LLM (503). | 1 | postgres, emqx, clients, workload |
| `client-alice` | service | **new Dockerfile** (Node + better-sqlite3 or bun:sqlite) | Headless `createClient` / sync-engine + RoomClient. One identity SQLite file. MQTT subscriber. | 1 | api, emqx, workload |
| `client-bob` | service | same image as alice | Second device / second account. Required for LWW, device-private, multi-device, friends. | 1 | api, emqx, workload |
| `workload` | client | **new Dockerfile** with JS SDK | Test template at `/opt/antithesis/test/v1/gamezilla/`. Drives both clients + probes API. Emits `setup_complete` then idles. | 1 | api, both clients |

No MinIO / S3: TTS and object-store are out of first-pass properties. API boots with in-memory object store.

No separate room container: gateway-auth and commandId properties still run; independent room kill is deferred.

No third client: two is enough for same-actor and friend-pair. Add a third only if a later property needs it.

## Why not fewer

| Temptation | Why it fails |
|---|---|
| In-process pubsub (sim default) | Hides `mqtt-http-independent-fault-domains`, `overlapping-handle-push-seq-toc-tou`, `emqx-url-hydrates-over-http-without-push`. |
| One client | Hides LWW, device-private, friends ACL, account-switch. |
| Skip Postgres (sqlite-mem server) | Hides READ COMMITTED races, outbox double-claim, OAuth SELECT-then-DELETE, per-request connect hang. |
| Wrangler + real DO | Not a Linux process Antithesis can instrument/kill cleanly. |
| Fold workload into alice | Test commands must outlive client crashes; keep the driver separate. |

## SDK

- **Workload:** JavaScript/TypeScript Antithesis SDK (assertions + `setup_complete`).
- **SUT (recommended, all currently missing):** same SDK in `notify-channels.ts` (allocate-then-drop), `replay-mutation.ts` (duplicate), `attach-push-handle.ts` (gap/overlap), `idp-repository.ts` (consume), `drain.ts` (double claim), `server.ts` (health vs boot). Thread-pause value is higher if api + clients are instrumented.

## Faults this topology can see

- Asymmetric partition: alice↔api vs alice↔emqx vs api↔emqx vs api↔postgres.
- Process kill: api, alice, bob, postgres, emqx (lose non-durable FS on clients — **this is the MEMORY-journal property**).
- Clock jump: all containers (DO alarms are not in this topology; MQTT keepalive, OAuth TTL, 4s token refresh, 30s reconcile still apply).
- Node hang/throttle: api or postgres while health stays up.

**Must enable process (node termination) faults** for mutation lost-ack, MEMORY-journal wipe, and isolate-restart analogues. They are disabled by default on some tenants.

## Config notes for setup

- Migrate Postgres at boot (`PostgresMigrationRunner`) before `setup_complete`.
- Seed `client_config.emqx_wss_url` to the in-network EMQX WSS address (or let `EnsureClientConfigMaterialized` run on first request).
- Auth: oauth-dev / fake Google. Two pre-created users for alice/bob plus an anon-upgrade path.
- Sync protocol header `x-sync-protocol: 3`. One workload command should send `2` for `upgrade-required-no-local-wipe`.
- Product reconcile is 30s — either shorten `QUERY_RECONCILE_INTERVAL_MS` in the Antithesis build or size `eventually_` quiet periods > 30s.
- Web Locks / OPFS are **not** in this Node topology. `web-sync-owner-single-uploader` needs a later Chromium/OPFS variant or is workload-skipped.

## Assumptions

- `createServer` can bind a Node HTTP server (sim already does via `serveFetch` / local wrangler). Setup will confirm the exact entry (`apps/server` vs a new `antithesis/` adapter).
- Client Docker image can run the sync-engine against real SQLite files on a durable volume **and** an ephemeral volume (for wipe-on-kill).
- EMQX HTTP publish API is compatible with `createEmqxHttpPubSub`.

## Open Questions

- Exact Node vs Bun base image (repo is Bun-first).
- Whether native SQLite MEMORY journal is in scope (this topology uses bun/better-sqlite3 — may not apply the web SQLite wipe-on-corrupt). Setup must pick an engine that still sets `journal_mode=MEMORY` via `applySqliteConnectionPragmas`.
- Process-fault availability on the tenant.
