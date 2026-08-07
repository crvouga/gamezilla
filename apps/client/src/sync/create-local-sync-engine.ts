import type { ConfigService } from '@libs/auth/client/config-service-types';
import {
  appSchema,
  LOCAL_DOMAIN_TABLE_NAMES,
} from '@libs/db/shared/app-schema';
import type { AppChannelsCtx } from '@libs/db/shared/sync-topics';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  createLocalSyncEngine,
  type SyncEngine,
} from '@pkgs/sync-engine/client';
import * as SQLite from 'expo-sqlite';

import { deleteLegacySidecarDb } from '../storage/delete-legacy-sidecar-db';
import { openMainSqlClient } from '../storage/open-main-sql-client';
import { APP_MUTATIONS } from './app-mutations';
import { APP_QUERIES } from './app-queries';
import { createAppSyncLifecycle } from './app-sync-lifecycle';
import { tryCreateClientPubSub } from './create-client-pubsub';
import {
  type GetFreshAuthToken,
  postAppQueries,
  postMutationBatch,
  SyncApiAuthError,
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
    WHERE ended_at IS NULL
      AND (
        host_member_id = ${actorId}
        OR host_account_id = ${actorId}
        OR id IN (
          SELECT space_id FROM space_users WHERE user_id = ${actorId}
        )
      )
  `);
  return rows.map((row) => row.id).filter((id) => id.length > 0);
}

function membershipKey(ids: readonly string[]): string {
  return [...ids].sort().join('\0');
}

function bootQuerySpecs() {
  return BOOT_QUERIES.map((name) => ({
    name,
    params: {},
  }));
}

function createMembershipChannels(args: {
  readonly db: SqlClient;
  readonly auth: SyncClientAuth;
  readonly userId: string;
}): {
  readonly getChannelsCtx: () => AppChannelsCtx;
  readonly onBindTopicRefresh: (refresh: () => void) => void;
} {
  let membershipCache: string[] = [];
  let topicRefresh: (() => void) | null = null;
  return {
    onBindTopicRefresh: (refresh) => {
      topicRefresh = refresh;
    },
    getChannelsCtx: () => {
      const actorId = args.auth.getAccountId() ?? args.userId;
      void loadMembershipSpaceIds(args.db, actorId).then((ids) => {
        if (membershipKey(ids) === membershipKey(membershipCache)) return;
        membershipCache = ids;
        topicRefresh?.();
      });
      return { actorId, membershipSpaceIds: membershipCache };
    },
  };
}

function nudgeOptions(
  args: CreateAppLocalSyncEngineArgs,
  channels: ReturnType<typeof createMembershipChannels>
) {
  const raw = process.env['EXPO_PUBLIC_EMQX_WSS_URL']?.trim() ?? '';
  const enabled = raw.length > 0;
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
      getChannelsCtx: channels.getChannelsCtx,
      onBindTopicRefresh: channels.onBindTopicRefresh,
    },
  };
}

/** Opens the identity DB and builds the nudge-driven local sync engine. */
export async function createAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  await deleteLegacySidecarDb(args.databaseName);
  const db = await openMainSqlClient(args.userId);
  // Membership loads after migrateLocalSchema (inside createLocalSyncEngine);
  // querying `spaces` before migrate fails on a fresh DB.
  const channels = createMembershipChannels({
    db,
    auth: args.auth,
    userId: args.userId,
  });

  return createLocalSyncEngine({
    db,
    localSchema: {
      domainSchema: appSchema,
      cacheTableNames: LOCAL_DOMAIN_TABLE_NAMES,
    },
    mutationRegistry: APP_MUTATIONS,
    getMutationEnv: () => mutationEnv(args),
    getClientId: () => args.auth.getDeviceId() ?? args.databaseName,
    bootQueries: bootQuerySpecs(),
    postQueries: (requests) => postAppQueries({ ...args, requests }),
    postMutations: (mutations) => postMutationBatch({ ...args, mutations }),
    isAuthRevoked: (error) =>
      error instanceof SyncApiAuthError && error.reason === 'revoked',
    deleteDatabase: () => SQLite.deleteDatabaseAsync(args.databaseName),
    lifecycle: createAppSyncLifecycle(),
    ...nudgeOptions(args, channels),
  });
}
