import type { ConfigService } from '@libs/auth/client/config-service-types';
import { ClientConfigKey } from '@libs/client-config/shared/client-config-keys';
import { parseClientConfigRows } from '@libs/client-config/shared/parse-client-config';
import type { Timers } from '@pkgs/clock';
import type { PubSub } from '@pkgs/pubsub/interface';
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
 * Client composition root for EMQX MQTT.
 * `clientIdPrefix` is the stable MQTT client id (device id) so short offline
 * sessions can drain on reconnect.
 */
export function createClientPubSub(args: {
  readonly url: string;
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken: GetFreshAuthToken;
  readonly timers: Timers;
  readonly random: Random;
}): PubSub {
  const deviceId = args.auth.getDeviceId() ?? 'device';
  return createEmqxPubSub({
    url: args.url,
    clientIdPrefix: deviceId,
    timers: args.timers,
    random: args.random,
    auth: async () =>
      fetchPubSubToken({
        config: args.config,
        fetchFn: args.fetchFn,
        auth: args.auth,
        getFreshAuthToken: args.getFreshAuthToken,
      }),
  });
}
