import type { JsonValue, PropertyDef } from '@pkgs/sim';
import { canonicalRoomJson } from '../../hash-room-state';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { RoomSim } from './sim';

export function asJson(value: unknown): JsonValue {
  return JSON.parse(canonicalRoomJson(value)) as JsonValue;
}

export function clientIds(s: RoomSim): string[] {
  return [...s.kit.clients.keys()];
}

/** Decimal kit seed — lets tests derive their own deterministic streams. */
export function seed(s: RoomSim): string {
  return s.kit.seed.toString();
}

export async function serverHash(s: RoomSim): Promise<string> {
  return s.kit.serverHash();
}

export async function serverState(s: RoomSim): Promise<JsonValue> {
  return asJson(await s.kit.serverSnapshot());
}

export function clientState(s: RoomSim): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [id, c] of s.kit.clients) {
    out[id] = asJson(c.snapshot());
  }
  return out;
}

export function clientHash(s: RoomSim): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, c] of s.kit.clients) {
    if (!c.isConnected() || c.isCrashed()) continue;
    out[id] = c.hash();
  }
  return out;
}

export function connected(s: RoomSim): string[] {
  return [...s.kit.clients.entries()]
    .filter(([, c]) => c.isConnected() && !c.isCrashed())
    .map(([id]) => id);
}

export function crashedIds(s: RoomSim): string[] {
  return [...s.kit.clients.entries()]
    .filter(([, c]) => c.isCrashed())
    .map(([id]) => id);
}

export function heldClients(s: RoomSim): string[] {
  return clientIds(s).filter((id) => s.kit.net(id).state() === 'hold');
}

/** Clients whose link drops frames (shared or directional `down`). */
export function downClients(s: RoomSim): string[] {
  return clientIds(s).filter((id) => s.kit.net(id).down());
}

/** Clients whose link is impaired but not down — `release` restores them. */
export function releasableClients(s: RoomSim): string[] {
  return clientIds(s).filter(
    (id) => s.kit.net(id).impaired() && !s.kit.net(id).down()
  );
}

/** Clients whose link is not dropping frames — safe targets for link tweaks. */
export function linkUpClients(s: RoomSim): string[] {
  return clientIds(s).filter((id) => !s.kit.net(id).down());
}

/** Clients whose link is not plain `ok` (hold / down / directional / faults). */
export function impairedClients(s: RoomSim): string[] {
  return clientIds(s).filter((id) => s.kit.net(id).impaired());
}

/** Every non-crashed client currently holds a live session. */
export function allLiveConnected(s: RoomSim): boolean {
  return [...s.kit.clients.values()].every(
    (c) => c.isCrashed() || c.isConnected()
  );
}

export function caps(s: RoomSim): string[] {
  return [...s.session.caps];
}

export function partitioned(s: RoomSim): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
}

export function quiet(s: RoomSim): boolean {
  return s.session.network.inFlight() === 0;
}

/**
 * Default link drops or duplicates frames (`mildFaults` boot, until `restoreNetwork`).
 * The loopback transport has no heartbeat, so a dropped push is only
 * recovered by a resync — divergence under loss is expected, not a bug.
 */
export function lossyNetwork(s: RoomSim): boolean {
  const f = s.session.network.faults();
  return (
    f.dropProbability > 0 ||
    f.duplicateProbability > 0 ||
    f.partitionProbability > 0
  );
}

export function serverCrashed(s: RoomSim): boolean {
  return s.kit.isServerCrashed();
}

export function clock(s: RoomSim): number {
  return s.session.ports.clock.now();
}

export async function logSeq(s: RoomSim): Promise<number> {
  return s.kit.storage.getLastSeq(s.kit.topic);
}

export function lastRejection(s: RoomSim): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [id, c] of s.kit.clients) {
    const err = c.lastRejection();
    out[id] = err === null ? null : asJson(err);
  }
  return out;
}

export function rosterSize(s: RoomSim): number {
  return s.kit.server.getRoster().length;
}

export async function invariantViolations(s: RoomSim): Promise<string[]> {
  const v = await s.kit.checkInvariants();
  return v === null ? [] : [`${v.invariant}: ${v.detail}`];
}

export async function inSync(s: RoomSim): Promise<boolean> {
  const h = await serverHash(s);
  const hashes = clientHash(s);
  return connected(s).every((id) => hashes[id] === h);
}

/** Server-side invariants hold at every checkpoint (unless the server is down). */
export const invariants: PropertyDef<RoomSim> = {
  name: 'invariants',
  check: async (s) => {
    if (serverCrashed(s)) return;
    const msgs = await invariantViolations(s);
    if (msgs.length > 0) throw new Error(msgs.join('; '));
  },
};

/** Checkpoints of a fully healed, quiet network before divergence is a violation. */
const CONVERGE_GRACE_CHECKPOINTS = 2;

async function healthyButDiverged(s: RoomSim): Promise<boolean> {
  if (!quiet(s)) return false;
  if (lossyNetwork(s)) return false;
  if (serverCrashed(s)) return false;
  if (partitioned(s).length > 0) return false;
  if (impairedClients(s).length > 0) return false;
  if (!allLiveConnected(s)) return false;
  return !(await inSync(s));
}

/**
 * Quiet + healed ⇒ every live client agrees with the server. Soft reconnects
 * (welcome / re-sync) may span a couple of checkpoints, so the property only
 * fires after `CONVERGE_GRACE_CHECKPOINTS` consecutive diverged checkpoints.
 */
export const staysInSync: PropertyDef<RoomSim, { strikes: number }> = {
  name: 'staysInSync',
  setup: () => ({ strikes: 0 }),
  check: async (s, ctx) => {
    if (!(await healthyButDiverged(s))) return { strikes: 0 };
    const strikes = ctx.strikes + 1;
    if (strikes > CONVERGE_GRACE_CHECKPOINTS) {
      throw new Error('quiet but diverged');
    }
    return { strikes };
  },
};

export type { RoomSim };
export { ROOM_SERVER_ENDPOINT, roomClientEndpoint };
