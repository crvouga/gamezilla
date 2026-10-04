/**
 * `harnessClientEnv()` — deterministic `ClientEnv` for shell tests and harness hosts:
 * `@pkgs/harness-shared` virtual clock / timers / ids, in-memory kv / secure storage /
 * pubsub / object store / network / audio, mockingbird-sqlite local database and a
 * stub product API (`harness-server-fetch.ts`). No wall I/O.
 */

import { createSecureStoreAuthClientStorage } from '@libs/app-shared/auth-client-storage';
import type { ClientEnv } from '@libs/app-client/client-env';
import { createInMemoryClientPorts } from '@libs/app-client/in-memory-client-ports';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client/create-inhouse-auth-client';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-shared/virtual-time-runtime';
import { KvImplInMemory } from '@pkgs/kv-shared/impl-in-memory';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { createInMemoryPubSub } from '@pkgs/pubsub-shared/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-shared/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-shared/secure-storage-store';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';

import { createHarnessServerFetch } from './harness-server-fetch';

export const HARNESS_SERVER_URL = 'https://harness-api.invalid';

export type HarnessClientEnvOptions = {
  readonly seed?: number | bigint | string | undefined;
  readonly serverUrl?: string | undefined;
};

export type HarnessClientEnv = {
  readonly env: ClientEnv;
  /** Virtual-time session: `advanceTime(ms)` / `waitForIdle()` drive timers. */
  readonly session: Session;
  /** Request paths the shell sent to the stub API, in order. */
  readonly requests: readonly string[];
  readonly dispose: () => Promise<void>;
};

function seedToBigInt(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint') return seed;
  if (typeof seed === 'number') return BigInt(Math.trunc(seed));
  let hash = 0n;
  for (const ch of seed)
    hash = (hash * 31n + BigInt(ch.codePointAt(0) ?? 0)) & 0xffffffffffffn;
  return hash === 0n ? 1n : hash;
}

export async function harnessClientEnv(
  options?: HarnessClientEnvOptions
): Promise<HarnessClientEnv> {
  const seed = options?.seed ?? 1;
  const serverUrl = options?.serverUrl ?? HARNESS_SERVER_URL;
  const session = await virtualTimeRuntime().open(seed);
  const { clock, timers } = session.ports;
  const server = createHarnessServerFetch(serverUrl);
  const secureStorage = createSecureStorageStore(createInMemorySecureStorage());
  const sqlClients: SqlClientImplMockingbirdSqlite[] = [];

  const env: ClientEnv = {
    clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed: seedToBigInt(seed),
    server: server.fetch,
    events: createInMemoryPubSub({ logger: createNoopLogger() }),
    createPubSub: () => createInMemoryPubSub({ logger: createNoopLogger() }),
    openSqlClient: async () => {
      const client = SqlClientImplMockingbirdSqlite.open({
        seed: 1,
        now: () => new Date(clock.now()),
      });
      await client.connect();
      sqlClients.push(client);
      return client;
    },
    kv: new KvImplInMemory(),
    secureStorage,
    room: () => {
      throw new Error(
        'harnessClientEnv: room transport not available in shell tests'
      );
    },
    ...createInMemoryClientPorts(),
    serverUrl,
    createAuthClient: () =>
      createInhouseAuthClient({
        baseURL: serverUrl,
        clock,
        timers,
        fetch: server.fetch,
        storage: createSecureStoreAuthClientStorage(secureStorage),
        openAuthSession: () => Promise.resolve({ type: 'cancel' }),
        callbackUrl: `${serverUrl}/sso-callback`,
      }),
    openExternalUrl: () => Promise.resolve(),
    resolveDatabaseName: ({ userId }) => `harness_client_${userId}`,
    mutationSuccessHoldMs: 0,
  };

  return {
    env,
    session,
    requests: server.requests,
    dispose: async () => {
      for (const client of sqlClients) await client.disconnect();
      await session.dispose();
    },
  };
}
