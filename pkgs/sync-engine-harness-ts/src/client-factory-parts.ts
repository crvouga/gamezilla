import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { unsafe } from '@pkgs/sql-root-shared-ts/sql';
import { awaitMutationVerdict } from '@pkgs/sync-engine-client-ts/await-mutation-verdict';
import type { CreateLocalSyncEngineOptions } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import { createLocalSyncEngine } from '@pkgs/sync-engine-client-ts/create-local-sync-engine';
import type { MutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import { createMutationClient } from '@pkgs/sync-engine-client-ts/create-mutation-client';
import type { LocalDomainSchema } from '@pkgs/sync-engine-client-ts/local-schema-migrate';
import { HARNESS_QUERY_RECONCILE_INTERVAL_MS } from '@pkgs/sync-engine-client-ts/subscription-constants';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { SyncApiAuthError } from '@pkgs/sync-engine-client-ts/sync-http-client';
import type { AppLifecycle } from '@pkgs/sync-engine-shared-ts/app-lifecycle';
import type {
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { QueryChannelsCtx } from '@pkgs/sync-engine-shared-ts/push-payload';
import type { QueryRegistry } from '@pkgs/sync-engine-shared-ts/queries-types';
import type { TopicMap } from '@pkgs/sync-engine-shared-ts/topic-map';
import type { HarnessPushChannels } from './harness-domain-pack';
import { emptyHarnessPushChannels } from './harness-domain-pack';
import type { HarnessHttpClient } from './http-bridge';

export type HarnessAuthStatus =
  | 'valid'
  | 'expired'
  | 'revoked'
  | 'upgrade_required';

export type HarnessAuthControl = {
  readonly getStatus: () => HarnessAuthStatus;
  /** Upgrade expired → valid (product getFreshAuthToken stand-in). */
  readonly refreshExpired: () => void;
};

type HarnessClientLifecycle = {
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
  readonly http: HarnessHttpClient;
  readonly lifecycle: HarnessClientLifecycle;
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
  }) => HarnessPushChannels;
  readonly topicMap?: TopicMap;
  readonly defaultEntryChannel?: (
    params: unknown,
    ctx: QueryChannelsCtx
  ) => readonly Topic[];
  readonly authControl?: HarnessAuthControl;
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
 * Wrap postQueries/postMutations:
 * - revoked → SyncApiAuthError (client wipes DB)
 * - upgrade_required → SyncApiAuthError (no wipe; protocol cut)
 * - expired → refresh once then retry (queue survives)
 */
export function withHarnessAuthRetry<T>(
  auth: HarnessAuthControl | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (auth === undefined) return fn();
  const run = async (): Promise<T> => {
    const status = auth.getStatus();
    if (status === 'revoked') {
      throw new SyncApiAuthError('revoked');
    }
    if (status === 'upgrade_required') {
      throw new SyncApiAuthError('upgrade_required');
    }
    if (status === 'expired') {
      auth.refreshExpired();
    }
    return fn();
  };
  return run().catch(async (error) => {
    if (error instanceof SyncApiAuthError && error.reason === 'expired') {
      auth.refreshExpired();
      return fn();
    }
    throw error;
  });
}

/** Options bag for {@link createLocalSyncEngine} from harness client args. */
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
      withHarnessAuthRetry(auth, () => args.http.postQueries(rs)),
    postMutations: (ms) =>
      withHarnessAuthRetry(auth, () => args.http.postMutations(ms)),
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
    reconcileIntervalMs: HARNESS_QUERY_RECONCILE_INTERVAL_MS,
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
      }) ?? emptyHarnessPushChannels(args.actorId)),
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
  readonly mutations: MutationRegistry;
  readonly getEnv: () => MutationEnv;
  readonly deviceId: string;
  readonly createId: () => string;
  readonly lifecycle: HarnessClientLifecycle;
  readonly engine: SyncEngine;
};

/** Mutation client wired to wake durable uploads after local apply. */
export function createMutationSide(
  args: CreateMutationSideArgs
): MutationClient {
  const client = createMutationClient({
    db: args.engine.db,
    registry: args.mutations,
    env: args.getEnv(),
    ids: { clientId: args.deviceId },
    connectivity: { isOnline: () => args.lifecycle.lifecycle.isOnline() },
    createId: args.createId,
    awaitVerdict: (mutationId) => awaitMutationVerdict(args.engine, mutationId),
    onQueued: ({ mutation, args: mutationArgs, capture }) => {
      args.engine.wakeUploads();
      args.engine.notifyLocalMutation(mutation, mutationArgs, capture);
    },
  });
  args.engine.registerMutationDrain(() => client.drain());
  return client;
}
