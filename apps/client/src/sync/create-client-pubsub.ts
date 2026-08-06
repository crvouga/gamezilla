import type { PubSub } from '@pkgs/pubsub/interface';
import { createEmqxPubSub } from '@pkgs/pubsub-emqx/create-emqx-pubsub';

import type { ConfigService } from '@libs/auth/client/config-service-types';
import type {
  GetFreshAuthToken,
  SyncApiFetch,
  SyncClientAuth,
} from './sync-api';
import { fetchPubSubToken } from './pubsub-token';

/**
 * Client composition root for EMQX MQTT. Returns null when
 * EXPO_PUBLIC_EMQX_WSS_URL is unset (poll-only).
 */
export function tryCreateClientPubSub(args: {
  readonly config: ConfigService;
  readonly fetchFn: SyncApiFetch;
  readonly auth: SyncClientAuth;
  readonly getFreshAuthToken: GetFreshAuthToken;
}): PubSub | null {
  const url = process.env['EXPO_PUBLIC_EMQX_WSS_URL']?.trim() ?? '';
  if (url.length === 0) return null;
  const deviceId = args.auth.getDeviceId() ?? 'device';
  return createEmqxPubSub({
    url,
    clientIdPrefix: deviceId,
    auth: async () =>
      fetchPubSubToken({
        config: args.config,
        fetchFn: args.fetchFn,
        auth: args.auth,
        getFreshAuthToken: args.getFreshAuthToken,
      }),
  });
}
