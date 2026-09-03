import {
  defineObservation,
  defineProperty,
  type JsonValue,
  observe,
} from '@pkgs/dst';
import { canonicalRoomJson } from '../../hash-room-state';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { RoomSurface } from './surface';

export function asJson(value: unknown): JsonValue {
  return JSON.parse(canonicalRoomJson(value)) as JsonValue;
}

function stringList(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
}

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s: RoomSurface) => [...s.world.clients.keys()],
});

export const serverHash = defineObservation({
  name: 'serverHash',
  observe: (s: RoomSurface) => s.world.serverHash(),
});

export const serverState = defineObservation({
  name: 'serverState',
  observe: async (s: RoomSurface) => asJson(await s.world.serverSnapshot()),
});

export const clientState = defineObservation({
  name: 'clientState',
  observe: (s: RoomSurface) => {
    const out: Record<string, JsonValue> = {};
    for (const [id, c] of s.world.clients) {
      out[id] = asJson(c.snapshot());
    }
    return out;
  },
});

export const clientHash = defineObservation({
  name: 'clientHash',
  observe: (s: RoomSurface) => {
    const out: Record<string, JsonValue> = {};
    for (const [id, c] of s.world.clients) {
      if (!c.isConnected() || c.isCrashed()) continue;
      out[id] = c.hash();
    }
    return out;
  },
});

export const connected = defineObservation({
  name: 'connected',
  observe: (s: RoomSurface) =>
    [...s.world.clients.entries()]
      .filter(([, c]) => c.isConnected() && !c.isCrashed())
      .map(([id]) => id),
});

export const crashedIds = defineObservation({
  name: 'crashedIds',
  observe: (s: RoomSurface) =>
    [...s.world.clients.entries()]
      .filter(([, c]) => c.isCrashed())
      .map(([id]) => id),
});

export const heldClients = defineObservation({
  name: 'heldClients',
  observe: (s: RoomSurface) =>
    [...s.world.clients.keys()].filter(
      (id) => s.world.net(id).state() === 'hold'
    ),
});

export const downClients = defineObservation({
  name: 'downClients',
  observe: (s: RoomSurface) =>
    [...s.world.clients.keys()].filter(
      (id) => s.world.net(id).state() === 'down'
    ),
});

export const caps = defineObservation({
  name: 'caps',
  observe: (s: RoomSurface) => [...s.session.caps],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s: RoomSurface) =>
    s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const quiet = defineObservation({
  name: 'quiet',
  observe: (s: RoomSurface) => s.session.network.inFlight() === 0,
});

export const serverCrashed = defineObservation({
  name: 'serverCrashed',
  observe: (s: RoomSurface) => s.world.isServerCrashed(),
});

export const clock = defineObservation({
  name: 'clock',
  observe: (s: RoomSurface) => s.session.ports.clock.now(),
});

export const logSeq = defineObservation({
  name: 'logSeq',
  observe: (s: RoomSurface) => s.world.storage.getLastSeq(s.world.topic),
});

export const lastRejection = defineObservation({
  name: 'lastRejection',
  observe: (s: RoomSurface) => {
    const out: Record<string, JsonValue> = {};
    for (const [id, c] of s.world.clients) {
      const err = c.lastRejection();
      out[id] = err === null ? null : asJson(err);
    }
    return out;
  },
});

export const rosterSize = defineObservation({
  name: 'rosterSize',
  observe: (s: RoomSurface) => s.world.server.getRoster().length,
});

export const invariantViolations = defineObservation({
  name: 'invariantViolations',
  observe: async (s: RoomSurface) => {
    const v = await s.world.checkInvariants();
    return v === null ? [] : [`${v.invariant}: ${v.detail}`];
  },
});

export const converged = defineObservation({
  name: 'converged',
  *observe() {
    const [h, hashes, live, crashed] = yield* observe(
      serverHash,
      clientHash,
      connected,
      crashedIds
    );
    const skip = new Set([...stringList(crashed)]);
    const ids = stringList(live).filter((id) => !skip.has(id));
    const map = hashes as Record<string, string>;
    return ids.every((id) => map[id] === h);
  },
});

export const invariants = defineProperty({
  name: 'invariants',
  *watch() {
    while (true) {
      const [crashed, msgs] = (yield observe(
        serverCrashed,
        invariantViolations
      )) as [boolean, string[]];
      if (!crashed && msgs.length > 0) {
        throw new Error(msgs.join('; '));
      }
    }
  },
});

export const converges = defineProperty({
  name: 'converges',
  *watch() {
    while (true) {
      const [q, ok, cut, held, down, crashed] = (yield observe(
        quiet,
        converged,
        partitioned,
        heldClients,
        downClients,
        serverCrashed
      )) as [boolean, boolean, string[], string[], string[], boolean];
      if (
        q &&
        cut.length === 0 &&
        held.length === 0 &&
        down.length === 0 &&
        !crashed &&
        !ok
      ) {
        throw new Error('quiet but diverged');
      }
    }
  },
});

export const ROOM_PROPERTIES = [invariants, converges];

export type { RoomSurface };
export { ROOM_SERVER_ENDPOINT, roomClientEndpoint };
