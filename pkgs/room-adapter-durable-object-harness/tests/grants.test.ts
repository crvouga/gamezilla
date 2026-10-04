import { describe, expect, test } from 'bun:test';
import { createDurableObjectAdapter } from '@pkgs/room-adapter-durable-object-server/adapter';
import type { DurableObjectInstanceState } from '@pkgs/room-adapter-durable-object-shared/types';
import { AddOne, gameRoomModule } from '@pkgs/room-harness/game-room';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-shared/wire';
import { MemoryKv } from './memory-kv';

type Socket = { readonly ws: WebSocket; readonly sent: unknown[] };

/** A socket that survived hibernation, admitted with `grants`. */
function hibernatedSocket(person: string, grants?: readonly string[]): Socket {
  const sent: unknown[] = [];
  const attachment = {
    connId: `conn-${person}`,
    identityRaw: person,
    clientId: `client-${person}`,
    moduleName: gameRoomModule.name,
    topic: 'topic-1',
    traceparent: null,
    ...(grants === undefined ? {} : { grants }),
  };
  const ws = {
    close: () => undefined,
    deserializeAttachment: () => attachment,
    send: (raw: string) => sent.push(JSON.parse(raw)),
    serializeAttachment: () => undefined,
  } as unknown as WebSocket;
  return { ws, sent };
}

function roomObjectOver(sockets: readonly Socket[]) {
  const state: DurableObjectInstanceState = {
    storage: new MemoryKv(),
    acceptWebSocket: () => undefined,
    getWebSockets: () => sockets.map((s) => s.ws),
    blockConcurrencyWhile: (fn) => fn(),
    waitUntil: () => undefined,
  };
  const RoomObject = createDurableObjectAdapter({
    modules: [gameRoomModule],
    clock: { now: () => 1 },
    createId: () => 'generated-id',
    telemetry: () => ({ flushWith: () => undefined }),
    authorize: async (_identity, _topic, _command, grants) =>
      grants.includes('tally')
        ? { ok: true }
        : { ok: false, reason: 'not a tally keeper' },
  });
  return new RoomObject(state, {});
}

function addOne(id: string): string {
  return JSON.stringify({
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.command,
    id,
    ts: 1,
    payload: AddOne({}),
  });
}

function kinds(socket: Socket): readonly string[] {
  return socket.sent
    .map((frame) => (frame as { readonly kind: string }).kind)
    .filter((kind) => kind !== ROOM_WIRE_KIND.roster);
}

describe('room Durable Object: connection grants', () => {
  test('survive hibernation and reach the authorize hook', async () => {
    const keeper = hibernatedSocket('alice', ['tally']);
    const legacy = hibernatedSocket('bob');
    const room = roomObjectOver([keeper, legacy]);
    await room.webSocketMessage?.(keeper.ws, addOne('a1'));
    await room.webSocketMessage?.(legacy.ws, addOne('b1'));
    expect(kinds(keeper)).toEqual([ROOM_WIRE_KIND.committed]);
    expect(kinds(legacy)).toEqual([
      ROOM_WIRE_KIND.committed,
      ROOM_WIRE_KIND.rejected,
    ]);
  });
});
