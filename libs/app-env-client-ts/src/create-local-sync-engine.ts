/**
 * Web port of the RN `sync/create-local-sync-engine.ts`: opens the identity
 * DB and builds the push-driven local sync engine. Framework-free — Solid
 * watch snapshots notify synchronously (no transition scheduling).
 */

import { createAppSyncLifecycle } from '@libs/app-root-shared-ts/app-sync-lifecycle';
import { emqxUrlHolderFor } from '@libs/app-root-shared-ts/emqx-url-holder';
import { tryAcquireSyncOwnerLease } from '@libs/app-root-shared-ts/sync-owner-lock';
import { localSyncActor } from '@libs/auth-shared-ts/auth-context';
import type { ConfigService } from '@libs/auth-shared-ts/config-service-types';
import type { ModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import type { ComposedSubs } from '@libs/sub-shared-ts/compose';
import type { ChannelsCtx, OpenSqlClient } from '@libs/sub-shared-ts/sync';
import { defaultEntryChannel } from '@libs/sub-shared-ts/sync';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { WebSqlClient } from '@pkgs/sql-client-sqlite-web-client-ts/web-sql-client';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import type {
  GetFreshAuthToken,
  SyncClientAuth,
} from '@pkgs/sync-engine-client-ts/sync-http-client';
import { SyncApiAuthError } from '@pkgs/sync-engine-client-ts/sync-http-client';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { CreateId, Random } from '@pkgs/uuid-shared-ts/create-id';
import { traceBrowserStartup } from './browser-boundaries';
import {
  type ClientPubSubArgs,
  createClientPubSub,
  readEmqxWssUrlFromLocalDb,
} from './create-client-pubsub';
import { openMainSqlClient } from './open-main-sql-client';
import type { SyncApiFetch } from './sync-api';
import { postAppQueries, postMutationBatch } from './sync-api';

export type CreateAppLocalSyncEngineArgs = {
  /**
   * Resolves the folded sub set this engine serves: its schema, its
   * queries, its wake topics. The shell holds no product registry of its own,
   * so the same factory builds the whole product's engine and a single
   * sub's — and the fold loads here, with the engine, rather than on the
   * entry chunk.
   */
  readonly loadApp: () => Promise<ComposedSubs>;
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
  /** The device's moderation: every write is judged by its current rules. */
  readonly moderation: ModerationRules;
  /** Product mutation registry (loaded by the pool with this module). */
  readonly mutationRegistry: MutationRegistry;
  /** Harness override; defaults to the OPFS broker client. */
  readonly openSqlClient?: OpenSqlClient | undefined;
  /** Harness override; defaults to EMQX from client_config URL. */
  readonly createPubSub?:
    | ((args: ClientPubSubArgs) => PubSub | null)
    | undefined;
  /** See `ClientEnv.canSubscribe`. */
  readonly canSubscribe?:
    | ((topic: Topic, ctx: ChannelsCtx) => boolean)
    | undefined;
  readonly waitUntilAvailable?:
    | ((signal?: AbortSignal | null) => Promise<void>)
    | undefined;
};

/** Pool callers omit `mutationRegistry` — the pool loads it with the engine. */
export type CreateAppLocalSyncEnginePoolArgs = Omit<
  CreateAppLocalSyncEngineArgs,
  'mutationRegistry'
>;

function mutationEnv(args: CreateAppLocalSyncEngineArgs, app: ComposedSubs) {
  return {
    ...localSyncActor({
      accountId: args.auth.getAccountId(),
      deviceId: args.auth.getDeviceId() ?? '',
      userId: args.userId,
      sessionToken: args.auth.getSessionToken(),
    }),
    now: () => new Date(args.clock.now()),
    createId: args.createId,
    contentRules: args.moderation.current(),
    turnGames: app.turnGames,
  };
}

/** What the composed subs asked to keep open for the session. */
function sessionQuerySpecs(app: ComposedSubs) {
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
  app: ComposedSubs,
  pushCtx: ReturnType<typeof createMembershipChannels>,
  emqxUrlHolder: { url: string | null }
) {
  return {
    push: {
      queryRegistry: app.queries,
      createPubSub: () => {
        const url = emqxUrlHolder.url?.trim() ?? '';
        // Cold start / missing broker: poll-only until client_config hydrates.
        if (url.length === 0 && args.createPubSub === undefined) {
          return null;
        }
        return (args.createPubSub ?? createClientPubSub)({
          url,
          config: args.config,
          fetchFn: args.fetchFn,
          auth: args.auth,
          getFreshAuthToken: args.getFreshAuthToken,
          timers: args.timers,
          random: args.random,
          logger: createLogger({ name: 'pubsub', now: args.clock.now }),
        });
      },
      getChannelsCtx: pushCtx.getChannelsCtx,
      onBindTopicRefresh: pushCtx.onBindTopicRefresh,
      rowImageFanout: true,
      topicMap: app.topicMap,
      defaultEntryChannel,
      ...(args.canSubscribe !== undefined
        ? { canSubscribe: args.canSubscribe }
        : {}),
    },
  };
}

async function openAppLocalDb(
  args: CreateAppLocalSyncEngineArgs
): Promise<SqlClient> {
  if (
    args.openSqlClient === undefined &&
    args.databaseName.startsWith('harness_')
  ) {
    throw new Error(
      `createAppLocalSyncEngine: refusing OPFS open for harness database "${args.databaseName}" — inject openSqlClient`
    );
  }
  if (args.openSqlClient === undefined) {
    return openMainSqlClient(
      args.userId,
      args.timers,
      createLogger({ name: 'sqlite-web', now: args.clock.now })
    );
  }
  return args.openSqlClient({
    userId: args.userId,
    databaseName: args.databaseName,
  });
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
  app: ComposedSubs,
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
    getMutationEnv: () => mutationEnv(args, app),
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
    ...(args.waitUntilAvailable !== undefined
      ? { waitUntilAvailable: args.waitUntilAvailable }
      : {}),
    ...webChangeBridge(webDb),
    ...(isOwner ? pushOptions(args, app, pushCtx, emqxUrlHolder) : {}),
  });
}

/** The tab that holds no lock still boots; it just syncs alone. */
async function acquireSyncLease(args: CreateAppLocalSyncEngineArgs) {
  // Injected openSqlClient = harness/product-harness isolated DB — never share OPFS, so
  // skip Web Locks (a prior engine's unreleased lock would make reload a
  // permanent non-owner with no upload/push).
  if (args.openSqlClient !== undefined) {
    return { isOwner: true as const, release: () => undefined };
  }
  return tryAcquireSyncOwnerLease(args.databaseName);
}

async function readEmqxUrl(db: SqlClient): Promise<string | null> {
  try {
    return await readEmqxWssUrlFromLocalDb(db);
  } catch {
    // The broker address is cached data too; push waits for the next sync.
    return null;
  }
}

/** Opens the identity DB and builds the push-driven local sync engine. */
export async function createAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  const syncLease = await traceBrowserStartup('client.boot.lease', () =>
    acquireSyncLease(args)
  );
  let db: SqlClient | undefined;
  try {
    // Observe both outcomes: a failed module load must release an opened store.
    const [appResult, dbResult] = await Promise.allSettled([
      traceBrowserStartup('client.boot.app', args.loadApp),
      openAppLocalDb(args),
    ]);
    if (dbResult.status === 'rejected') throw dbResult.reason;
    const opened = dbResult.value;
    db = opened;
    if (appResult.status === 'rejected') throw appResult.reason;
    const app = appResult.value;
    const isOwner = syncLease.isOwner;
    const engine = await traceBrowserStartup('db.migrate', () =>
      buildEngine(args, app, opened, isOwner)
    );
    emqxUrlHolderFor(args.databaseName).url = await traceBrowserStartup(
      'client.boot.config',
      () => readEmqxUrl(opened)
    );
    const disconnect = engine.disconnect.bind(engine);
    return {
      ...engine,
      ensurePush: () => {
        void readEmqxUrl(opened).then((url) => {
          emqxUrlHolderFor(args.databaseName).url = url;
          engine.ensurePush();
        });
      },
      disconnect: async () => {
        try {
          await disconnect();
        } finally {
          syncLease.release();
        }
      },
    };
  } catch (error: unknown) {
    await db?.disconnect().catch(() => undefined);
    syncLease.release();
    throw error;
  }
}
