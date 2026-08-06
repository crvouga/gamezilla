import type { ConfigService } from '@libs/auth/client/config-service-types';
import { SYNC_TABLE_REGISTRY } from '@libs/db/shared/table-registry';
import { createLocalSyncEngine } from '@pkgs/sync-engine/client/create-local-sync-engine';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import * as SQLite from 'expo-sqlite';

import { deleteLegacySidecarDb } from '../storage/delete-legacy-sidecar-db';
import { openMainSqlClient } from '../storage/open-main-sql-client';
import { APP_MUTATIONS } from './app-mutations';
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

/** Opens the identity DB and builds the API-polled local sync engine. */
export async function createAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  await deleteLegacySidecarDb(args.databaseName);
  const db = await openMainSqlClient(args.userId);
  return createLocalSyncEngine({
    db,
    tableRegistry: SYNC_TABLE_REGISTRY,
    mutationRegistry: APP_MUTATIONS,
    getMutationEnv: () => mutationEnv(args),
    getClientId: () => args.auth.getDeviceId() ?? args.databaseName,
    bootQueries: BOOT_QUERIES.map((name) => ({ name, params: {} })),
    postQuery: (request) =>
      postAppQuery({
        ...args,
        request,
      }),
    postMutations: (mutations) =>
      postMutationBatch({
        ...args,
        mutations,
      }),
    isAuthRevoked: (error) =>
      error instanceof SyncApiAuthError && error.reason === 'revoked',
    deleteDatabase: () => SQLite.deleteDatabaseAsync(args.databaseName),
  });
}
