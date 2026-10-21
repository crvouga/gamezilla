import { expect, test } from 'bun:test';
import type { ClientEnv } from '@libs/app-root-client-ts/client-env';
import type { ClientPubSubArgs } from '@libs/app-root-client-ts/create-client-pubsub';
import { createInMemoryClientPorts } from '@libs/app-root-client-ts/in-memory-client-ports';
import { createOfflineClientEnv } from '@libs/app-root-client-ts/offline-client-env';
import { createOfflineNetworkController } from '@libs/app-root-client-ts/offline-network-controller';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { createInMemoryPubSub } from '@pkgs/pubsub-root-shared-ts/in-memory';

function networkEnv(overrides: Partial<ClientEnv> = {}): ClientEnv {
  // These tests exercise the network ports; unrelated composition ports are unused.
  return {
    ...createInMemoryClientPorts(),
    ...createHarnessClock(),
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
      requestEmailLink: async () => undefined,
      signInWithEmailLink: async () => undefined,
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
  const firstRefresh = auth.session.refresh().catch((error: unknown) => error);
  await Promise.resolve();

  offline.setOffline(true);

  expect(signal?.aborted).toBe(true);
  expect(await firstRefresh).toBeInstanceOf(Error);
  await expect(auth.session.refresh()).rejects.toMatchObject({
    name: 'HttpNetworkError',
  });
  expect(requests).toBe(1);
});

// regression: population-observation-factory-arguments
test('observation subscriptions preserve injected credentials and the offline broker factory', async () => {
  const offline = createOfflineNetworkController(new KvImplInMemory());
  await offline.ready();
  offline.setOffline(true);
  const calls: ClientPubSubArgs[] = [];
  const source = networkEnv({
    createPubSub: (args) => {
      calls.push(args);
      return createInMemoryPubSub({ logger: createNoopLogger() });
    },
  });
  const args: ClientPubSubArgs = {
    url: 'wss://broker.example.test',
    clientIdPrefix: 'population-observation',
    timers: source.timers,
    random: source.random,
    logger: createNoopLogger(),
    auth: async () => ({
      username: 'observation',
      password: 'test-credential',
    }),
  };
  const push = createOfflineClientEnv(source, offline).env.createPubSub(args);
  const detach = push?.subscribe(
    'synthetic-population:administration',
    () => undefined
  );
  expect(calls).toEqual([]);
  offline.setOffline(false);
  expect(calls).toEqual([args]);
  offline.setOffline(true);
  expect(push?.status()).toBe('down');
  detach?.();
  push?.close();
});

// regression: offline-wrapper-hides-missing-broker
test('a missing broker stays unavailable until its address hydrates', async () => {
  const offline = createOfflineNetworkController(new KvImplInMemory());
  await offline.ready();
  const urls: string[] = [];
  let closed = 0;
  const source = networkEnv({
    createPubSub: (args) => {
      urls.push(args.url);
      if (args.url.length === 0) return null;
      const port = createInMemoryPubSub({ logger: createNoopLogger() });
      const close = port.close.bind(port);
      port.close = () => {
        closed += 1;
        close();
      };
      return port;
    },
  });
  const env = createOfflineClientEnv(source, offline).env;
  expect(env.createPubSub({ url: '' } as ClientPubSubArgs)).toBeNull();
  const push = env.createPubSub({
    url: 'ws://broker.test/mqtt',
  } as ClientPubSubArgs);
  expect(push).not.toBeNull();
  push!.subscribe('user:alice', () => undefined);
  expect(urls).toEqual(['', 'ws://broker.test/mqtt']);
  offline.setOffline(true);
  expect(closed).toBe(1);
  offline.setOffline(false);
  expect(urls).toEqual(['', 'ws://broker.test/mqtt', 'ws://broker.test/mqtt']);
  push!.close();
  expect(closed).toBe(2);
});
