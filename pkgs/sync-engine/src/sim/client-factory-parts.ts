import type { PubSub, Topic } from '@pkgs/pubsub/interface';
import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { AppLifecycle } from '../client/app-lifecycle';
import {
  type CreateLocalSyncEngineOptions,
  createLocalSyncEngine,
} from '../client/create-local-sync-engine';
import type { LocalDomainSchema } from '../client/local-schema-migrate';
import type { Timers } from '../client/sim-ports';
import type { SyncEngine } from '../client/sync-engine-port';
import { SyncApiAuthError } from '../client/sync-http-client';
import {
  createMutationClient,
  type MutationClient,
} from '../mutations/client/create-mutation-client';
import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import type { QueryRegistry } from '../queries/core/types';
import type { QueryChannelsCtx } from '../shared/push-payload';
import type { TopicMap } from '../shared/topic-map';
import { emptySimPushChannels, type SimPushChannels } from './domain-pack';
import type { SimHttpClient } from './http-bridge';

export type SimAuthStatus = 'valid' | 'expired' | 'revoked';

export type SimAuthControl = {
  readonly getStatus: () => SimAuthStatus;
  /** Upgrade expired → valid (product getFreshAuthToken stand-in). */
  readonly refreshExpired: () => void;
};

type SimClientLifecycle = {
  readonly lifecycle: AppLifecycle;
  readonly setForeground: (value: boolean) => void;
  readonly setOnline: (value: boolean) => void;
};

export type CreateEngineOptionsArgs = {
  readonly db: SqlClient;
  readonly tables: LocalDomainSchema;
  readonly mutations: MutationRegistry;
  readonly queries: QueryRegistry;
  readonly getEnv: () => MutationEnv;
  readonly deviceId: string;
  readonly actorId: string;
  readonly http: SimHttpClient;
  readonly lifecycle: SimClientLifecycle;
  readonly now: () => number;
  readonly random: () => number;
  readonly timers: Timers;
  readonly createId: () => string;
  readonly createPubSub: () => PubSub;
  readonly rowImageFanout?: boolean;
  readonly bufferOutboundLive?: boolean;
  readonly sessionQuery: {
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  };
  readonly createPushChannels?: (args: {
    readonly db: SqlClient;
    readonly actorId: string;
  }) => SimPushChannels;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
  readonly authControl?: SimAuthControl;
  readonly schemaEpoch?: number;
  readonly onLocalMigratePhase?: CreateLocalSyncEngineOptions['onLocalMigratePhase'];
};

async function wipeIdentityDb(db: SqlClient): Promise<void> {
  const rows = await db.query(
    unsafe<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    )
  );
  for (const row of rows) {
    await db.run(unsafe(`DROP TABLE IF EXISTS "${row.name}"`));
  }
}

/**
 * Wrap postQueries/postMutations: revoked → SyncApiAuthError; expired →
 * refresh once then retry (queue survives).
 */
export function withSimAuthRetry<T>(
  auth: SimAuthControl | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (auth === undefined) return fn();
  const status = auth.getStatus();
  if (status === 'revoked') {
    return Promise.reject(new SyncApiAuthError('revoked'));
  }
  if (status === 'expired') {
    auth.refreshExpired();
    return fn();
  }
  return fn();
}

/** Options bag for {@link createLocalSyncEngine} from sim client args. */
export async function createEngineFromParts(
  args: CreateEngineOptionsArgs
): Promise<SyncEngine> {
  const auth = args.authControl;
  return createLocalSyncEngine({
    db: args.db,
    localSchema: args.tables,
    mutationRegistry: args.mutations,
    getMutationEnv: args.getEnv,
    getClientId: () => args.deviceId,
    sessionQueries: [args.sessionQuery],
    postQueries: (rs) =>
      withSimAuthRetry(auth, () => args.http.postQueries(rs)),
    postMutations: (ms) =>
      withSimAuthRetry(auth, () => args.http.postMutations(ms)),
    isAuthRevoked: (error) =>
      error instanceof SyncApiAuthError && error.reason === 'revoked',
    deleteDatabase: async () => {
      // Engine disconnects first; wipe while handle may still accept SQL.
      // In-memory close already drops data — best-effort table drop.
      try {
        await wipeIdentityDb(args.db);
      } catch {
        // disconnected / closed — ok for :memory:
      }
    },
    lifecycle: args.lifecycle.lifecycle,
    now: args.now,
    random: args.random,
    timers: args.timers,
    createId: args.createId,
    ...(args.schemaEpoch !== undefined
      ? { schemaEpoch: args.schemaEpoch }
      : {}),
    ...(args.onLocalMigratePhase !== undefined
      ? { onLocalMigratePhase: args.onLocalMigratePhase }
      : {}),
    push: {
      queryRegistry: args.queries,
      createPubSub: args.createPubSub,
      ...(args.createPushChannels?.({
        db: args.db,
        actorId: args.actorId,
      }) ?? emptySimPushChannels(args.actorId)),
      rowImageFanout: args.rowImageFanout !== false,
      ...(args.bufferOutboundLive === true ? { bufferOutboundLive: true } : {}),
      ...(args.topicMap !== undefined ? { topicMap: args.topicMap } : {}),
      ...(args.defaultEntryChannel !== undefined
        ? { defaultEntryChannel: args.defaultEntryChannel }
        : {}),
    },
  });
}

export type CreateMutationSideArgs = {
  readonly db: SqlClient;
  readonly mutations: MutationRegistry;
  readonly getEnv: () => MutationEnv;
  readonly deviceId: string;
  readonly createId: () => string;
  readonly lifecycle: SimClientLifecycle;
  readonly engine: SyncEngine;
};

/** Mutation client wired to wake durable uploads after local apply. */
export function createMutationSide(
  args: CreateMutationSideArgs
): MutationClient {
  return createMutationClient({
    db: args.db,
    registry: args.mutations,
    env: args.getEnv(),
    ids: { clientId: args.deviceId },
    connectivity: { isOnline: () => args.lifecycle.lifecycle.isOnline() },
    createId: args.createId,
    onQueued: ({ mutation, args: mutationArgs, capture }) => {
      args.engine.wakeUploads();
      args.engine.notifyLocalMutation(mutation, mutationArgs, capture);
    },
  });
}
