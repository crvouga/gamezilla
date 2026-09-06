// @io-wall-ok — browser / production ClientEnv composition root.
/**
 * Production / localhost `ClientEnv` built from browser APIs only. Call only
 * from `main.tsx` (or another wall composition root); sims and tests build
 * their own env (`tests/support/sim-client-env.ts`).
 */

import { apiUrlToRoomWebSocketUrl } from '@libs/spaces/public/room/space-room-url';
import { oauthClientCallbackUrl } from '@pkgs/auth/shared/oauth-client-callback-url';
import { wallClock, wallTimers } from '@pkgs/clock/wall';
import {
  wallWebClipboard,
  wallWebNetworkStatePort,
} from '@pkgs/device/wall-web-device';
import { gateFetchUntilAvailable } from '@pkgs/http-client/gate-fetch-until-available';
import { createHealthOriginAvailability } from '@pkgs/http-client/origin-availability';
import { KvImplWeb } from '@pkgs/kv-web/impl-kv-web';
import { createBrowserObjectStore } from '@pkgs/object-store-opfs/wall-browser-fs';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import { createInMemoryPubSub } from '@pkgs/pubsub/in-memory';
import { WebSocketRoomTransport } from '@pkgs/room-adapter-web';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createWebSecureStorage } from '@pkgs/secure-storage-web';
import { createWebAudioPlaybackPort } from '@pkgs/sounds/audio-playback/web-audio-playback-port';

import { getServerBaseUrl } from './api-url';
import { createSecureStoreAuthClientStorage } from './auth-client-storage';
import {
  type ClientEnv,
  type CreateRoomTransport,
  createNoopDevMenuPort,
} from './client-env';
import { setOriginAvailability } from './origin-availability-for-env';
import {
  getMainSqliteDbName,
  openMainSqlClient,
} from './storage/open-main-sql-client';
import { createWallOpenAuthSession } from './wall-open-auth-session';

const OBJECT_STORE_BASE_DIR = 'object-store';

function mintWallSeed(): bigint {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  return n === 0n ? 1n : n;
}

function apiHealthUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/api/health`;
}

/** Browser `location.origin` when present. */
function readBrowserOrigin(): string | undefined {
  const loc = (globalThis as { location?: { origin?: unknown } }).location;
  if (loc === undefined || typeof loc.origin !== 'string') return undefined;
  const origin = loc.origin.trim();
  return origin.length > 0 ? origin : undefined;
}

const createWallRoomTransport: CreateRoomTransport = (args) => {
  const topic = `space:${args.spaceId}`;
  return new WebSocketRoomTransport({
    timers: args.timers,
    random: args.random,
    url: async () => {
      const token = await Promise.resolve(args.getSessionToken());
      return apiUrlToRoomWebSocketUrl({
        apiUrl: args.apiUrl,
        topic,
        sessionToken: token,
        installId: args.installId,
        clientId: args.clientId,
      });
    },
  });
};

export function wallClientEnv(args?: {
  readonly serverUrl?: string | undefined;
}): ClientEnv {
  const serverUrl = args?.serverUrl ?? getServerBaseUrl();
  const innerFetch = (input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, init);
  const availability = createHealthOriginAvailability({
    healthUrl: apiHealthUrl(serverUrl),
    fetch: innerFetch,
    timers: wallTimers,
    clock: wallClock,
  });
  const server = gateFetchUntilAvailable({ fetch: innerFetch, availability });
  const secureStorage = createSecureStorageStore(createWebSecureStorage());

  const env: ClientEnv = {
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    seed: mintWallSeed(),
    server,
    events: createInMemoryPubSub(),
    createPubSub: () => createInMemoryPubSub(),
    openSqlClient: (openArgs) =>
      openMainSqlClient(openArgs?.userId ?? 'pending', wallTimers),
    kv: new KvImplWeb(),
    authStorage: createSecureStoreAuthClientStorage(secureStorage),
    secureStorage,
    room: createWallRoomTransport,
    network: wallWebNetworkStatePort(),
    clipboard: wallWebClipboard(),
    audio: createWebAudioPlaybackPort(),
    devMenu: createNoopDevMenuPort(),
    objectStore: createBrowserObjectStore({ baseDir: OBJECT_STORE_BASE_DIR }),
    observability: createNoopObservability('gamezilla-client'),
    serverUrl,
    authBaseURL: serverUrl,
    authCallbackUrl: oauthClientCallbackUrl(readBrowserOrigin()),
    openAuthSession: createWallOpenAuthSession(wallTimers),
    resolveDatabaseName: ({ userId }) => getMainSqliteDbName(userId),
    mutationSuccessHoldMs: 900,
  };
  setOriginAvailability(env, availability);
  return env;
}
