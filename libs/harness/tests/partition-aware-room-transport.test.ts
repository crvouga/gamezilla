/**
 * The harness's room connection must behave like a socket on a real network: a
 * partition drops it (the server forgets the person — nobody lingers), frames
 * sent meanwhile are lost, and healing reconnects once — nobody appears twice.
 */
import { describe, expect, test } from 'bun:test';
import { partitionAwareRoomTransport, ROOM_HEARTBEAT_MS } from '@libs/harness/partition-aware-room-transport';
import type { Timers } from '@pkgs/clock-shared/types';
import type { ClientTransport, ClientTransportHandlers } from '@pkgs/room-shared/transport';

type FakeServer = {
  readonly live: Set<number>;
  readonly received: unknown[];
};

function fakeConnection(server: FakeServer, id: number): ClientTransport {
  const handlers: ClientTransportHandlers[] = [];
  let open = false;
  return {
    get isConnected() {
      return open;
    },
    connect() {
      server.live.add(id);
      open = true;
      for (const h of handlers) h.onOpen?.();
    },
    sendJson(payload) {
      server.received.push(payload);
    },
    subscribe: () => () => undefined,
    onHandlers(h) {
      handlers.push(h);
      return () => undefined;
    },
    destroy() {
      server.live.delete(id);
      open = false;
    },
  };
}

function manualTimers(): Timers & { readonly advance: (ms: number) => void } {
  let now = 0;
  const intervals = new Map<
    number,
    { fn: () => void; ms: number; at: number }
  >();
  let next = 1;
  return {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    setInterval: (fn, ms) => {
      const id = next++;
      intervals.set(id, { fn, ms, at: now + ms });
      return id;
    },
    clearInterval: (handle) => {
      intervals.delete(handle as number);
    },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...intervals.values()].filter((i) => i.at <= until);
        if (due.length === 0) break;
        for (const i of due) {
          now = i.at;
          i.at += i.ms;
          i.fn();
        }
      }
      now = until;
    },
  };
}

function setup() {
  const server: FakeServer = { live: new Set(), received: [] };
  const timers = manualTimers();
  let reachable = true;
  let opened = 0;
  const events: string[] = [];
  const transport = partitionAwareRoomTransport({
    open: () => fakeConnection(server, ++opened),
    reachable: () => reachable,
    timers,
  });
  transport.onHandlers({
    onOpen: () => events.push('open'),
    onClose: () => events.push('close'),
  });
  return {
    server,
    timers,
    transport,
    events,
    setReachable: (value: boolean) => {
      reachable = value;
    },
  };
}

describe('partition-aware room transport', () => {
  // regression: room-short-partition-loses-commands
  test('an unsent frame closes even a partition shorter than one heartbeat', async () => {
    const t = setup();
    await t.transport.connect();
    t.setReachable(false);
    t.transport.sendJson({ command: 'offline solve' });
    t.setReachable(true);
    expect(t.transport.isConnected).toBe(false);
    expect(t.events).toEqual(['open', 'close']);
    t.timers.advance(ROOM_HEARTBEAT_MS);
    expect(t.events).toEqual(['open', 'close', 'open']);
    expect(t.server.received).toEqual([]);
  });

  test('a partition drops the connection within a heartbeat, and nothing is sent across it', async () => {
    const t = setup();
    await t.transport.connect();
    expect(t.server.live.size).toBe(1);

    t.setReachable(false);
    t.transport.sendJson({ lost: true });
    t.timers.advance(ROOM_HEARTBEAT_MS);
    expect(t.server.live.size).toBe(0);
    expect(t.transport.isConnected).toBe(false);
    expect(t.server.received).toEqual([]);
    expect(t.events).toEqual(['open', 'close']);
  });

  test('healing reconnects exactly once', async () => {
    const t = setup();
    await t.transport.connect();
    t.setReachable(false);
    t.timers.advance(ROOM_HEARTBEAT_MS * 3);
    t.setReachable(true);
    t.timers.advance(ROOM_HEARTBEAT_MS * 3);
    expect(t.server.live.size).toBe(1);
    expect(t.transport.isConnected).toBe(true);
    expect(t.events).toEqual(['open', 'close', 'open']);
  });

  test('connecting while cut off fails, then joins once the network is back', async () => {
    const t = setup();
    t.setReachable(false);
    await expect(t.transport.connect()).rejects.toThrow('unreachable');
    expect(t.server.live.size).toBe(0);
    t.setReachable(true);
    t.timers.advance(ROOM_HEARTBEAT_MS);
    expect(t.server.live.size).toBe(1);
  });

  test('a reconnect that fails is retried on the next heartbeat', async () => {
    const server: FakeServer = { live: new Set(), received: [] };
    const timers = manualTimers();
    let reachable = true;
    let opened = 0;
    const transport = partitionAwareRoomTransport({
      open: () => {
        opened += 1;
        const conn = fakeConnection(server, opened);
        // The first reconnect (connection #2) is refused by the host.
        return opened === 2
          ? { ...conn, connect: () => Promise.reject(new Error('refused')) }
          : conn;
      },
      reachable: () => reachable,
      timers,
    });
    await transport.connect();
    reachable = false;
    timers.advance(ROOM_HEARTBEAT_MS);
    reachable = true;
    timers.advance(ROOM_HEARTBEAT_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(server.live.size).toBe(0);
    timers.advance(ROOM_HEARTBEAT_MS);
    expect(server.live.size).toBe(1);
    expect(transport.isConnected).toBe(true);
  });

  test('destroy leaves the room and stops the heartbeat', async () => {
    const t = setup();
    await t.transport.connect();
    t.transport.destroy();
    expect(t.server.live.size).toBe(0);
    t.timers.advance(ROOM_HEARTBEAT_MS * 5);
    expect(t.server.live.size).toBe(0);
  });
});
