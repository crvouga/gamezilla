import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import type { ClientEnv } from './client-env';
import { createOfflineAuthClient } from './offline-auth-client';
import { createOfflineAudioPlayback } from './offline-network-audio';
import {
  createOfflineNetworkController,
  type OfflineNetworkController,
} from './offline-network-controller';
import { createOfflineHttp, offlineNetworkError } from './offline-network-http';
import {
  createOfflinePubSub,
  createOfflineRoomTransport,
} from './offline-network-realtime';
import {
  createOfflineNetworkState,
  createOfflineOriginAvailability,
} from './offline-network-state';
import {
  originAvailabilityFor,
  setOriginAvailability,
} from './origin-availability-for-env';

export type OfflineClientEnv = {
  readonly env: ClientEnv;
  readonly offline: OfflineNetworkController;
};

/** Replaces every client network-capable port with the voluntary-offline gate. */
export function createOfflineClientEnv(
  source: ClientEnv,
  controller?: OfflineNetworkController
): OfflineClientEnv {
  const offline = controller ?? createOfflineNetworkController(source.kv);
  let auth: AuthClientPort | null = null;
  let events: ClientEnv['events'] | null = null;
  const server = createOfflineHttp(offline, source.server);
  const env: ClientEnv = {
    ...source,
    server,
    get events() {
      return (events ??= createOfflinePubSub(offline, () => source.events));
    },
    createPubSub: (args) =>
      createOfflinePubSub(offline, () => source.createPubSub(args)),
    room: (args) =>
      createOfflineRoomTransport(offline, () => source.room(args)),
    network: createOfflineNetworkState(offline, source.network),
    audio: createOfflineAudioPlayback(offline, source.audio),
    createAuthClient: () =>
      (auth ??= createOfflineAuthClient(
        offline,
        source.createAuthClient(server)
      )),
    openExternalUrl: async (url) => {
      if (offline.isOffline()) throw offlineNetworkError();
      await source.openExternalUrl(url);
    },
  };
  setOriginAvailability(
    env,
    createOfflineOriginAvailability(offline, originAvailabilityFor(source))
  );
  return { env, offline };
}
