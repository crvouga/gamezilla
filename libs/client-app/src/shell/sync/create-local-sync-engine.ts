/**
 * Web port of the RN `sync/create-local-sync-engine.ts`: opens the identity
 * DB and builds the push-driven local sync engine. Framework-free — Solid
 * watch snapshots notify synchronously (no transition scheduling).
 */

import type { ConfigService } from '@libs/auth/public/config-service-types';
import {
  createClientPubSub,
  readEmqxWssUrlFromLocalDb,
} from '@libs/client-app/sync/create-client-pubsub';
import { emqxUrlHolderFor } from '@libs/client-app/sync/emqx-url-holder';
import {
  type GetFreshAuthToken,
  postAppQueries,
  postMutationBatch,
  SyncApiAuthError,
  type SyncApiFetch,
  type SyncClientAuth,
} from '@libs/client-app/sync/sync-api';
import type { ComposedFeatures } from '@libs/feature/public/compose';
import {
  type ChannelsCtx,
  defaultEntryChannel,
  type OpenSqlClient,
} from '@libs/feature/public/sync';
import type { Clock, Timers } from '@pkgs/clock';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { WebSqlClient } from '@pkgs/sql-client-sqlite-web/web-sql-client';
import {
  createLocalSyncEngine,
  type SyncEngine,
} from '@pkgs/sync-engine/client';
import type { MutationRegistry } from '@pkgs/sync-engine/shared';
import type { CreateId, Random } from '@pkgs/uuid/create-id';
import {
  openDisposableSqlClient,
  openMainSqlClient,
} from '../storage/open-main-sql-client';
import { createAppSyncLifecycle } from './app-sync-lifecycle';
import { tryAcquireSyncOwnerLease } from './sync-owner-lock';

export type CreateAppLocalSyncEngineArgs = {
  /**
   * Resolves the folded feature set this engine serves: its schema, its
   * queries, its wake topics. The shell holds no product registry of its own,
   * so the same factory builds the whole product's engine and a single
   * feature's — and the fold loads here, with the engine, rather than on the
   * entry chunk.
   */
  readonly loadApp: () => Promise<ComposedFeatures>;
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly userId: string;
  readonly databaseName: string;
  readonly getFreshAuthToken: GetFreshAuthToken;
  readonly auth: SyncClientAuth;
  /** Required nondeterminism ports from `ClientEnv`. */
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly random: Random;
  /** Product mutation registry (loaded by the pool with this module). */
  readonly mutationRegistry: MutationRegistry;
  /** Sim override; defaults to the OPFS broker client. */
  readonly openSqlClient?: OpenSqlClient | undefined;
  /** Sim override; defaults to EMQX from client_config URL. */
  readonly createPubSub?: (() => PubSub) | undefined;
  readonly waitUntilAvailable?:
    | ((signal?: AbortSignal | null) => Promise<void>)
    | undefined;
};

/** Pool callers omit `mutationRegistry` — the pool loads it with the engine. */
export type CreateAppLocalSyncEnginePoolArgs = Omit<
  CreateAppLocalSyncEngineArgs,
  'mutationRegistry'
>;

function mutationEnv(args: CreateAppLocalSyncEngineArgs) {
  const actorId = args.auth.getAccountId() ?? args.userId;
  const deviceId = args.auth.getDeviceId() ?? '';
  return {
    actorId,
    deviceId,
    accountId: args.auth.getAccountId(),
    isAnon: args.auth.getSessionToken() === null,
    now: () => new Date(args.clock.now()),
    createId: args.createId,
  };
}

/** What the composed features asked to keep open for the session. */
function sessionQuerySpecs(app: ComposedFeatures) {
  return app.sessionQueries.map((name) => ({ name, params: {} }));
}

/** Identity-only ctx — room topics derive from held rows in attachPush. */
function createMembershipChannels(args: {
  readonly auth: SyncClientAuth;
  readonly userId: string;
}): {
  readonly getChannelsCtx: () => ChannelsCtx;
  readonly onBindTopicRefresh: (refresh: () => void) => void;
} {
  return {
    // Engine connect wake remakes topics via pkgs `state.refreshTopics`.
    onBindTopicRefresh: (_refresh) => undefined,
    getChannelsCtx: () => ({
      actorId: args.auth.getAccountId() ?? args.userId,
    }),
  };
}

function pushOptions(
  args: CreateAppLocalSyncEngineArgs,
  app: ComposedFeatures,
  pushCtx: ReturnType<typeof createMembershipChannels>,
  emqxUrlHolder: { url: string | null }
) {
  return {
    push: {
      queryRegistry: app.queries,
      createPubSub: () => {
        if (args.createPubSub !== undefined) {
          return args.createPubSub();
        }
        const url = emqxUrlHolder.url?.trim() ?? '';
        // Cold start / missing broker: poll-only until client_config hydrates.
        if (url.length === 0) {
          return null;
        }
        return createClientPubSub({
          url,
          config: args.config,
          fetchFn: args.fetchFn,
          auth: args.auth,
          getFreshAuthToken: args.getFreshAuthToken,
          timers: args.timers,
          random: args.random,
        });
      },
      getChannelsCtx: pushCtx.getChannelsCtx,
      onBindTopicRefresh: pushCtx.onBindTopicRefresh,
      rowImageFanout: true,
      topicMap: app.topicMap,
      defaultEntryChannel,
    },
  };
}

async function openAppLocalDb(
  args: CreateAppLocalSyncEngineArgs
): Promise<SqlClient> {
  if (
    args.openSqlClient === undefined &&
    args.databaseName.startsWith('sim_')
  ) {
    throw new Error(
      `createAppLocalSyncEngine: refusing OPFS open for sim database "${args.databaseName}" — inject openSqlClient`
    );
  }
  if (args.openSqlClient !== undefined) {
    return args.openSqlClient({
      userId: args.userId,
      databaseName: args.databaseName,
    });
  }
  try {
    return await openMainSqlClient(args.userId, args.timers);
  } catch {
    // SQLite is only an optimistic local cache. A stale worker, broken OPFS
    // handle, or corrupt snapshot must never prevent the product shell from
    // booting; discard this cache and use a disposable in-memory SQLite DB.
    return openDisposableSqlClient();
  }
}

async function deleteEngineDatabase(
  args: CreateAppLocalSyncEngineArgs,
  webDb: Partial<WebSqlClient>
): Promise<void> {
  if (typeof webDb.resetDatabase === 'function') {
    await webDb.resetDatabase();
    return;
  }
  throw new Error(
    `createAppLocalSyncEngine: database "${args.databaseName}" cannot be reset (no resetDatabase on client)`
  );
}

function webChangeBridge(webDb: Partial<WebSqlClient>) {
  const onChanged = webDb.onChanged;
  if (typeof onChanged !== 'function') return {};
  return {
    subscribeExternalDbChanged: (listener: () => void) =>
      onChanged(() => {
        listener();
      }),
  };
}

function buildEngine(
  args: CreateAppLocalSyncEngineArgs,
  app: ComposedFeatures,
  db: SqlClient,
  isOwner: boolean
): Promise<SyncEngine> {
  const pushCtx = createMembershipChannels({
    auth: args.auth,
    userId: args.userId,
  });
  const emqxUrlHolder = emqxUrlHolderFor(args.databaseName);
  const webDb = db as Partial<WebSqlClient>;
  return createLocalSyncEngine({
    db,
    localSchema: {
      domainSchema: app.schema,
      cacheTableNames: app.tableNames,
    },
    mutationRegistry: args.mutationRegistry,
    getMutationEnv: () => mutationEnv(args),
    getClientId: () => args.auth.getDeviceId() ?? args.databaseName,
    sessionQueries: sessionQuerySpecs(app),
    postQueries: (requests) => postAppQueries({ ...args, requests }),
    postMutations: (mutations) => postMutationBatch({ ...args, mutations }),
    isAuthRevoked: (error) =>
      error instanceof SyncApiAuthError && error.reason === 'revoked',
    deleteDatabase: () => deleteEngineDatabase(args, webDb),
    lifecycle: createAppSyncLifecycle(),
    now: args.clock.now,
    timers: args.timers,
    createId: args.createId,
    enableMutationUpload: isOwner,
    // Injected openSqlClient marks sim/product-simulator — use the short reconcile
    // safety net so missed OOB notifies heal inside DST wait budgets.
    ...(args.openSqlClient !== undefined ? { reconcileIntervalMs: 500 } : {}),
    ...(args.waitUntilAvailable !== undefined
      ? { waitUntilAvailable: args.waitUntilAvailable }
      : {}),
    ...webChangeBridge(webDb),
    ...(isOwner ? pushOptions(args, app, pushCtx, emqxUrlHolder) : {}),
  });
}

/** Opens the identity DB and builds the push-driven local sync engine. */
export async function createAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  // Injected openSqlClient = sim/product-simulator isolated DB — never share OPFS, so
  // skip Web Locks (a prior engine's unreleased lock would make reload a
  // permanent non-owner with no upload/push).
  // The fold arrives with this module, not with the entry chunk.
  const app = await args.loadApp();
  const syncLease =
    args.openSqlClient !== undefined
      ? { isOwner: true as const, release: () => undefined }
      : await tryAcquireSyncOwnerLease(args.databaseName);
  try {
    let db = await openAppLocalDb(args);
    let engine: SyncEngine;
    try {
      engine = await buildEngine(args, app, db, syncLease.isOwner);
      emqxUrlHolderFor(args.databaseName).url =
        await readEmqxWssUrlFromLocalDb(db);
    } catch {
      // A worker can open successfully while the cached schema/snapshot is
      // unusable. Rebuild once against a clean disposable cache; SQLite must
      // never turn into an application boot gate.
      await db.disconnect().catch(() => undefined);
      db = await openDisposableSqlClient();
      engine = await buildEngine(args, app, db, syncLease.isOwner);
      emqxUrlHolderFor(args.databaseName).url =
        await readEmqxWssUrlFromLocalDb(db);
    }
    const disconnect = engine.disconnect.bind(engine);
    return {
      ...engine,
      disconnect: async () => {
        try {
          await disconnect();
        } finally {
          syncLease.release();
        }
      },
    };
  } catch (error: unknown) {
    syncLease.release();
    throw error;
  }
}
