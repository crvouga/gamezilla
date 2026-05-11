# Sync model: server authority, client cache

## Invariants

- **Server (Postgres in production)** is the **durable source of truth**. The library does **not** infer “server data loss” from read shapes (empty patch lists, ABAC-filtered reads, missing entities).
- **Client (local SQLite)** is a **cache plus outbox**: pending edits have no `patch/syncedAt`; rows learned from the server are marked synced when merged from `remote.read` / accepted `remote.write`.
- **Wire**: `POST …/patches/read` returns `{ results }`; `POST …/patches/write` returns `{ accepted, rejected }`. No replica epoch, no reconcile endpoint.

## Behavior

- **Push**: `SyncPatchDb` sends unsynced patches in chunks bounded by `MAX_PATCHES_PER_REQUEST`. The server response is authoritative: **accepted** patches get `patch/syncedAt` locally; **rejected** patches (HTTP 200 partial reject) and **transport-rejected** chunks (401/403) stay in the local DB but are marked (`patch/syncRejectedAt`, `patch/rejected: true`, reason). Those rows are **ignored for entity snapshots and outbox** until `clearRejectedPushes` clears the markers (e.g. after auth). Patch rows are not deleted for sync outcomes. Then poll runs.
- **Poll**: Builds queries from active subscriptions, reads from the remote, **merges** returned patches into the local DB (`patch/syncedAt` set on merged rows). There is **no** client-side heuristic that clears synced markers because the server returned fewer patches than the client expected.

## Operations / disasters

- Real **server restore** or **manual DB wipe** is **out of scope** for automatic reconciliation. Operators should **clear client databases** or reinstall clients if cache must match a new server state.

## API host

- Gamezilla mounts ABAC on the authority `PatchDb` in `packages/api` (`abac-policies.ts` + `patch-db.ts`). Reads may be filtered by policy; that does **not** mean data is missing on the server.

## Identity vocabulary (patch-db context)

- **device** — per-install replication identity (`patch/createdById` when authoring as anon, `device/*` attrs). For unauthenticated patch-db requests the host carries the device id in the `x-anon-id` header.
- **client** — unauthenticated HTTP caller (no `Authorization`, no `x-anon-id`); a caller-context bag with no identity claims.
- **account** — registered account id after login; `account/*` entity types.
- **accountSession** — authenticated session rows (`accountSession/*`). Distinct from **`patch/sessionId`**, which is write-batch correlation only.
