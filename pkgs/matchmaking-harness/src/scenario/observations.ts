import { defineProperty, type JsonValue } from '@pkgs/harness';
import { assertReplicaAgreement, type MatchmakingHarness } from './facade';
import { mmOf } from './refs';

export function asJson(value: unknown): JsonValue {
  return (
    value === undefined ? null : JSON.parse(JSON.stringify(value))
  ) as JsonValue;
}

export function caps(s: MatchmakingHarness): string[] {
  return [...s.session.caps] as string[];
}

export function replicaIds(s: MatchmakingHarness): string[] {
  return [...s.replicas.keys()];
}

/** Every alias minted by the `join` action, in insertion order. */
export function participantIds(s: MatchmakingHarness): Record<string, string> {
  return Object.fromEntries(s.refs) as Record<string, string>;
}

export async function agreementViolations(
  s: MatchmakingHarness
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
  s: MatchmakingHarness,
  participantId: string,
  replicaId?: string
): Promise<JsonValue> {
  return asJson(await mmOf(s, replicaId).status(participantId));
}

/** Status of one aliased participant, read from `replicaId` (default first). */
export async function statusOf(
  s: MatchmakingHarness,
  ref: string,
  replicaId?: string
): Promise<JsonValue> {
  const id = s.refs.get(ref);
  if (id === undefined) return null;
  return asJson(await mmOf(s, replicaId).status(id));
}

/** Status of every aliased participant, keyed by alias. */
export async function statuses(
  s: MatchmakingHarness,
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
  s: MatchmakingHarness,
  participantId: string
): Promise<Record<string, JsonValue>> {
  const out: Record<string, JsonValue> = {};
  for (const id of s.replicas.keys()) {
    out[id] = asJson(await s.replica(id).mm.status(participantId));
  }
  return out;
}

export function lastTick(s: MatchmakingHarness): JsonValue {
  return asJson(s.last.tick);
}

export function lastTickAll(s: MatchmakingHarness): JsonValue {
  return asJson(s.last.tickAll);
}

export function lastLeave(s: MatchmakingHarness): JsonValue {
  return asJson(s.last.leave);
}

export function lastUpdate(s: MatchmakingHarness): JsonValue {
  return asJson(s.last.update);
}

export function lastHttp(s: MatchmakingHarness): JsonValue {
  return asJson(s.last.http);
}

/** True when any of `refs` is matched on `replicaId` (default first). */
export async function matched(
  s: MatchmakingHarness,
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

export const replicasAgree = defineProperty({
  name: 'replicasAgree',
  check: async (s: MatchmakingHarness) => {
    const v = await agreementViolations(s);
    if (v.length > 0) throw new Error(v[0]!);
  },
});
