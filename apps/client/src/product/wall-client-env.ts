// @io-wall-ok — Expo / production ClientEnv composition root.

import { getServerBaseUrl } from '@apps/client/config/api-servers';
import { createExpoDevMenuPort } from '@apps/client/device/expo-dev-menu-port';
import { createExpoNetworkStatePort } from '@apps/client/device/expo-network-state-port';
import {
  getMainSqliteDbName,
  openMainSqlClient,
} from '@apps/client/storage/open-main-sql-client';
import { WebSocketRoomTransportFactory } from '@libs/spaces/root/client/room/room-transport-factory';
import type { AuthClientStorage } from '@pkgs/auth-better-auth/client';
import { wallClock, wallTimers } from '@pkgs/clock';
import {
  createHealthOriginAvailability,
  gateFetchUntilAvailable,
} from '@pkgs/http-client';
import { KvPlatform } from '@pkgs/kv/kv-platform';
import { createNoopObservability } from '@pkgs/observability/impl-noop/impl-noop';
import { createInMemoryPubSub } from '@pkgs/pubsub/testing/in-memory';
import { createSecureStorage } from '@pkgs/secure-storage/create';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { createExpoAudioPlaybackPort } from '@pkgs/sounds/audio-playback/expo-audio-playback-port';
import * as SecureStore from 'expo-secure-store';

import type { ClientEnv } from './client-env';
import { setOriginAvailability } from './origin-availability-for-env';

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

/**
 * Production / localhost ClientEnv. Call only from Expo / wall composition roots.
 */
export function wallClientEnv(args?: {
  readonly serverUrl?: string;
}): ClientEnv {
  const serverUrl = args?.serverUrl ?? getServerBaseUrl();
  const createId = () => crypto.randomUUID();
  const innerFetch = (input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, init);
  const availability = createHealthOriginAvailability({
    healthUrl: apiHealthUrl(serverUrl),
    fetch: innerFetch,
    timers: wallTimers,
    clock: wallClock,
  });
  const server: ClientEnv['server'] = (input, init) =>
    gateFetchUntilAvailable({
      fetch: innerFetch,
      availability,
    })(input, init);

  const env: ClientEnv = {
    clock: wallClock,
    timers: wallTimers,
    createId,
    random: () => Math.random(),
    seed: mintWallSeed(),
    server,
    events: createInMemoryPubSub(),
    openSqlClient: async (openArgs) => {
      const userId = openArgs?.userId ?? 'pending';
      return openMainSqlClient(userId, createId, wallTimers);
    },
    kv: new KvPlatform(),
    authStorage: SecureStore as AuthClientStorage,
    secureStorage: createSecureStorageStore(createSecureStorage()),
    room: (roomArgs) =>
      new WebSocketRoomTransportFactory(
        roomArgs.timers,
        roomArgs.random
      ).create(roomArgs),
    network: createExpoNetworkStatePort(),
    audio: createExpoAudioPlaybackPort(),
    devMenu: createExpoDevMenuPort(),
    observability: createNoopObservability('gamezilla-client'),
    serverUrl,
    authBaseURL: serverUrl,
    resolveDatabaseName: ({ userId }) => getMainSqliteDbName(userId, createId),
  };
  setOriginAvailability(env, availability);
  return env;
}
