import type { JsonValue } from '@pkgs/dst';
import { assertReplicaAgreement, type MatchmakingSurface } from './facade';
import { mmOf } from './refs';
import { matchmaking } from './system';

export function asJson(value: unknown): JsonValue {
  return (
    value === undefined ? null : JSON.parse(JSON.stringify(value))
  ) as JsonValue;
}

export function caps(s: MatchmakingSurface): string[] {
  return [...s.session.caps] as string[];
}

export function replicaIds(s: MatchmakingSurface): string[] {
  return [...s.replicas.keys()];
}

/** Every alias minted by the `join` action, in insertion order. */
export function participantIds(s: MatchmakingSurface): Record<string, string> {
  return Object.fromEntries(s.refs) as Record<string, string>;
}

export async function agreementViolations(
  s: MatchmakingSurface
): Promise<string[]> {
  try {
    await assertReplicaAgreement(s);
    return [];
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
}

/** Status of one raw participant id, read from `replicaId` (default first). */
export async function statusById(
  s: MatchmakingSurface,
  participantId: string,
  replicaId?: string
): Promise<JsonValue> {
  return asJson(await mmOf(s, replicaId).status(participantId));
}

/** Status of one aliased participant, read from `replicaId` (default first). */
export async function statusOf(
  s: MatchmakingSurface,
  ref: string,
  replicaId?: string
): Promise<JsonValue> {
  const id = s.refs.get(ref);
  if (id === undefined) return null;
  return asJson(await mmOf(s, replicaId).status(id));
}

/** Status of every aliased participant, keyed by alias. */
export async function statuses(
  s: MatchmakingSurface,
  replicaId?: string
): Promise<Record<string, JsonValue>> {
  const out: Record<string, JsonValue> = {};
  for (const [ref, id] of s.refs) {
    out[ref] = asJson(await mmOf(s, replicaId).status(id));
  }
  return out;
}

/** One participant's status as seen by each replica, keyed by replica id. */
export async function statusAcrossReplicas(
  s: MatchmakingSurface,
  participantId: string
): Promise<Record<string, JsonValue>> {
  const out: Record<string, JsonValue> = {};
  for (const id of s.replicas.keys()) {
    out[id] = asJson(await s.replica(id).mm.status(participantId));
  }
  return out;
}

export function lastTick(s: MatchmakingSurface): JsonValue {
  return asJson(s.last.tick);
}

export function lastTickAll(s: MatchmakingSurface): JsonValue {
  return asJson(s.last.tickAll);
}

export function lastLeave(s: MatchmakingSurface): JsonValue {
  return asJson(s.last.leave);
}

export function lastUpdate(s: MatchmakingSurface): JsonValue {
  return asJson(s.last.update);
}

export function lastHttp(s: MatchmakingSurface): JsonValue {
  return asJson(s.last.http);
}

/** True when any of `refs` is matched on `replicaId` (default first). */
export async function matched(
  s: MatchmakingSurface,
  refs: readonly string[],
  replicaId?: string
): Promise<boolean> {
  for (const ref of refs) {
    const id = s.refs.get(ref);
    if (id === undefined) continue;
    const st = await mmOf(s, replicaId).status(id);
    if (st?.status === 'matched') return true;
  }
  return false;
}

export const replicasAgree = matchmaking.property({
  name: 'replicasAgree',
  check: async (s) => {
    const v = await agreementViolations(s);
    if (v.length > 0) throw new Error(v[0]!);
  },
});
