import { defineSurface, type JsonValue, observe } from '@pkgs/dst';
import { canonicalRoomJson } from '../../hash-room-state';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { RoomSurface } from './surface';

const { defineObservation, defineProperty } = defineSurface<RoomSurface>();

export function asJson(value: unknown): JsonValue {
  return JSON.parse(canonicalRoomJson(value)) as JsonValue;
}

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => [...s.kit.clients.keys()],
});

/** Decimal kit seed — lets tests derive their own deterministic streams. */
export const seed = defineObservation({
  name: 'seed',
  observe: (s) => s.kit.seed.toString(),
});

export const serverHash = defineObservation({
  name: 'serverHash',
  observe: (s) => s.kit.serverHash(),
});

export const serverState = defineObservation({
  name: 'serverState',
  observe: async (s) => asJson(await s.kit.serverSnapshot()),
});

export const clientState = defineObservation({
  name: 'clientState',
  observe: (s) => {
    const out: Record<string, JsonValue> = {};
    for (const [id, c] of s.kit.clients) {
      out[id] = asJson(c.snapshot());
    }
    return out;
  },
});

export const clientHash = defineObservation({
  name: 'clientHash',
  observe: (s) => {
    const out: Record<string, JsonValue> = {};
    for (const [id, c] of s.kit.clients) {
      if (!c.isConnected() || c.isCrashed()) continue;
      out[id] = c.hash();
    }
    return out;
  },
});

export const connected = defineObservation({
  name: 'connected',
  observe: (s) =>
    [...s.kit.clients.entries()]
      .filter(([, c]) => c.isConnected() && !c.isCrashed())
      .map(([id]) => id),
});

export const crashedIds = defineObservation({
  name: 'crashedIds',
  observe: (s) =>
    [...s.kit.clients.entries()]
      .filter(([, c]) => c.isCrashed())
      .map(([id]) => id),
});

export const heldClients = defineObservation({
  name: 'heldClients',
  observe: (s) =>
    [...s.kit.clients.keys()].filter((id) => s.kit.net(id).state() === 'hold'),
});

export const downClients = defineObservation({
  name: 'downClients',
  observe: (s) =>
    [...s.kit.clients.keys()].filter((id) => s.kit.net(id).state() === 'down'),
});

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s) => s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const quiet = defineObservation({
  name: 'quiet',
  observe: (s) => s.session.network.inFlight() === 0,
});

export const serverCrashed = defineObservation({
  name: 'serverCrashed',
  observe: (s) => s.kit.isServerCrashed(),
});

export const clock = defineObservation({
  name: 'clock',
  observe: (s) => s.session.ports.clock.now(),
});

export const logSeq = defineObservation({
  name: 'logSeq',
  observe: (s) => s.kit.storage.getLastSeq(s.kit.topic),
});

export const lastRejection = defineObservation({
  name: 'lastRejection',
  observe: (s) => {
    const out: Record<string, JsonValue> = {};
    for (const [id, c] of s.kit.clients) {
      const err = c.lastRejection();
      out[id] = err === null ? null : asJson(err);
    }
    return out;
  },
});

export const rosterSize = defineObservation({
  name: 'rosterSize',
  observe: (s) => s.kit.server.getRoster().length,
});

export const invariantViolations = defineObservation({
  name: 'invariantViolations',
  observe: async (s) => {
    const v = await s.kit.checkInvariants();
    return v === null ? [] : [`${v.invariant}: ${v.detail}`];
  },
});

export const converged = defineObservation({
  name: 'converged',
  *observe() {
    const o = yield* observe({
      serverHash,
      clientHash,
      connected,
      crashedIds,
    });
    const skip = new Set(o.crashedIds);
    const ids = o.connected.filter((id) => !skip.has(id));
    return ids.every((id) => o.clientHash[id] === o.serverHash);
  },
});

export const invariants = defineProperty({
  name: 'invariants',
  *watch() {
    const o = yield* observe({ serverCrashed, invariantViolations });
    if (!o.serverCrashed && o.invariantViolations.length > 0) {
      throw new Error(o.invariantViolations.join('; '));
    }
  },
});

export const converges = defineProperty({
  name: 'converges',
  *watch() {
    const o = yield* observe({
      quiet,
      converged,
      cut: partitioned,
      held: heldClients,
      down: downClients,
      serverCrashed,
    });
    if (
      o.quiet &&
      o.cut.length === 0 &&
      o.held.length === 0 &&
      o.down.length === 0 &&
      !o.serverCrashed &&
      !o.converged
    ) {
      throw new Error('quiet but diverged');
    }
  },
});

export const ROOM_PROPERTIES = [invariants, converges];

export type { RoomSurface };
export { ROOM_SERVER_ENDPOINT, roomClientEndpoint };
