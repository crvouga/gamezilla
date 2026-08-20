import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { wallClock } from '@pkgs/clock';

import { TestCounterModule } from '../../../tests/fixtures/counter-module';
import { createDurableObjectAdapter } from './adapter';
import type {
  DurableObjectInstanceState,
  DurableObjectKvListOptions,
  DurableObjectKvStorage,
} from './types';

type FakeSocket = WebSocket & {
  readonly sent: unknown[];
  readyState: number;
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
  readonly tagsBySocket: Map<FakeSocket, string[]>;
};

function createFakeDoState(storage: DurableObjectKvStorage): FakeDoState {
  const sockets: FakeSocket[] = [];
  const tagsBySocket = new Map<FakeSocket, string[]>();
  return {
    storage,
    sockets,
    tagsBySocket,
    acceptWebSocket(ws: WebSocket, tags?: string[]): void {
      const sock = ws as FakeSocket;
      sockets.push(sock);
      tagsBySocket.set(sock, tags ?? []);
    },
    getWebSockets(tag?: string): WebSocket[] {
      if (tag === undefined) return [...sockets];
      return sockets.filter((s) => (tagsBySocket.get(s) ?? []).includes(tag));
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

async function upgradeActor(args: {
  doInstance: { fetch: (req: Request) => Promise<Response> };
  actorId: string;
  clientId: string;
  topic: string;
  moduleName: string;
}): Promise<Response> {
  return args.doInstance.fetch(
    new Request(upgradeUrl(args.topic, args.moduleName), {
      headers: {
        Upgrade: 'websocket',
        'x-actor-id': args.actorId,
        'x-actor-client-id': args.clientId,
      },
    })
  );
}

function latestRosterClients(
  sock: FakeSocket
): readonly { id: string; clientId: string }[] {
  for (let i = sock.sent.length - 1; i >= 0; i -= 1) {
    const msg = sock.sent[i];
    if (
      typeof msg === 'object' &&
      msg !== null &&
      (msg as { kind?: string }).kind === 'roster'
    ) {
      const clients = (msg as { clients?: unknown }).clients;
      if (Array.isArray(clients)) {
        return clients as { id: string; clientId: string }[];
      }
    }
  }
  return [];
}

describe('Durable Object session take-over', () => {
  let unstub: () => void;

  beforeEach(() => {
    unstub = stubWebSocketPair();
  });

  afterEach(() => {
    unstub();
  });

  test('second upgrade with same identity+clientId replaces the first', async () => {
    const state = createFakeDoState(createMemoryDoKv());
    const RoomDo = createDurableObjectAdapter({
      modules: [TestCounterModule],
      clock: wallClock,
      createId: () => crypto.randomUUID(),
    });
    const topic = 'space:session-takeover';
    const moduleName = String(TestCounterModule.name);
    const doInstance = new RoomDo(state, {});

    const first = await upgradeActor({
      doInstance,
      actorId: 'alice',
      clientId: 'tab-1',
      topic,
      moduleName,
    });
    expect(first.status).toBe(101);
    expect(state.sockets).toHaveLength(1);
    const firstSock = state.sockets[0]!;
    expect(latestRosterClients(firstSock)).toEqual([
      { id: 'alice', clientId: 'tab-1' },
    ]);

    const second = await upgradeActor({
      doInstance,
      actorId: 'alice',
      clientId: 'tab-1',
      topic,
      moduleName,
    });
    expect(second.status).toBe(101);
    expect(state.sockets).toHaveLength(2);
    expect(firstSock.readyState).toBe(3);

    const secondSock = state.sockets[1]!;
    expect(latestRosterClients(secondSock)).toEqual([
      { id: 'alice', clientId: 'tab-1' },
    ]);
  });

  test('different clientId keeps both roster entries', async () => {
    const state = createFakeDoState(createMemoryDoKv());
    const RoomDo = createDurableObjectAdapter({
      modules: [TestCounterModule],
      clock: wallClock,
      createId: () => crypto.randomUUID(),
    });
    const topic = 'space:multi-tab';
    const moduleName = String(TestCounterModule.name);
    const doInstance = new RoomDo(state, {});

    await upgradeActor({
      doInstance,
      actorId: 'alice',
      clientId: 'tab-1',
      topic,
      moduleName,
    });
    await upgradeActor({
      doInstance,
      actorId: 'alice',
      clientId: 'tab-2',
      topic,
      moduleName,
    });

    const roster = latestRosterClients(state.sockets[1]!);
    expect(roster).toHaveLength(2);
    expect(new Set(roster.map((c) => c.clientId))).toEqual(
      new Set(['tab-1', 'tab-2'])
    );
  });
});
