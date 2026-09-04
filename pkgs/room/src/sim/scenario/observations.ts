import type { JsonValue, PropertyDef } from '@pkgs/dst';
import { canonicalRoomJson } from '../../hash-room-state';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { RoomSurface } from './surface';

export function asJson(value: unknown): JsonValue {
  return JSON.parse(canonicalRoomJson(value)) as JsonValue;
}

export function clientIds(s: RoomSurface): string[] {
  return [...s.kit.clients.keys()];
}

/** Decimal kit seed — lets tests derive their own deterministic streams. */
export function seed(s: RoomSurface): string {
  return s.kit.seed.toString();
}

export async function serverHash(s: RoomSurface): Promise<string> {
  return s.kit.serverHash();
}

export async function serverState(s: RoomSurface): Promise<JsonValue> {
  return asJson(await s.kit.serverSnapshot());
}

export function clientState(s: RoomSurface): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [id, c] of s.kit.clients) {
    out[id] = asJson(c.snapshot());
  }
  return out;
}

export function clientHash(s: RoomSurface): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, c] of s.kit.clients) {
    if (!c.isConnected() || c.isCrashed()) continue;
    out[id] = c.hash();
  }
  return out;
}

export function connected(s: RoomSurface): string[] {
  return [...s.kit.clients.entries()]
    .filter(([, c]) => c.isConnected() && !c.isCrashed())
    .map(([id]) => id);
}

export function crashedIds(s: RoomSurface): string[] {
  return [...s.kit.clients.entries()]
    .filter(([, c]) => c.isCrashed())
    .map(([id]) => id);
}

export function heldClients(s: RoomSurface): string[] {
  return clientIds(s).filter((id) => s.kit.net(id).state() === 'hold');
}

/** Clients whose link drops frames (shared or directional `down`). */
export function downClients(s: RoomSurface): string[] {
  return clientIds(s).filter((id) => s.kit.net(id).down());
}

/** Clients whose link is impaired but not down — `release` restores them. */
export function releasableClients(s: RoomSurface): string[] {
  return clientIds(s).filter(
    (id) => s.kit.net(id).impaired() && !s.kit.net(id).down()
  );
}

/** Clients whose link is not dropping frames — safe targets for link tweaks. */
export function linkUpClients(s: RoomSurface): string[] {
  return clientIds(s).filter((id) => !s.kit.net(id).down());
}

/** Clients whose link is not plain `ok` (hold / down / directional / faults). */
export function impairedClients(s: RoomSurface): string[] {
  return clientIds(s).filter((id) => s.kit.net(id).impaired());
}

/** Every non-crashed client currently holds a live session. */
export function allLiveConnected(s: RoomSurface): boolean {
  return [...s.kit.clients.values()].every(
    (c) => c.isCrashed() || c.isConnected()
  );
}

export function caps(s: RoomSurface): string[] {
  return [...s.session.caps];
}

export function partitioned(s: RoomSurface): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
}

export function quiet(s: RoomSurface): boolean {
  return s.session.network.inFlight() === 0;
}

/**
 * Default link drops or duplicates frames (`mildFaults` boot, until `heal`).
 * The loopback transport has no heartbeat, so a dropped push is only
 * recovered by a resync — divergence under loss is expected, not a bug.
 */
export function lossyNetwork(s: RoomSurface): boolean {
  const f = s.session.network.faults();
  return (
    f.dropProbability > 0 ||
    f.duplicateProbability > 0 ||
    f.partitionProbability > 0
  );
}

export function serverCrashed(s: RoomSurface): boolean {
  return s.kit.isServerCrashed();
}

export function clock(s: RoomSurface): number {
  return s.session.ports.clock.now();
}

export async function logSeq(s: RoomSurface): Promise<number> {
  return s.kit.storage.getLastSeq(s.kit.topic);
}

export function lastRejection(s: RoomSurface): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [id, c] of s.kit.clients) {
    const err = c.lastRejection();
    out[id] = err === null ? null : asJson(err);
  }
  return out;
}

export function rosterSize(s: RoomSurface): number {
  return s.kit.server.getRoster().length;
}

export async function invariantViolations(s: RoomSurface): Promise<string[]> {
  const v = await s.kit.checkInvariants();
  return v === null ? [] : [`${v.invariant}: ${v.detail}`];
}

export async function converged(s: RoomSurface): Promise<boolean> {
  const h = await serverHash(s);
  const hashes = clientHash(s);
  return connected(s).every((id) => hashes[id] === h);
}

/** Server-side invariants hold at every checkpoint (unless the server is down). */
export const invariants: PropertyDef<RoomSurface> = {
  name: 'invariants',
  check: async (s) => {
    if (serverCrashed(s)) return;
    const msgs = await invariantViolations(s);
    if (msgs.length > 0) throw new Error(msgs.join('; '));
  },
};

/** Checkpoints of a fully healed, quiet network before divergence is a violation. */
const CONVERGE_GRACE_CHECKPOINTS = 2;

async function healthyButDiverged(s: RoomSurface): Promise<boolean> {
  if (!quiet(s)) return false;
  if (lossyNetwork(s)) return false;
  if (serverCrashed(s)) return false;
  if (partitioned(s).length > 0) return false;
  if (impairedClients(s).length > 0) return false;
  if (!allLiveConnected(s)) return false;
  return !(await converged(s));
}

/**
 * Quiet + healed ⇒ every live client agrees with the server. Soft reconnects
 * (welcome / re-sync) may span a couple of checkpoints, so the property only
 * fires after `CONVERGE_GRACE_CHECKPOINTS` consecutive diverged checkpoints.
 */
export const converges: PropertyDef<RoomSurface, { strikes: number }> = {
  name: 'converges',
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

export type { RoomSurface };
export { ROOM_SERVER_ENDPOINT, roomClientEndpoint };
