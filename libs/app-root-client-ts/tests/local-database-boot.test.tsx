/** @jsxImportSource solid-js */
/**
 * What a person sees while the app boots on a local database that is
 * missing, damaged, full, hung or gone: the app, never an error screen.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { AppCompositionProvider } from '@libs/app-root-client-ts/app-subs-context';
import type { ClientEnv } from '@libs/app-root-client-ts/client-env';
import { ClientEnvProvider } from '@libs/app-root-client-ts/client-env-context';
import { LocalIdentityProvider } from '@libs/app-root-client-ts/identity-context';
import { createInMemoryClientPorts } from '@libs/app-root-client-ts/in-memory-client-ports';
import type { AppSyncEnginePool } from '@libs/app-root-client-ts/sync-engine-pool';
import { createAppSyncEnginePool } from '@libs/app-root-client-ts/sync-engine-pool';
import { useSyncEngineBootViews } from '@libs/app-root-client-ts/use-sync-engine-boot-views';
import { createAppBearerTokenStore } from '@libs/app-root-shared-ts/auth-client-storage';
import { AuthClientProvider } from '@libs/auth-client-ts/auth-client-provider';
import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { composeSubs } from '@libs/sub-shared-ts/compose';
import { createInhouseAuthClient } from '@pkgs/auth-inhouse-client-ts/create-inhouse-auth-client';
import { createInMemoryAuthClientStorage } from '@pkgs/auth-inhouse-shared-ts/bearer-token-store';
import type { AuthClientPort } from '@pkgs/auth-root-shared-ts/auth-client-port';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { LoggerProvider } from '@pkgs/logger-client-ts/solid';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared-ts/in-memory';
import { SecureStorageStoreProvider } from '@pkgs/secure-storage-root-client-ts/solid';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-root-shared-ts/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { STORAGE_FAULTS } from '@pkgs/sql-client-root-shared-ts/storage-faults';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { render } from '@solidjs/testing-library';

type BootState = 'loading' | 'ready' | 'error' | 'stuck';

const opened: SqlClient[] = [];

afterEach(async () => {
  while (opened.length > 0) await opened.pop()?.disconnect();
});

async function openMockingbird(): Promise<SqlClient> {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  opened.push(client);
  return client;
}

const app = composeSubs([]);

function Probe(props: { readonly onState: (state: BootState) => void }) {
  const views = useSyncEngineBootViews({ userId: () => 'alice' });
  const state = (): BootState => {
    if (views.bootError() !== null) return 'error';
    if (views.stuckError() !== null) return 'stuck';
    if (views.ready() !== null) return 'ready';
    return 'loading';
  };
  return (
    <div
      data-state={(() => {
        props.onState(state());
        return state();
      })()}
    />
  );
}

type Boot = {
  readonly state: () => BootState;
  readonly clock: ReturnType<typeof createHarnessClock>;
  readonly unmount: () => void;
};

async function boot(options: {
  readonly openSqlClient: ClientEnv['openSqlClient'];
  readonly loadApp?: () => Promise<typeof app>;
  readonly pool?: (real: AppSyncEnginePool) => AppSyncEnginePool;
  readonly freshToken?: AuthClientPort['getFreshToken'];
  readonly sessionToken?: string;
}): Promise<Boot> {
  const clock = createHarnessClock();
  const storage = createInMemorySecureStorage();
  await storage.setItem(LAST_LOCAL_ACCOUNT_ID_KEY, 'alice');
  await storage.setItem(DEVICE_ID_KEY, 'device-1');
  if (options.sessionToken !== undefined)
    await storage.setItem(SESSION_TOKEN_KEY, options.sessionToken);
  const store = createSecureStorageStore(storage);
  let ids = 0;
  const env = {
    ...createInMemoryClientPorts(),
    kv: new KvImplInMemory(),
    clock: clock.clock,
    timers: clock.timers,
    createId: () => `id-${++ids}`,
    random: () => 0.5,
    seed: 1n,
    server: () =>
      Promise.resolve(
        new Response(JSON.stringify({ responses: [] }), {
          headers: { 'content-type': 'application/json' },
        })
      ),
    events: createInMemoryPubSub({ logger: createNoopLogger() }),
    createPubSub: () => null,
    openSqlClient: options.openSqlClient,
    secureStorage: store,
    serverUrl: 'http://localhost',
    resolveDatabaseName: ({ userId }: { userId: string }) => `user_${userId}`,
    mutationSuccessHoldMs: 0,
    moderation: shippedModerationRules(),
    openExternalUrl: () => Promise.resolve(),
  } as unknown as ClientEnv;
  const port = createInhouseAuthClient({
    baseURL: env.serverUrl,
    clock: env.clock,
    timers: env.timers,
    fetch: env.server,
    bearerStore: createAppBearerTokenStore(createInMemoryAuthClientStorage()),
    callbackUrl: `${env.serverUrl}/sso-callback`,
  });
  if (options.freshToken !== undefined) port.getFreshToken = options.freshToken;
  const real = createAppSyncEnginePool({
    loadMutations: () => app.mutations(),
  });
  const pool = options.pool?.(real) ?? real;
  let latest: BootState = 'loading';
  const view = render(() => (
    <LoggerProvider value={createNoopLogger()}>
      <ClientEnvProvider env={env} syncEnginePool={pool}>
        <AppCompositionProvider
          value={{
            clients: {} as never,
            loadApp: options.loadApp ?? (() => Promise.resolve(app)),
          }}
        >
          <SecureStorageStoreProvider value={store}>
            <AuthClientProvider port={port}>
              <LocalIdentityProvider>
                <Probe onState={(state) => (latest = state)} />
              </LocalIdentityProvider>
            </AuthClientProvider>
          </SecureStorageStoreProvider>
        </AppCompositionProvider>
      </ClientEnvProvider>
    </LoggerProvider>
  ));
  return { state: () => latest, clock, unmount: view.unmount };
}

async function until(done: () => boolean): Promise<void> {
  for (let turn = 0; turn < 400 && !done(); turn += 1) await Bun.sleep(0);
}

describe('booting the app', () => {
  // regression: deleted-account-stats-space-withdrawal
  test('a rejected bearer exposes the auth port’s ordinary and forced token refresh', async () => {
    const refreshes: unknown[] = [];
    let refresh: AuthClientPort['getFreshToken'] | undefined;
    const b = await boot({
      openSqlClient: openMockingbird,
      sessionToken: 'bound-account-session',
      freshToken: async (options) => {
        refreshes.push(options);
        return 'provider-session-not-yet-bound';
      },
      pool: (real) => ({
        ...real,
        getOrCreate: (args) => {
          refresh = args.getFreshAuthToken;
          return real.getOrCreate(args);
        },
      }),
    });
    try {
      await until(() => b.state() === 'ready');
      expect(b.state()).toBe('ready');
      expect(await refresh?.()).toBe('provider-session-not-yet-bound');
      expect(refreshes).toEqual([undefined]);
      expect(await refresh?.({ skipCache: true })).toBe(
        'provider-session-not-yet-bound'
      );
      expect(refreshes).toEqual([undefined, { skipCache: true }]);
    } finally {
      b.unmount();
    }
  });

  test('opens on a healthy database', async () => {
    const b = await boot({ openSqlClient: openMockingbird });
    await until(() => b.state() === 'ready');
    expect(b.state()).toBe('ready');
    b.unmount();
  });

  test('opens when the database cannot be opened', async () => {
    const b = await boot({
      openSqlClient: () => Promise.reject(new Error('no worker could start')),
    });
    await until(() => b.state() === 'ready');
    expect(b.state()).toBe('ready');
    b.unmount();
  });

  test.each(Object.keys(STORAGE_FAULTS) as (keyof typeof STORAGE_FAULTS)[])(
    'opens when the database is dead on arrival (%s)',
    async (name) => {
      const b = await boot({
        openSqlClient: async () => {
          const faulty = createFaultInjectingSqlClient(await openMockingbird());
          faulty.breakWith(STORAGE_FAULTS[name]);
          return faulty.client;
        },
      });
      await until(() => b.state() === 'ready');
      expect(b.state()).toBe('ready');
      b.unmount();
    }
  );

  // regression: local-sqlite-boot-connect-failure
  test('opens when the engine fails to start syncing', async () => {
    const b = await boot({
      openSqlClient: openMockingbird,
      pool: (real) => ({
        ...real,
        getOrCreate: async (args) => ({
          ...(await real.getOrCreate(args)),
          connect: () => Promise.reject(new Error('push could not attach')),
        }),
      }),
    });
    await until(() => b.state() === 'ready');
    expect(b.state()).toBe('ready');
    b.unmount();
  });

  // regression: boot-waits-for-background-sync
  test('opens while starting background sync remains pending', async () => {
    let connecting = false;
    const b = await boot({
      openSqlClient: openMockingbird,
      pool: (real) => ({
        ...real,
        getOrCreate: async (args) => ({
          ...(await real.getOrCreate(args)),
          connect: () => {
            connecting = true;
            return new Promise<void>(() => undefined);
          },
        }),
      }),
    });
    await until(() => connecting);
    expect(connecting).toBe(true);
    await until(() => b.state() === 'ready');
    expect(b.state()).toBe('ready');
    b.clock.clock.advance(30_000);
    expect(b.state()).toBe('ready');
    b.unmount();
  });
});

describe('a boot that is not about the database', () => {
  test('names a module that cannot load', async () => {
    const b = await boot({
      openSqlClient: openMockingbird,
      loadApp: () => Promise.reject(new Error('Failed to fetch module')),
    });
    await until(() => b.state() === 'error');
    expect(b.state()).toBe('error');
    b.unmount();
  });
});
