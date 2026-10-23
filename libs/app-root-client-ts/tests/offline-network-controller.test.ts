import { describe, expect, test } from 'bun:test';
import { createOfflineNetworkController } from '@libs/app-root-client-ts/offline-network-controller';
import { createOfflineHttp } from '@libs/app-root-client-ts/offline-network-http';
import {
  createOfflinePubSub,
  createOfflineRoomTransport,
} from '@libs/app-root-client-ts/offline-network-realtime';
import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { KvImplInMemory } from '@pkgs/kv-root-shared-ts/impl-in-memory';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type {
  ClientTransport,
  ClientTransportHandlers,
} from '@pkgs/room-root-shared-ts/transport';

const KEY = asKeyword('app.prefs/work-offline');
const VALUE = asKeyword('app.prefs/value');

describe('voluntary offline network boundary', () => {
  test('starts fail-closed, then opens when no offline preference is stored', async () => {
    const controller = createOfflineNetworkController(new KvImplInMemory());
    expect(controller.isOffline()).toBe(true);

    await controller.ready();

    expect(controller.isOffline()).toBe(false);
  });

  test('restores the persisted offline choice on reopen', async () => {
    const kv = new KvImplInMemory();
    await kv.put(KEY, { [VALUE]: true });

    const controller = createOfflineNetworkController(kv);
    await controller.ready();

    expect(controller.isOffline()).toBe(true);
  });

  test('a choice made during hydration wins and is persisted', async () => {
    const kv = new KvImplInMemory();
    const controller = createOfflineNetworkController(kv);

    controller.setOffline(false);
    controller.setOffline(true);
    await controller.ready();
    await controller.persisted();

    expect(controller.isOffline()).toBe(true);
    expect(await kv.get(KEY)).toEqual({ [VALUE]: true });
  });

  test('switching offline aborts an in-flight request and blocks new requests', async () => {
    const kv = new KvImplInMemory();
    const controller = createOfflineNetworkController(kv);
    await controller.ready();
    let signal: AbortSignal | undefined;
    let calls = 0;
    const http = createOfflineHttp(controller, async (_input, init) => {
      calls += 1;
      signal = init?.signal ?? undefined;
      return await new Promise<Response>(() => undefined);
    });

    void http('https://example.test/one');
    await Promise.resolve();
    controller.setOffline(true);

    expect(signal?.aborted).toBe(true);
    await expect(http('https://example.test/two')).rejects.toMatchObject({
      name: 'HttpNetworkError',
    });
    expect(calls).toBe(1);
  });

  // regression: offline-http-response-body
  test('switching offline aborts a response whose headers have arrived but body is streaming', async () => {
    const controller = createOfflineNetworkController(new KvImplInMemory());
    await controller.ready();
    let signal: AbortSignal | undefined;
    let cancelled = false;
    const http = createOfflineHttp(controller, async (_input, init) => {
      signal = init?.signal ?? undefined;
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        })
      );
    });
    const response = await http('https://example.test/stream');
    const body = response.text();

    controller.setOffline(true);

    expect(signal?.aborted).toBe(true);
    await expect(body).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelled).toBe(true);
  });

  test('gated responses retain their body and HTTP metadata', async () => {
    const controller = createOfflineNetworkController(new KvImplInMemory());
    await controller.ready();
    const http = createOfflineHttp(
      controller,
      async () =>
        new Response('hello', {
          status: 201,
          statusText: 'Created',
          headers: { 'x-result': 'ready' },
        })
    );
    const response = await http('https://example.test/result');
    expect(response.status).toBe(201);
    expect(response.statusText).toBe('Created');
    expect(response.headers.get('x-result')).toBe('ready');
    expect(await response.clone().text()).toBe('hello');
    expect(await response.text()).toBe('hello');
  });

  test('switching offline closes push and restores subscriptions on a fresh port', async () => {
    const controller = createOfflineNetworkController(new KvImplInMemory());
    await controller.ready();
    const opened: { closed: boolean; subscriptions: number }[] = [];
    const open = (): PubSub => {
      const state = { closed: false, subscriptions: 0 };
      opened.push(state);
      return {
        publish: async () => undefined,
        subscribe: () => {
          state.subscriptions += 1;
          return () => undefined;
        },
        status: () => (state.closed ? 'down' : 'connected'),
        onStatus: () => () => undefined,
        close: () => {
          state.closed = true;
        },
      };
    };
    const push = createOfflinePubSub(controller, open);

    push.subscribe('account:one', () => undefined);
    expect(opened).toEqual([{ closed: false, subscriptions: 1 }]);
    controller.setOffline(true);
    expect(opened[0]?.closed).toBe(true);
    controller.setOffline(false);
    expect(opened).toEqual([
      { closed: true, subscriptions: 1 },
      { closed: false, subscriptions: 1 },
    ]);
  });

  test('switching offline destroys a room transport before it can send', async () => {
    const controller = createOfflineNetworkController(new KvImplInMemory());
    await controller.ready();
    let destroys = 0;
    let sends = 0;
    const open = (): ClientTransport => ({
      isConnected: true,
      connect: () => undefined,
      sendJson: () => {
        sends += 1;
      },
      subscribe: () => () => undefined,
      onHandlers: () => () => undefined,
      destroy: () => {
        destroys += 1;
      },
    });
    const room = createOfflineRoomTransport(controller, open);
    await room.connect();

    controller.setOffline(true);

    expect(destroys).toBe(1);
    expect(() => room.sendJson({ move: 'e4' })).toThrow();
    expect(sends).toBe(0);
  });

  // regression: offline-room-reconnect-leak
  test('switching offline destroys a disconnected room whose adapter is waiting to reconnect', async () => {
    const controller = createOfflineNetworkController(new KvImplInMemory());
    await controller.ready();
    let handlers: ClientTransportHandlers | null = null;
    let destroys = 0;
    const room = createOfflineRoomTransport(controller, () => ({
      isConnected: false,
      connect: () => undefined,
      sendJson: () => undefined,
      subscribe: () => () => undefined,
      onHandlers: (next) => {
        handlers = next;
        return () => undefined;
      },
      destroy: () => {
        destroys += 1;
      },
    }));
    await room.connect();
    (handlers as ClientTransportHandlers | null)?.onClose?.();

    controller.setOffline(true);

    expect(destroys).toBe(1);
  });
});
