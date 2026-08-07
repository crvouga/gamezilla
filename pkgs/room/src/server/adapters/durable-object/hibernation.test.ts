import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { ROOM_WIRE_KIND, WIRE_VERSION } from '../../../protocol/wire';
import { Increment, TestCounterModule } from '../../../testkit/counter-module';
import { createDurableObjectAdapter } from './adapter';
import type {
  DurableObjectInstanceState,
  DurableObjectKvListOptions,
  DurableObjectKvStorage,
} from './types';

type FakeSocket = WebSocket & {
  readonly sent: unknown[];
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
};

function createFakeSocket(): FakeSocket {
  const sent: unknown[] = [];
  let attachment: unknown = null;
  const sock = {
    sent,
    readyState: 1,
    send(data: string): void {
      sent.push(JSON.parse(data) as unknown);
    },
    close(): void {
      sock.readyState = 3;
    },
    serializeAttachment(value: unknown): void {
      attachment = value;
    },
    deserializeAttachment(): unknown {
      return attachment;
    },
  };
  return sock as unknown as FakeSocket;
}

function createMemoryDoKv(): DurableObjectKvStorage {
  const map = new Map<string, unknown>();
  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      return map.get(key) as T | undefined;
    },
    async put(
      keyOrEntries: string | Record<string, unknown>,
      value?: unknown
    ): Promise<void> {
      if (typeof keyOrEntries === 'string') {
        map.set(keyOrEntries, value);
        return;
      }
      for (const [k, v] of Object.entries(keyOrEntries)) {
        map.set(k, v);
      }
    },
    async delete(key: string): Promise<boolean> {
      return map.delete(key);
    },
    async list<T = unknown>(
      options?: DurableObjectKvListOptions
    ): Promise<Map<string, T>> {
      const out = new Map<string, T>();
      for (const k of [...map.keys()].sort()) {
        if (options?.prefix !== undefined && !k.startsWith(options.prefix)) {
          continue;
        }
        out.set(k, map.get(k) as T);
        if (options?.limit !== undefined && out.size >= options.limit) break;
      }
      return out;
    },
  };
}

type FakeDoState = DurableObjectInstanceState & {
  readonly sockets: FakeSocket[];
};

function createFakeDoState(storage: DurableObjectKvStorage): FakeDoState {
  const sockets: FakeSocket[] = [];
  return {
    storage,
    sockets,
    acceptWebSocket(ws: WebSocket, _tags?: string[]): void {
      sockets.push(ws as FakeSocket);
    },
    getWebSockets(_tag?: string): WebSocket[] {
      return [...sockets];
    },
    async blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
  };
}

function stubWebSocketPair(): () => void {
  const g = globalThis as { WebSocketPair?: unknown };
  const previous = g.WebSocketPair;
  g.WebSocketPair = function WebSocketPair(this: unknown) {
    // Constructors may return a different object — yield a real tuple so
    // `const [client, server] = new WebSocketPair()` works in tests.
    return [createFakeSocket(), createFakeSocket()];
  };
  return () => {
    if (previous === undefined) delete g.WebSocketPair;
    else g.WebSocketPair = previous;
  };
}

function upgradeUrl(topic: string, moduleName: string): string {
  return `https://example.test/room?topic=${encodeURIComponent(topic)}&module=${encodeURIComponent(moduleName)}`;
}

async function upgradeActor(
  doInstance: { fetch: (req: Request) => Promise<Response> },
  actorId: string,
  topic: string,
  moduleName: string
): Promise<void> {
  const res = await doInstance.fetch(
    new Request(upgradeUrl(topic, moduleName), {
      headers: {
        Upgrade: 'websocket',
        'x-actor-id': actorId,
      },
    })
  );
  expect(res.status).toBe(101);
}

describe('Durable Object hibernation restore', () => {
  let unstub: () => void;

  beforeEach(() => {
    unstub = stubWebSocketPair();
  });

  afterEach(() => {
    unstub();
  });

  test('passive peer still receives committed after DO eviction', async () => {
    const state = createFakeDoState(createMemoryDoKv());
    const RoomDo = createDurableObjectAdapter({
      modules: [TestCounterModule],
    });
    const topic = 'space:hibernation-test';
    const moduleName = String(TestCounterModule.name);

    const live = new RoomDo(state, {});
    await upgradeActor(live, 'actor-a', topic, moduleName);
    await upgradeActor(live, 'actor-b', topic, moduleName);
    expect(state.sockets.length).toBe(2);

    const serverA = state.sockets[0]!;
    const serverB = state.sockets[1]!;

    // Simulate Cloudflare DO eviction: new isolate, same ctx + hibernated sockets.
    const woken = new RoomDo(state, {});
    const command = {
      v: WIRE_VERSION,
      kind: ROOM_WIRE_KIND.command,
      id: 'cmd-after-wake',
      ts: Date.now(),
      payload: Increment({}),
    };
    await woken.webSocketMessage!(serverA, JSON.stringify(command));

    const committedOnB = serverB.sent.find(
      (m) =>
        typeof m === 'object' &&
        m !== null &&
        (m as { kind?: string }).kind === ROOM_WIRE_KIND.committed
    );
    expect(committedOnB).toBeDefined();
    expect((committedOnB as { commandId?: string }).commandId).toBe(
      'cmd-after-wake'
    );
  });
});
