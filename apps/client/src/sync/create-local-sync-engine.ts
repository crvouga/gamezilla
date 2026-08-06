import type { ConfigService } from '@libs/auth/client/config-service-types';
import type { AppChannelsCtx } from '@libs/db/shared/sync-topics';
import { SYNC_TABLE_REGISTRY } from '@libs/db/shared/table-registry';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createLocalSyncEngine } from '@pkgs/sync-engine/client/create-local-sync-engine';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import * as SQLite from 'expo-sqlite';

import { deleteLegacySidecarDb } from '../storage/delete-legacy-sidecar-db';
import { openMainSqlClient } from '../storage/open-main-sql-client';
import { APP_MUTATIONS } from './app-mutations';
import { APP_QUERIES } from './app-queries';
import { tryCreateClientPubSub } from './create-client-pubsub';
import {
  postAppQuery,
  postMutationBatch,
  SyncApiAuthError,
  type GetFreshAuthToken,
  type SyncApiFetch,
  type SyncClientAuth,
} from './sync-api';

const BOOT_QUERIES = [
  'ownUser',
  'ownDevices',
  'ownExternalAccounts',
  'ownProfile',
  'clientConfig',
  'openSpaceSessions',
] as const;

export type CreateAppLocalSyncEngineArgs = {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly userId: string;
  readonly databaseName: string;
  readonly getFreshAuthToken: GetFreshAuthToken;
  readonly auth: SyncClientAuth;
};

function mutationEnv(args: CreateAppLocalSyncEngineArgs) {
  const actorId = args.auth.getAccountId() ?? args.userId;
  const deviceId = args.auth.getDeviceId() ?? '';
  return {
    actorId,
    deviceId,
    accountId: args.auth.getAccountId(),
    isAnon: args.auth.getSessionToken() === null,
    now: () => new Date(),
  };
}

async function loadMembershipSpaceIds(
  db: SqlClient,
  actorId: string
): Promise<string[]> {
  const rows = await db.query(sql<{ id: string }>`
    SELECT id FROM spaces
    WHERE host_member_id = ${actorId}
       OR host_account_id = ${actorId}
       OR id IN (
         SELECT space_id FROM space_users WHERE user_id = ${actorId}
       )
  `);
  return rows.map((row) => row.id).filter((id) => id.length > 0);
}

function bootQuerySpecs() {
  return BOOT_QUERIES.map((name) => {
    const def = APP_QUERIES[name];
    return {
      name,
      params: {},
      ...(def?.pollMs !== undefined ? { pollMs: def.pollMs } : {}),
      ...(def?.pollMsLazy !== undefined ? { pollMsLazy: def.pollMsLazy } : {}),
    };
  });
}

function createGetChannelsCtx(
  db: SqlClient,
  args: CreateAppLocalSyncEngineArgs,
  initialMembership: string[]
): () => AppChannelsCtx {
  let membershipCache = initialMembership;
  return () => {
    const actorId = args.auth.getAccountId() ?? args.userId;
    void loadMembershipSpaceIds(db, actorId).then((ids) => {
      membershipCache = ids;
    });
    return { actorId, membershipSpaceIds: membershipCache };
  };
}

function nudgeOptions(
  args: CreateAppLocalSyncEngineArgs,
  getChannelsCtx: () => AppChannelsCtx
) {
  const enabled =
    (process.env['EXPO_PUBLIC_EMQX_WSS_URL']?.trim() ?? '').length > 0;
  if (!enabled) return {};
  return {
    nudges: {
      queryRegistry: APP_QUERIES,
      createPubSub: () => {
        const next = tryCreateClientPubSub({
          config: args.config,
          fetchFn: args.fetchFn,
          auth: args.auth,
          getFreshAuthToken: args.getFreshAuthToken,
        });
        if (next === null) {
          throw new Error('pubsub unavailable');
        }
        return next;
      },
      getChannelsCtx,
    },
  };
}

/** Opens the identity DB and builds the API-polled local sync engine. */
export async function createAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  await deleteLegacySidecarDb(args.databaseName);
  const db = await openMainSqlClient(args.userId);
  // Membership loads after migrateLocalSchema (inside createLocalSyncEngine);
  // querying `spaces` before migrate fails on a fresh DB.
  const getChannelsCtx = createGetChannelsCtx(db, args, []);

  return createLocalSyncEngine({
    db,
    tableRegistry: SYNC_TABLE_REGISTRY,
    mutationRegistry: APP_MUTATIONS,
    getMutationEnv: () => mutationEnv(args),
    getClientId: () => args.auth.getDeviceId() ?? args.databaseName,
    bootQueries: bootQuerySpecs(),
    postQuery: (request) => postAppQuery({ ...args, request }),
    postMutations: (mutations) => postMutationBatch({ ...args, mutations }),
    isAuthRevoked: (error) =>
      error instanceof SyncApiAuthError && error.reason === 'revoked',
    deleteDatabase: () => SQLite.deleteDatabaseAsync(args.databaseName),
    ...nudgeOptions(args, getChannelsCtx),
  });
}
