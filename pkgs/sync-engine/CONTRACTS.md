# `@pkgs/sync-engine` contracts

Signed-off classification (Forks A–C defaults accepted). This file is the
authoritative contract map + redesign target. Runtime docs stay in
[`README.md`](./README.md).

## Signed-off forks

| Fork | Decision |
|------|----------|
| **A — content/scope hash algorithms** | **Internal.** Wire promises opaque string equality for `lastHash`/`hash` / `not_modified` only. Algorithm changes may cause temporary cache misses across mixed versions, not incorrect merges. |
| **B — CI framework table names** | Opaque `assertDomainTablesAvoidFrameworkNames(names)` on `/shared`. Unexport `FRAMEWORK_*` constants. Channel CI merges framework mutations inside `assertChannelExhaustiveness`. |
| **C — sim/test seam** | Expand `/test` for epoch, controllable lifecycle, `withFrameworkMutations` (CI escape), prune. Sim should prefer public + `/test` seams; deep `src/` imports are an in-package debt to shrink. |

---

## 1. Contract classes

### Code API (four entrypoints)

Coordinated monorepo refactors OK. Evidence: apps/client, apps/api, libs/\*, pkgs/inbox.

**client:** `createLocalSyncEngine`, pool, HTTP client, providers/hooks (`useSyncEngine`, `useQuery`, `useMutationClient`, paint gate), `SyncEngine` (+ `mutationOutcome` / `listRejections` / `pendingMutationCount`), status types, lifecycle **types**, upload/query port type aliases.

**server:** `createSyncApp`, `notifyChannels` (allocates pushSeqs via `sql`), `isAuthErrorBody`, `SyncAppAuth`, `pruneMutationArtifacts`.

**shared:** define/registry APIs, soft-delete helpers, protocol re-exports, `applyFrameworkServerDdl`, channel exhaustiveness, `assertDomainTablesAvoidFrameworkNames`.

**test:** `createInMemorySyncEngine`, `SCHEMA_EPOCH`, `createControllableLifecycle`, `withFrameworkMutations`, `pruneMutationArtifacts`, `LocalMigratePhase`.

### Wire protocol

Frozen in [`src/protocol/v1.ts`](./src/protocol/v1.ts) (`SYNC_PROTOCOL_VERSION = 1`). CI: `ci:sync-engine-protocol-freeze`. Shapes: query/mutation batches, `QueryResponse`, auth error body, `PushMessage`, `MAX_*` bounds. **No shape changes without a version bump.**

### Local domain SQL read contract

Domain tables from host schema; managed `_deleted_at`; UI filters live rows (`_deleted_at IS NULL` / `LIVE_ROW_SQL`); `useQuery` / `watch` semantics. Soft-delete-only domain writes.

### Extension contract

`defineQuery` / `defineMutation`, registries, `MutationEnv` / `MutationError`, `channels` / `invalidates` / `affectedRows` / `constraintErrors` / `declaredWrites`.

### Host wiring / ports

`postQueries` / `postMutations` (aliases of protocol types), pubsub, auth, SQL clients, lifecycle, `sessionQueries`, `rowImageFanout`, sim `now`/`timers`/`createId`, opaque server migrate.

### Internal

Framework table names/shapes/DDL text, merge/rebase/upload/subscription, `allocateTopicPushSeq*`, hash algorithms, coalesce/single-flight, epoch mechanics, `publishPushMessages`.

---

## 2. Leak inventory → replacement

| Leak | Replacement |
|------|-------------|
| Sim/raw `write_rejections` / `_mutations` reads | `SyncEngine.mutationOutcome` / `listRejections` / `pendingMutationCount` (sim `outcome`/`rejections` built on these) |
| `SCHEMA_EPOCH` on `/client` | `/test` only; create option `schemaEpoch` remains host wiring |
| `FRAMEWORK_*` DDL/name exports | Opaque `applyFrameworkServerDdl` + `assertDomainTablesAvoidFrameworkNames` |
| `allocateTopicPushSeq(s)` public | Folded into `notifyChannels({ sql, topics, … })` |
| Port types ≠ wire | Protocol module; client aliases `QueryRequest` / `MutationUploadRow` |
| `withFrameworkMutations` required | Merged inside `createSyncApp` / `createLocalSyncEngine` / `MutationClientProvider`; `/test` only for escapes |
| Engine wake/notify on product surface | Kept `@internal` for MutationClientProvider; not for feature UI |

---

## 3. Final surface (target signatures)

### `@pkgs/sync-engine/shared` (protocol + extension)

```ts
/** Wire protocol v1 — frozen. */
export {
  SYNC_PROTOCOL_VERSION,
  MAX_MUTATIONS_BATCH, MAX_QUERY_BATCH, MAX_FANOUT_ROWS, MAX_FANOUT_BYTES,
  type QueryRow, type QueryRequestItem, type QueryBatchRequest,
  type QueryResponse, type QueryBatchResponse,
  type MutationRequestItem, type MutationBatchRequest,
  type MutationVerdict, type MutationBatchResponse,
  type AuthErrorBody, type PushMessage,
} from './protocol';

export function defineQuery<P>(def: QueryDef<P>): QueryDef<P>;
export function defineMutation<A>(def: Mutation<A>): Mutation<A>;
export function queryRegistry(defs: readonly QueryDef<unknown>[]): QueryRegistry;
export function mutationRegistry(defs: readonly Mutation<unknown>[]): MutationRegistry;
export const LIVE_ROW_SQL: string;
export function softDeleteById(...): Promise<void>;
export function applyFrameworkServerDdl(args: { sqlClient; logger? }): Promise<void>;
export function assertDomainTablesAvoidFrameworkNames(names: readonly string[]): void;
export function assertChannelExhaustiveness(mutations, queries): void;
```

### `@pkgs/sync-engine/client`

```ts
export function createLocalSyncEngine(options: CreateLocalSyncEngineOptions): Promise<SyncEngine>;
export function createSyncHttpClient(options): SyncHttpClient;
export function createSyncEnginePool(options): SyncEnginePoolApi;
// React: SyncEngineProvider, MutationClientProvider, useSyncEngine, useQuery, …
export type SyncEngine = {
  db: SqlClient;
  watch(query): WatchSubscription;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  clearLocalData(opts?: { reason?: 'cache' | 'revoked' }): Promise<void>;
  waitForFirstSync(): Promise<void>;
  refreshQueries(): Promise<void>;
  subscribeQuery(name, params): QuerySubscription;
  subscribeQueries(specs): SubscribeQueriesHandle;
  status: SyncStatusSubscription; // → SyncEngineStatus
  mutationOutcome(id): Promise<'pending' | 'confirmed' | 'rejected'>;
  listRejections(): Promise<readonly UnackedWriteRejection[]>;
  pendingMutationCount(): Promise<number>;
  /** @internal */ wakeUploads(): void;
  /** @internal */ notifyLocalMutation(mutation, args): void;
};
export type SyncEngineStatus = {
  connection: SyncConnectionState;
  online: boolean;
  hasSynced: boolean;
  hasEverSynced: boolean;
  lastError: string | null;
};
```

### `@pkgs/sync-engine/server`

```ts
export function createSyncApp(deps: CreateSyncAppDeps): Hono;
export function notifyChannels(options: {
  pubsub: PubSub;
  sql: SqlClient; // allocates pushSeqs — hosts never touch sequences
  topics: readonly Topic[];
  tables?: readonly string[];
  rows?: Readonly<Record<string, readonly QueryRow[]>>;
  label?: string;
}): void;
export function isAuthErrorBody(body: unknown): body is AuthErrorBody;
export function pruneMutationArtifacts(db, olderThanMs, now?): Promise<void>;
export type SyncAppAuth = { actorId; deviceId; accountId; isAnon };
```

### `@pkgs/sync-engine/test`

```ts
export function createInMemorySyncEngine(options): Promise<SyncEngine>;
export const SCHEMA_EPOCH: number;
export function createControllableLifecycle(opts?): ControllableLifecycle;
export function withFrameworkMutations(registry): MutationRegistry;
export function pruneMutationArtifacts(...): Promise<void>;
export type LocalMigratePhase = 'before' | 'afterCacheWipe' | 'afterEnsure' | 'done';
```

Checked-in symbol lists: [`api-reports/`](./api-reports/).

---

## 4. Deletion list

| Removed from public | Replacement / note |
|---------------------|-------------------|
| `SCHEMA_EPOCH` from `/client` | `/test` |
| `alwaysOnLifecycle`, `createControllableLifecycle` from `/client` | `/test` (+ internal default) |
| `LocalMigratePhase` from `/client` | `/test` |
| `allocateTopicPushSeq`, `allocateTopicPushSeqs` | inside `notifyChannels` |
| `FRAMEWORK_SERVER_DDL`, `FRAMEWORK_*_TABLE_NAMES` | Internal; opaque migrate + collision assert |
| `withFrameworkMutations` from `/shared` | Auto-merge in factories; `/test` escape |
| ~**15** public symbols removed/moved | Protocol adds ~12 typed aliases (net roughly flat; leak surface down) |

---

## 5. Migration plan (consumers)

| Consumer | Change | Mechanical? |
|----------|--------|-------------|
| `apps/api` notify helpers | `notifyChannels({ sql, topics })` — done | Yes |
| `apps/api` migrate | Keep `applyFrameworkServerDdl` | Yes (unchanged call) |
| `apps/client` | No framework-table / epoch imports | Yes |
| libs feature defs | Unchanged defineQuery/Mutation | Yes |
| tools channel / table CI | Opaque asserts — done | Yes |
| Epoch scenarios | Import `SCHEMA_EPOCH` from `/test` — done | Yes |
| Domain packs registries | Drop manual `withFrameworkMutations` — done | Yes |
| Sim `outcome`/`rejections` | Via engine APIs — done | Yes |
| Sim deep-imports of merge/replay/… | **Not mechanical** — gradual move onto `/test` host helpers in a follow-up |

---

## 6. Refactor-freedom checklist

Internal change possible with **zero** edits outside `pkgs/sync-engine/src/` (after remaining sim deep-import cleanup):

| Change | Guaranteeing contract |
|--------|----------------------|
| Rename/restructure framework tables | Code API observables + opaque migrate; CI `ci:sync-engine-framework-leak` |
| Rewrite merge/rebase/subscription/upload | Code API + Extension + Host ports only |
| Swap pubsub transport | Host `pubsub` / `push.createPubSub` ports |
| Change coalesce/batching/retry/single-flight | Internal (bounds constants are Wire if they change wire caps) |
| Change `SCHEMA_EPOCH` / cache-wipe | Internal; `/test` `SCHEMA_EPOCH` + `schemaEpoch` option |
| Change hash algorithms | Internal (Fork A); wire = opaque equality |
| New push optimization | Optional fields on frozen `PushMessage`; no new required host wiring |

**Must not change without versioned decision:** wire shapes, local domain SQL read contract, defineQuery/Mutation authoring shapes, four-entrypoint rule.

---

## 7. CI gates

| Gate | Script |
|------|--------|
| `ci:sync-engine-public-api` | `api-reports/{client,server,shared,test}.txt` |
| `ci:sync-engine-protocol-freeze` | `api-reports/protocol-v1.sha256` |
| `ci:sync-engine-framework-leak` | No framework table/DDL symbols in apps/libs/inbox/tools |
| `ci:sync-engine-blackbox-tests` | Scenarios stay black-box |
| `ci:no-local-tables` | Opaque domain↔framework collision |
| `ci:channel-exhaustiveness` | Topic overlap (auto-merges framework mutations) |

To update a freeze deliberately: change the surface, run the check once to rewrite the report/hash (or edit the snapshot), and review in PR.
