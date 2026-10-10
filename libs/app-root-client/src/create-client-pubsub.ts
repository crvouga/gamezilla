import { ClientConfigKey } from '@libs/app-config-shared/client-config-keys';
import { parseClientConfigRows } from '@libs/app-config-shared/parse-client-config';
import type { ConfigService } from '@libs/auth-shared/config-service-types';
import type { Timers } from '@pkgs/clock-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';
import { createAedesPubSub } from '@pkgs/pubsub-aedes-shared/create-aedes-pubsub';
import { createEmqxPubSub } from '@pkgs/pubsub-emqx-shared/create-emqx-pubsub';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import { iotWireTopic } from '@pkgs/pubsub-root-shared/wire-topic';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type {
  GetFreshAuthToken,
  SyncClientAuth,
} from '@pkgs/sync-engine-client/sync-http-client';
import type { Random } from '@pkgs/uuid-shared/create-id';
import { fetchPubSubToken } from './pubsub-token';
import type { SyncApiFetch } from './sync-api';

export async function readEmqxWssUrlFromLocalDb(
  db: SqlClient
): Promise<string | null> {
  const rows = await db.query(sql<{
    id: string;
    value: unknown;
    deleted_at: string | null;
  }>`
    SELECT id, value, deleted_at
    FROM client_config
    WHERE id = ${ClientConfigKey.emqxWssUrl}
      AND deleted_at IS NULL
    LIMIT 1
  `);
  const config = parseClientConfigRows(rows);
  const url = config.emqx_wss_url?.trim() ?? '';
  return url.length > 0 ? url : null;
}

/**
 * Client composition root for MQTT pub/sub. Loopback `ws:` brokers keep
 * colon topics (Aedes, MQTT 3.1.1). `wss:` is AWS IoT: MQTT 5, and colon
 * topics are mapped to slash topics only on that path.
 */
type SyncPubSubArgs = {
  readonly url: string;
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken: GetFreshAuthToken;
  readonly timers: Timers;
  readonly random: Random;
  readonly logger: Logger;
};

export type ClientPubSubArgs = SyncPubSubArgs | ObservationPubSubArgs;

export function createClientPubSub(args: ClientPubSubArgs): PubSub {
  if ('clientIdPrefix' in args) return createObservationPubSub(args);
  const deviceId = args.auth.getDeviceId() ?? 'device';
  const loopback = args.url.startsWith('ws:');
  const createPubSub = loopback ? createAedesPubSub : createEmqxPubSub;
  return createPubSub({
    url: args.url,
    clientIdPrefix: deviceId,
    timers: args.timers,
    protocolVersion: args.url.startsWith('ws://') ? 4 : 5,
    random: args.random,
    logger: args.logger,
    ...(args.url.startsWith('wss:') ? { toWireTopic: iotWireTopic } : {}),
    auth: async () =>
      fetchPubSubToken({
        config: args.config,
        fetchFn: args.fetchFn,
        auth: args.auth,
        getFreshAuthToken: args.getFreshAuthToken,
      }),
  });
}

export type ObservationPubSubArgs = {
  url: string;
  clientIdPrefix: string;
  timers: Timers;
  random: Random;
  logger: Logger;
  auth: () => Promise<{ username: string; password: string }>;
};

export function createObservationPubSub(input: ObservationPubSubArgs) {
  const createPubSub = input.url.startsWith('ws:')
    ? createAedesPubSub
    : createEmqxPubSub;
  return createPubSub({
    ...input,
    protocolVersion: input.url.startsWith('ws:') ? 4 : 5,
    ...(input.url.startsWith('wss:') ? { toWireTopic: iotWireTopic } : {}),
  });
}
