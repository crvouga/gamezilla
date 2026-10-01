import type { ConfigService } from '@libs/auth/public/config-service-types';
import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import { parseClientConfigRows } from '@libs/client-config/public/parse-client-config';
import type { Timers } from '@pkgs/clock';
import type { Logger } from '@pkgs/logger';
import type { PubSub } from '@pkgs/pubsub/interface';
import { iotWireTopic } from '@pkgs/pubsub/iot';
import { createAedesPubSub } from '@pkgs/pubsub-aedes/create-aedes-pubsub';
import { createEmqxPubSub } from '@pkgs/pubsub-emqx/create-emqx-pubsub';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Random } from '@pkgs/uuid';
import { fetchPubSubToken } from './pubsub-token';
import type {
  GetFreshAuthToken,
  SyncApiFetch,
  SyncClientAuth,
} from './sync-api';

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
export function createClientPubSub(args: {
  readonly url: string;
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken: GetFreshAuthToken;
  readonly timers: Timers;
  readonly random: Random;
  readonly logger: Logger;
}): PubSub {
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
