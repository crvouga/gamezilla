import { defineProperty } from '@pkgs/harness-shared/define-property';
import type { JsonValue } from '@pkgs/harness-shared/json';
import { assertReplicaAgreement } from './facade';
import type { MatchmakingHarness } from './facade';
import { mmOf, ownerOf } from './refs';

export function asJson(value: unknown): JsonValue {
  return (
    value === undefined ? null : JSON.parse(JSON.stringify(value))
  ) as JsonValue;
}

export function caps(s: MatchmakingHarness): string[] {
  return [...s.session.caps] as string[];
}

export function pairAllowed(
  s: MatchmakingHarness,
  ownerA: string,
  ownerB: string
): Promise<boolean> {
  return s.mm.canPair(ownerA, ownerB);
}

export function privateStatus(
  s: MatchmakingHarness,
  ownerId: string,
  participantId: string
) {
  return s.mm.status(ownerId, participantId);
}

export function currentOf(
  s: MatchmakingHarness,
  ownerId: string,
  replicaId?: string
) {
  return mmOf(s, replicaId).current(ownerId);
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
  return asJson(
    await mmOf(s, replicaId).status(ownerOf(s, participantId), participantId)
  );
}

/** Status of one aliased participant, read from `replicaId` (default first). */
export async function statusOf(
  s: MatchmakingHarness,
  ref: string,
  replicaId?: string
): Promise<JsonValue> {
  const id = s.refs.get(ref);
  if (id === undefined) return null;
  return asJson(await mmOf(s, replicaId).status(ownerOf(s, id), id));
}

/** Status of every aliased participant, keyed by alias. */
export async function statuses(
  s: MatchmakingHarness,
  replicaId?: string
): Promise<Record<string, JsonValue>> {
  const out: Record<string, JsonValue> = {};
  for (const [ref, id] of s.refs) {
    out[ref] = asJson(await mmOf(s, replicaId).status(ownerOf(s, id), id));
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
    out[id] = asJson(
      await s.replica(id).mm.status(ownerOf(s, participantId), participantId)
    );
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
    const st = await mmOf(s, replicaId).status(ownerOf(s, id), id);
    if (st?.status === 'matched') return true;
  }
  return false;
}

/** Stable digest of every aliased participant's match outcome. */
export async function matchFingerprint(s: MatchmakingHarness): Promise<string> {
  const parts: string[] = [];
  for (const id of s.refs.values()) {
    const st = await s.mm.status(ownerOf(s, id), id);
    if (st?.status !== 'matched') {
      parts.push(`${id}:waiting`);
      continue;
    }
    const peers = st.peers
      .map((x) => x.participantId)
      .sort()
      .join(',');
    parts.push(`${id}:${st.matchId}:${peers}`);
  }
  return parts.sort().join('|');
}

export const replicasAgree = defineProperty({
  name: 'replicasAgree',
  check: async (s: MatchmakingHarness) => {
    const v = await agreementViolations(s);
    if (v.length > 0) throw new Error(v[0]!);
  },
});
