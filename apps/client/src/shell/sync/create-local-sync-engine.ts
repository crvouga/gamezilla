/**
 * Web port of the RN `sync/create-local-sync-engine.ts`: opens the identity
 * DB and builds the push-driven local sync engine. Framework-free — Solid
 * watch snapshots notify synchronously (no transition scheduling).
 */

import { APP_MUTATIONS } from '@apps/client/sync/app-mutations';
import { APP_QUERIES } from '@apps/client/sync/app-queries';
import {
  createClientPubSub,
  readEmqxWssUrlFromLocalDb,
} from '@apps/client/sync/create-client-pubsub';
import { emqxUrlHolderFor } from '@apps/client/sync/emqx-url-holder';
import {
  type GetFreshAuthToken,
  postAppQueries,
  postMutationBatch,
  SyncApiAuthError,
  type SyncApiFetch,
  type SyncClientAuth,
} from '@apps/client/sync/sync-api';
import type { ConfigService } from '@libs/auth/public/config-service-types';
import type { AppChannelsCtx } from '@libs/runtime/public/sync-topics';
import {
  appSchema,
  LOCAL_DOMAIN_TABLE_NAMES,
} from '@libs/runtime/root/app-schema';
import {
  appDefaultEntryChannel,
  appTopicMap,
} from '@libs/runtime/root/app-topic-map';
import type { OpenSqlClient } from '@libs/runtime/shared/env';
import type { Clock, Timers } from '@pkgs/clock';
import type { PubSub } from '@pkgs/pubsub/interface';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { WebSqlClient } from '@pkgs/sql-client-sqlite-web';
import {
  createLocalSyncEngine,
  type SyncEngine,
} from '@pkgs/sync-engine/client';
import type { CreateId, Random } from '@pkgs/uuid/create-id';
import { openMainSqlClient } from '../storage/open-main-sql-client';
import { createAppSyncLifecycle } from './app-sync-lifecycle';
import { tryAcquireSyncOwnerLease } from './sync-owner-lock';

/** Session queries held for the engine lifetime (not a UI paint barrier). */
const SESSION_QUERIES = [
  'ownUser',
  'ownDevices',
  'ownExternalAccounts',
  'ownProfile',
  'clientConfig',
  'openSpaceSessions',
  'mySpaces',
  'mySpaceUsers',
  'friendships',
  'friendRequests',
  'userBlocks',
  'notificationsActive',
  'chessPuzzleProfile',
  'chessPuzzleInteractions',
] as const;

export type CreateAppLocalSyncEngineArgs = {
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
  /** Sim override; defaults to the OPFS broker client. */
  readonly openSqlClient?: OpenSqlClient | undefined;
  /** Sim override; defaults to EMQX from client_config URL. */
  readonly createPubSub?: (() => PubSub) | undefined;
  readonly waitUntilAvailable?:
    | ((signal?: AbortSignal | null) => Promise<void>)
    | undefined;
};

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

function sessionQuerySpecs() {
  return SESSION_QUERIES.map((name) => ({ name, params: {} }));
}

/** Identity-only ctx — room topics derive from held rows in attachPush. */
function createMembershipChannels(args: {
  readonly auth: SyncClientAuth;
  readonly userId: string;
}): {
  readonly getChannelsCtx: () => AppChannelsCtx;
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
  pushCtx: ReturnType<typeof createMembershipChannels>,
  emqxUrlHolder: { url: string | null }
) {
  return {
    push: {
      queryRegistry: APP_QUERIES,
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
      topicMap: appTopicMap,
      defaultEntryChannel: appDefaultEntryChannel,
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
  return openMainSqlClient(args.userId, args.timers);
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
      domainSchema: appSchema,
      cacheTableNames: LOCAL_DOMAIN_TABLE_NAMES,
    },
    mutationRegistry: APP_MUTATIONS,
    getMutationEnv: () => mutationEnv(args),
    getClientId: () => args.auth.getDeviceId() ?? args.databaseName,
    sessionQueries: sessionQuerySpecs(),
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
    ...(isOwner ? pushOptions(args, pushCtx, emqxUrlHolder) : {}),
  });
}

/** Opens the identity DB and builds the push-driven local sync engine. */
export async function createAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  // Injected openSqlClient = sim/product-simulator isolated DB — never share OPFS, so
  // skip Web Locks (a prior engine's unreleased lock would make reload a
  // permanent non-owner with no upload/push).
  const syncLease =
    args.openSqlClient !== undefined
      ? { isOwner: true as const, release: () => undefined }
      : await tryAcquireSyncOwnerLease(args.databaseName);
  try {
    const db = await openAppLocalDb(args);
    const engine = await buildEngine(args, db, syncLease.isOwner);
    emqxUrlHolderFor(args.databaseName).url =
      await readEmqxWssUrlFromLocalDb(db);
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
