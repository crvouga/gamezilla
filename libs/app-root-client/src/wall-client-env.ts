// @io-wall-ok — browser / production ClientEnv composition root.
/**
 * Production / localhost `ClientEnv` built from browser APIs only. Call only
 * from `main.tsx` (or another wall composition root); harnesses and tests build
 * their own env (`tests/support/harness-client-env.ts`).
 */

import { getServerBaseUrl } from '@libs/app-root-shared/api-url';
import { createSecureStoreAuthClientStorage } from '@libs/app-root-shared/auth-client-storage';
import { getMainSqliteDbName } from '@libs/app-root-shared/main-sqlite-db-name';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client/create-inhouse-auth-client';
import { oauthClientCallbackUrl } from '@pkgs/auth-inhouse-shared/oauth-client-callback-url';
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import {
  wallWebClipboard,
  wallWebHaptics,
  wallWebNetworkStatePort,
} from '@pkgs/device-client/wall-web-device';
import { gateFetchUntilAvailable } from '@pkgs/http-client-shared/gate-fetch-until-available';
import { createHealthOriginAvailability } from '@pkgs/http-client-shared/origin-availability';
import { KvImplWeb } from '@pkgs/kv-web-client/impl-kv-web';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createBrowserObjectStore } from '@pkgs/object-store-opfs-client/wall-browser-fs';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared/in-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import { createWebSecureStorage } from '@pkgs/secure-storage-web-client/impl-web';
import { createWebAudioPlaybackPort } from '@pkgs/sounds-shared/web-audio-playback-port';
import {
  pendingInteractionRequestTraceparent,
  runInInteractionRequestContext,
} from '@pkgs/sync-engine-shared/interaction-correlation';
import type { ClientEnv, CreateRoomTransport } from './client-env';
import { createNoopDevMenuPort } from './client-env';
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

export type WallClientEnvArgs = {
  readonly serverUrl?: string | undefined;
  /**
   * Whoever owns rooms supplies the transport. The shell knows a client may
   * open one; it does not know a room is a space.
   */
  readonly room: CreateRoomTransport;
};

export function wallClientEnv(args: WallClientEnvArgs): ClientEnv {
  const serverUrl = args.serverUrl ?? getServerBaseUrl();
  const innerFetch = (input: RequestInfo | URL, init?: RequestInit) => {
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
  };
  const availability = createHealthOriginAvailability({
    healthUrl: apiHealthUrl(serverUrl),
    fetch: innerFetch,
    timers: wallTimers,
    clock: wallClock,
  });
  const server = gateFetchUntilAvailable({ fetch: innerFetch, availability });
  const secureStorage = createSecureStorageStore(createWebSecureStorage());
  const pubsubLogger = createLogger({ name: 'pubsub', now: wallClock.now });

  const env: ClientEnv = {
    ...webDevicePorts(createWebAudioPlaybackPort()),
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    seed: mintWallSeed(),
    server,
    events: createInMemoryPubSub({ logger: pubsubLogger }),
    createPubSub: () => createInMemoryPubSub({ logger: pubsubLogger }),
    // Dynamic: keeps the web SQLite client (worker transport, OPFS recovery)
    // off first load; it is only needed once the sync engine opens.
    openSqlClient: async (openArgs) => {
      const { openMainSqlClient } = await import('./open-main-sql-client');
      return openMainSqlClient(
        openArgs?.userId ?? 'pending',
        wallTimers,
        createLogger({ name: 'sqlite-web', now: wallClock.now })
      );
    },
    kv: new KvImplWeb(),
    secureStorage,
    room: args.room,
    network: wallWebNetworkStatePort(),
    clipboard: wallWebClipboard(),
    haptics: wallWebHaptics(),
    devMenu: createNoopDevMenuPort(),
    objectStore: createBrowserObjectStore({ baseDir: OBJECT_STORE_BASE_DIR }),
    serverUrl,
    // The in-house IdP, reached on the API origin through same-tab navigation.
    createAuthClient: () =>
      createInhouseAuthClient({
        baseURL: serverUrl,
        clock: wallClock,
        timers: wallTimers,
        fetch: server,
        storage: createSecureStoreAuthClientStorage(secureStorage),
        openAuthSession: createWallOpenAuthSession(),
        callbackUrl: oauthClientCallbackUrl(readBrowserOrigin()),
      }),
    openExternalUrl: (url) => {
      window.location.assign(url);
      return Promise.resolve();
    },
    resolveDatabaseName: ({ userId }) => getMainSqliteDbName(userId),
    mutationSuccessHoldMs: 900,
  };
  setOriginAvailability(env, availability);
  return env;
}
