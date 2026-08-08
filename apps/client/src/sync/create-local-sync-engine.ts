import type { ConfigService } from '@libs/auth/client/config-service-types';
import {
  appSchema,
  LOCAL_DOMAIN_TABLE_NAMES,
} from '@libs/db/shared/app-schema';
import {
  appDefaultEntryChannel,
  appTopicMap,
} from '@libs/db/shared/app-topic-map';
import type { AppChannelsCtx } from '@libs/db/shared/sync-topics';
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

/** Session queries held for the engine lifetime (paint gate waits on all). */
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
  'inboxActive',
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

function sessionQuerySpecs() {
  return SESSION_QUERIES.map((name) => ({
    name,
    params: {},
  }));
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
    onBindTopicRefresh: () => {
      // Held-row refresh is driven by the local table-change bus.
    },
    getChannelsCtx: () => ({
      actorId: args.auth.getAccountId() ?? args.userId,
    }),
  };
}

function pushOptions(
  args: CreateAppLocalSyncEngineArgs,
  pushCtx: ReturnType<typeof createMembershipChannels>
) {
  const raw = process.env['EXPO_PUBLIC_EMQX_WSS_URL']?.trim() ?? '';
  const enabled = raw.length > 0;
  if (!enabled) return {};
  return {
    push: {
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
      getChannelsCtx: pushCtx.getChannelsCtx,
      onBindTopicRefresh: pushCtx.onBindTopicRefresh,
      rowImageFanout: true,
      topicMap: appTopicMap,
      defaultEntryChannel: appDefaultEntryChannel,
    },
  };
}

/** Opens the identity DB and builds the push-driven local sync engine. */
export async function createAppLocalSyncEngine(
  args: CreateAppLocalSyncEngineArgs
): Promise<SyncEngine> {
  await deleteLegacySidecarDb(args.databaseName);
  const db = await openMainSqlClient(args.userId);
  const pushCtx = createMembershipChannels({
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
    sessionQueries: sessionQuerySpecs(),
    postQueries: (requests) => postAppQueries({ ...args, requests }),
    postMutations: (mutations) => postMutationBatch({ ...args, mutations }),
    isAuthRevoked: (error) =>
      error instanceof SyncApiAuthError && error.reason === 'revoked',
    deleteDatabase: () => SQLite.deleteDatabaseAsync(args.databaseName),
    lifecycle: createAppSyncLifecycle(),
    ...pushOptions(args, pushCtx),
  });
}
