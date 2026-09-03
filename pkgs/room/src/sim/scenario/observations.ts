import { defineSurface, type JsonValue } from '@pkgs/dst';
import { canonicalRoomJson } from '../../hash-room-state';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { RoomSurface } from './surface';

const { defineProperty } = defineSurface<RoomSurface>();

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

export function clientHash(s: RoomSurface): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
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
  return [...s.kit.clients.keys()].filter(
    (id) => s.kit.net(id).state() === 'hold'
  );
}

export function downClients(s: RoomSurface): string[] {
  return [...s.kit.clients.keys()].filter(
    (id) => s.kit.net(id).state() === 'down'
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

export function serverCrashed(s: RoomSurface): boolean {
  return s.kit.isServerCrashed();
}

export function clock(s: RoomSurface): number {
  return s.session.ports.clock.now();
}

export async function logSeq(s: RoomSurface): Promise<number> {
  return s.kit.storage.getLastSeq(s.kit.topic);
}

export function lastRejection(
  s: RoomSurface
): Record<string, JsonValue> {
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

export async function invariantViolations(
  s: RoomSurface
): Promise<string[]> {
  const v = await s.kit.checkInvariants();
  return v === null ? [] : [`${v.invariant}: ${v.detail}`];
}

export async function converged(s: RoomSurface): Promise<boolean> {
  const skip = new Set(crashedIds(s));
  const ids = connected(s).filter((id) => !skip.has(id));
  const hashes = clientHash(s);
  const server = await serverHash(s);
  return ids.every((id) => hashes[id] === server);
}

export const invariants = defineProperty({
  name: 'invariants',
  check: async (s) => {
    if (serverCrashed(s)) return;
    const msgs = await invariantViolations(s);
    if (msgs.length > 0) throw new Error(msgs.join('; '));
  },
});

export const converges = defineProperty({
  name: 'converges',
  check: async (s) => {
    if (
      quiet(s) &&
      partitioned(s).length === 0 &&
      heldClients(s).length === 0 &&
      downClients(s).length === 0 &&
      !serverCrashed(s) &&
      !(await converged(s))
    ) {
      throw new Error('quiet but diverged');
    }
  },
});

export const ROOM_PROPERTIES = [invariants, converges];

export type { RoomSurface };
export { ROOM_SERVER_ENDPOINT, roomClientEndpoint };
