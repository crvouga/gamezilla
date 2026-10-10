import { expect, test } from 'bun:test';
import type { ClientEnv } from '@libs/app-root-client/client-env';
import type { ClientPubSubArgs } from '@libs/app-root-client/create-client-pubsub';
import { createInMemoryClientPorts } from '@libs/app-root-client/in-memory-client-ports';
import { createOfflineClientEnv } from '@libs/app-root-client/offline-client-env';
import { createOfflineNetworkController } from '@libs/app-root-client/offline-network-controller';
import { KvImplInMemory } from '@pkgs/kv-root-shared/impl-in-memory';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared/in-memory';

function networkEnv(overrides: Partial<ClientEnv> = {}): ClientEnv {
  // These tests exercise the network ports; unrelated composition ports are unused.
  return {
    ...createInMemoryClientPorts(),
    kv: new KvImplInMemory(),
    server: async () => new Response('ok'),
    events: createInMemoryPubSub({ logger: createNoopLogger() }),
    createPubSub: () => createInMemoryPubSub({ logger: createNoopLogger() }),
    ...overrides,
  } as ClientEnv;
}

// regression: offline-production-push-factory
test('the offline composition preserves the injected broker factory and connection arguments', async () => {
  const offline = createOfflineNetworkController(new KvImplInMemory());
  await offline.ready();
  offline.setOffline(true);
  const urls: string[] = [];
  const source = networkEnv({
    createPubSub: (args) => {
      urls.push(args.url);
      return createInMemoryPubSub({ logger: createNoopLogger() });
    },
  });
  const client = createOfflineClientEnv(source, offline);
  const push = client.env.createPubSub({
    url: 'wss://broker.example.test',
  } as ClientPubSubArgs);
  const detach = push?.subscribe('account:alice', () => undefined);
  expect(urls).toEqual([]);

  offline.setOffline(false);
  expect(urls).toEqual(['wss://broker.example.test']);
  offline.setOffline(true);
  expect(push?.status()).toBe('down');
  offline.setOffline(false);
  expect(urls).toEqual([
    'wss://broker.example.test',
    'wss://broker.example.test',
  ]);
  detach?.();
  push?.close();
});

// regression: offline-auth-inflight-http
test('auth receives gated HTTP so going offline aborts requests already underway', async () => {
  const offline = createOfflineNetworkController(new KvImplInMemory());
  await offline.ready();
  let signal: AbortSignal | undefined;
  let requests = 0;
  const source = networkEnv({
    server: async (_input, init) => {
      requests += 1;
      signal = init?.signal ?? undefined;
      return await new Promise<Response>(() => undefined);
    },
    createAuthClient: (http) => ({
      provider: 'test-port',
      session: {
        getSnapshot: () => ({ session: null, isHydrated: true, error: null }),
        subscribe: () => () => undefined,
        refresh: async () => {
          await http('https://example.test/auth/session');
        },
      },
      signIn: async () => undefined,
      signOut: async () => undefined,
      signOutEverywhere: async () => undefined,
      listIdentities: async () => [],
      prepareLink: async () => undefined,
      linkProvider: async () => undefined,
      unlinkProvider: async () => [],
      createSeparateAccount: async () => undefined,
      getFreshToken: async () => null,
    }),
  });
  const client = createOfflineClientEnv(source, offline);
  const auth = client.env.createAuthClient(client.env.server);
  void auth.session.refresh();
  await Promise.resolve();

  offline.setOffline(true);

  expect(signal?.aborted).toBe(true);
  await expect(auth.session.refresh()).rejects.toMatchObject({
    name: 'HttpNetworkError',
  });
  expect(requests).toBe(1);
});
