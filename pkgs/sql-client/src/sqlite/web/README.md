# Multi-tab web SqlClient

Browser tabs share one OPFS SQLite database per `dbName` without fighting exclusive
`createSyncAccessHandle` locks.

## Architecture

Exactly **one Window** owns expo-sqlite (which already runs wa-sqlite + OPFS in its
own dedicated worker). Peers never call `SQLite.openDatabaseAsync`.

### SharedWorker path (default)

```mermaid
sequenceDiagram
  participant TabA
  participant TabB
  participant SW as SharedWorkerBroker
  participant Opfs as ExpoSqliteWorker_OPFS

  TabA->>SW: connect(db)
  SW-->>TabA: role=owner
  TabA->>Opfs: open (wait-retry)
  TabB->>SW: connect(db)
  SW-->>TabB: role=proxy
  TabB->>SW: run(sql,values)
  SW->>TabA: run(sql,values)
  TabA->>Opfs: exec
  TabA-->>SW: result + db-changed
  SW-->>TabB: result + db-changed
```

- Broker script: `/sql-workers/db-host-shared-worker.js` (esbuild prebuild; no Metro worker config).
- Build: `bun run --filter @pkgs/sql-client build:web-workers`
- Heartbeat: tabs ping every 5s; silent ports reaped after 15s; owner promoted.

### Leader-election fallback (no SharedWorker)

```mermaid
sequenceDiagram
  participant TabA
  participant TabB
  participant Lock as WebLock_dbOwner
  participant Chan as BroadcastChannel

  TabA->>Lock: request ifAvailable
  Lock-->>TabA: acquired (owner)
  TabB->>Lock: request ifAvailable
  Lock-->>TabB: busy (proxy)
  TabB->>Chan: run(sql,values)
  Chan->>TabA: run
  TabA-->>Chan: result
  Chan-->>TabB: result
```

- Lock name: `db-owner:<dbName>`
- RPC channel: `db-rpc:<dbName>`
- Change notify: `db-changed:<dbName>`
- On timeout / leader loss: one transparent re-elect + retry (`E_LEADER_LOST`).

## Nested transactions

Flattened (`fn(tx)`), matching Expo / node-pg session clients — no `SAVEPOINT`.

## Destructive reset

Open never auto-deletes OPFS. Use explicit `resetDatabase()` (owner RPC), the
boot-screen “Reset local data” CTA, `?reset-db=1`, or
`runWebOpfsRecoveryAndReload({ timers })` from `@pkgs/sql-client/sqlite/web`.
Recovery asks peer tabs to disconnect, force-releases SharedWorker owners,
wipes OPFS with retries, then reloads — there is no public reset HTML page.

## Migration (`open-main-sql-client.ts`)

Web now calls `createExpoWebSqlClient(dbName, { timers })` instead of
`SqlClientImplExpoSqlite.open` + the old exclusive session lock / per-tab DB suffix.
Native is unchanged. Sync upload/push is gated by `sync-owner:<dbName>`.

### Legacy session lock

`expo-web-session-lock*` remains in the package for older clients and boot-error
matching, but **web open no longer acquires** that exclusive Web Lock. Multi-tab
coordination is SharedWorker (or leader-election fallback) only.
