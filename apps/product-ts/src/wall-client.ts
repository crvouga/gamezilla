// @io-wall-ok — product browser composition root.
import type { ClientEnv } from '@libs/app-root-client-ts/client-env';
import type { OfflineNetworkController } from '@libs/app-root-client-ts/offline-network-controller';
import { wallClientEnv } from '@libs/app-root-client-ts/wall-client-env';
import { wallSpaceRoomTransport } from '@libs/spaces-client-ts/wall-room-transport';
import { browserPreviewOrigin } from '@pkgs/workspace-preview-client-ts/browser-origin';
import { browserPreviewHttp } from '@pkgs/workspace-preview-client-ts/http';
import { browserPreviewUrl } from '@pkgs/workspace-preview-client-ts/url';

export function productWallClientEnv(
  offline: OfflineNetworkController
): ClientEnv {
  const origin = import.meta.env.DEV ? browserPreviewOrigin() : null;
  const http = {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init),
  };
  const env = wallClientEnv({
    room: wallSpaceRoomTransport,
    offline,
    serverUrl: origin ?? undefined,
    http: origin === null ? http : browserPreviewHttp(http),
  });
  if (origin === null) return env;
  const pubsub = env.createPubSub;
  const open = env.openExternalUrl;
  const preview: Pick<ClientEnv, 'createPubSub' | 'openExternalUrl'> = {
    createPubSub: (options) =>
      pubsub({ ...options, url: browserPreviewUrl(options.url) }),
    openExternalUrl: (url) => open(browserPreviewUrl(url)),
  };
  // Keep the identity registered with the shared HTTP health gate.
  return Object.assign(env, preview);
}
