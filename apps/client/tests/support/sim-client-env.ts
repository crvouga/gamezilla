/**
 * `simClientEnv()` — deterministic `ClientEnv` for shell tests and sim hosts:
 * `@pkgs/sim` virtual clock / timers / ids, in-memory kv / secure storage /
 * pubsub / object store / network / audio, mockingbird-sqlite local database and a
 * stub product API (`sim-server-fetch.ts`). No wall I/O.
 */

import { createSecureStoreAuthClientStorage } from '@apps/client/shell/auth-client-storage';
import type { ClientEnv } from '@apps/client/shell/client-env';
import { createInMemoryClientPorts } from '@apps/client/shell/in-memory-client-ports';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import { createInMemoryPubSub } from '@pkgs/pubsub/in-memory';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { type Session, virtualTimeRuntime } from '@pkgs/sim';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';

import { createSimServerFetch } from './sim-server-fetch';

export const SIM_SERVER_URL = 'https://sim-api.invalid';

export type SimClientEnvOptions = {
  readonly seed?: number | bigint | string | undefined;
  readonly serverUrl?: string | undefined;
};

export type SimClientEnv = {
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

export async function simClientEnv(
  options?: SimClientEnvOptions
): Promise<SimClientEnv> {
  const seed = options?.seed ?? 1;
  const serverUrl = options?.serverUrl ?? SIM_SERVER_URL;
  const session = await virtualTimeRuntime().open(seed);
  const { clock, timers } = session.ports;
  const server = createSimServerFetch(serverUrl);
  const secureStorage = createSecureStorageStore(createInMemorySecureStorage());
  const sqlClients: SqlClientImplMockingbirdSqlite[] = [];

  const env: ClientEnv = {
    clock,
    timers,
    createId: session.ports.createId,
    random: session.ports.random,
    seed: seedToBigInt(seed),
    server: server.fetch,
    events: createInMemoryPubSub(),
    createPubSub: () => createInMemoryPubSub(),
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
    authStorage: createSecureStoreAuthClientStorage(secureStorage),
    secureStorage,
    room: () => {
      throw new Error(
        'simClientEnv: room transport not available in shell tests'
      );
    },
    ...createInMemoryClientPorts('sim-client'),
    serverUrl,
    authBaseURL: serverUrl,
    authCallbackUrl: `${serverUrl}/sso-callback`,
    openAuthSession: () => Promise.resolve({ type: 'cancel' }),
    resolveDatabaseName: ({ userId }) => `sim_client_${userId}`,
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
