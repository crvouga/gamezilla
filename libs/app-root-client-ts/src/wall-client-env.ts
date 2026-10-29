import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { canSubscribeToTopic } from '@libs/sub-shared-ts/sync';
import {
  LOCAL_CALL_DEADLINE_MS,
  openMainSqlClient,
} from './open-main-sql-client';
// @io-wall-ok — browser / production ClientEnv composition root.
/**
 * Production / localhost `ClientEnv` built from browser APIs only. Call only
 * from `main.tsx` (or another wall composition root); harnesses and tests build
 * their own env (`tests/support/harness-client-env.ts`).
 */

import { getServerBaseUrl } from '@libs/app-root-shared-ts/api-url';
import {
  createAppBearerTokenStore,
  createSecureStoreAuthClientStorage,
} from '@libs/app-root-shared-ts/auth-client-storage';
import { getMainSqliteDbName } from '@libs/app-root-shared-ts/main-sqlite-db-name';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import { oauthClientCallbackUrl } from '@pkgs/auth-inhouse-shared-ts/oauth-client-callback-url';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import {
  wallWebClipboard,
  wallWebHaptics,
  wallWebNetworkStatePort,
} from '@pkgs/device-client-ts/wall-web-device';
import { createHealthOriginAvailability } from '@pkgs/http-client-shared-ts/origin-availability';
import { createOriginAwareFetch } from '@pkgs/http-client-shared-ts/origin-aware-fetch';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { KvImplWeb } from '@pkgs/kv-web-client-ts/impl-kv-web';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { createBrowserObjectStore } from '@pkgs/object-store-opfs-client-ts/wall-browser-fs';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared-ts/in-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { createWebSecureStorage } from '@pkgs/secure-storage-web-client-ts/impl-web';
import { createWebAudioPlaybackPort } from '@pkgs/sounds-shared-ts/web-audio-playback-port';
import {
  pendingInteractionRequestTraceparent,
  runInInteractionRequestContext,
} from '@pkgs/sync-engine-shared-ts/interaction-correlation';
import type { ClientEnv, CreateRoomTransport } from './client-env';
import { createNoopDevMenuPort } from './client-env';
import { createClientPubSub } from './create-client-pubsub';
import type { OfflineNetworkController } from './offline-network-controller';
import { createOfflineHttp, offlineNetworkError } from './offline-network-http';
import { setOriginAvailability } from './origin-availability-for-env';
import { webDevicePorts } from './test-device-ports';
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

/** The browser's id mint, for roots that run before a client env exists. */
export const wallCreateId = (): string => crypto.randomUUID();

export type WallClientEnvArgs = {
  readonly serverUrl?: string | undefined;
  readonly offline: OfflineNetworkController;
  /** Hosts without browser persistence provide their own object-store port. */
  readonly objectStore?: ClientEnv['objectStore'];
  /**
   * Whoever owns rooms supplies the transport. The shell knows a client may
   * open one; it does not know a room is a space.
   */
  readonly room: CreateRoomTransport;
};

function wallFetch(input: RequestInfo | URL, init?: RequestInit) {
  const traceparent = pendingInteractionRequestTraceparent();
  if (traceparent === undefined) return globalThis.fetch(input, init);
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined
  );
  for (const [key, value] of new Headers(init?.headers)) {
    headers.set(key, value);
  }
  if (!headers.has('traceparent')) headers.set('traceparent', traceparent);
  const run = () => globalThis.fetch(input, { ...init, headers });
  return runInInteractionRequestContext(traceparent, run);
}

/** Browser HTTP adapter governed by the tab's shared kill switch. */
export function createWallOfflineHttp(
  offline: OfflineNetworkController
): HttpClient {
  return { fetch: createOfflineHttp(offline, wallFetch) };
}

export function wallClientEnv(args: WallClientEnvArgs): ClientEnv {
  const serverUrl = args.serverUrl ?? getServerBaseUrl();
  const innerFetch = createOfflineHttp(args.offline, wallFetch);
  const availability = createHealthOriginAvailability({
    healthUrl: apiHealthUrl(serverUrl),
    fetch: innerFetch,
    timers: wallTimers,
    clock: wallClock,
  });
  const server = createOriginAwareFetch({ fetch: innerFetch, availability });
  const secureStorage = createSecureStorageStore(createWebSecureStorage());
  const pubsubLogger = createLogger({ name: 'pubsub', now: wallClock.now });

  const env: ClientEnv = {
    ...webDevicePorts(
      createWebAudioPlaybackPort({ fetch: innerFetch, now: wallClock.now })
    ),
    clock: wallClock,
    timers: wallTimers,
    createId: wallCreateId,
    random: () => Math.random(),
    seed: mintWallSeed(),
    server,
    events: createInMemoryPubSub({ logger: pubsubLogger }),
    createPubSub: (options) =>
      options.url.length === 0 ? null : createClientPubSub(options),
    canSubscribe: canSubscribeToTopic,
    openSqlClient: async (openArgs) => {
      return openMainSqlClient(
        openArgs?.userId ?? 'pending',
        wallTimers,
        createLogger({ name: 'sqlite-web', now: wallClock.now })
      );
    },
    localCallDeadlineMs: LOCAL_CALL_DEADLINE_MS,
    kv: new KvImplWeb(),
    secureStorage,
    room: args.room,
    network: wallWebNetworkStatePort(),
    clipboard: wallWebClipboard(),
    haptics: wallWebHaptics(),
    devMenu: createNoopDevMenuPort(),
    objectStore:
      args.objectStore ??
      createBrowserObjectStore({ baseDir: OBJECT_STORE_BASE_DIR }),
    serverUrl,
    // The in-house IdP, reached on the API origin through same-tab navigation.
    createAuthClient: (http) =>
      createInhouseAuthClient({
        baseURL: serverUrl,
        clock: wallClock,
        timers: wallTimers,
        fetch: http,
        bearerStore: createAppBearerTokenStore(
          createSecureStoreAuthClientStorage(secureStorage)
        ),
        openAuthSession: (authorizationUrl, callbackUrl) => {
          if (args.offline.isOffline())
            return Promise.reject(offlineNetworkError());
          return createWallOpenAuthSession()(authorizationUrl, callbackUrl);
        },
        callbackUrl: oauthClientCallbackUrl(
          readBrowserOrigin(),
          PRODUCT.external.deepLinkScheme
        ),
      }),
    openExternalUrl: (url) => {
      window.location.assign(url);
      return Promise.resolve();
    },
    resolveDatabaseName: ({ userId }) => getMainSqliteDbName(userId),
    mutationSuccessHoldMs: 900,
    moderation: shippedModerationRules(),
  };
  setOriginAvailability(env, availability);
  return env;
}
