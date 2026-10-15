import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import { createDeadlineFetch } from '@pkgs/http-client-shared/deadline-fetch';
import { requestHref } from '@pkgs/http-client-shared/origin-href';
import type { ClientEnv } from './client-env';
import type { ClientPubSubArgs } from './create-client-pubsub';
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
  const availability = originAvailabilityFor(source);
  const server = createOfflineHttp(
    offline,
    createDeadlineFetch({
      fetch: source.server,
      timers: source.timers,
      onTimeout: (input) => {
        if (availability.matchesOrigin(requestHref(input)))
          availability.noteNetworkFailure();
      },
    })
  );
  const env: ClientEnv = {
    ...source,
    server,
    get events() {
      return (events ??= createOfflinePubSub(offline, () => source.events));
    },
    createPubSub: (args) => configuredOfflinePubSub(source, offline, args),
    room: (args) =>
      createOfflineRoomTransport(offline, () => source.room(args)),
    network: createOfflineNetworkState(offline, source.network),
    audio: createOfflineAudioPlayback(offline, source.audio),
    createAuthClient: () =>
      (auth ??= createOfflineAuthClient(
        offline,
        source.createAuthClient(server),
        () => originAvailabilityFor(source).getSnapshot().phase === 'available'
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

/** Preserve null so sync can try again after client_config supplies the URL. */
function configuredOfflinePubSub(
  source: ClientEnv,
  offline: OfflineNetworkController,
  args: ClientPubSubArgs
) {
  const open = () => source.createPubSub(args);
  if (offline.isOffline()) {
    return args.url.length === 0 ? null : createOfflinePubSub(offline, open);
  }
  const initial = open();
  return initial === null ? null : createOfflinePubSub(offline, open, initial);
}
