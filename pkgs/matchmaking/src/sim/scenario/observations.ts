import { defineSurface, type JsonValue, observe } from '@pkgs/dst';
import { assertReplicaAgreement, type MatchmakingSurface } from './facade';
import { mmOf } from './refs';

const { defineObservation, defineProperty } =
  defineSurface<MatchmakingSurface>();

export function asJson(value: unknown): JsonValue {
  return (
    value === undefined ? null : JSON.parse(JSON.stringify(value))
  ) as JsonValue;
}

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps] as string[],
});

export const replicaIds = defineObservation({
  name: 'replicaIds',
  observe: (s) => [...s.replicas.keys()],
});

/** Every alias minted by the `join` action, in insertion order. */
export const participantIds = defineObservation({
  name: 'participantIds',
  observe: (s) => Object.fromEntries(s.refs) as Record<string, string>,
});

export const agreementViolations = defineObservation({
  name: 'agreementViolations',
  observe: async (s) => {
    try {
      await assertReplicaAgreement(s);
      return [] as string[];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  },
});

/** Status of one raw participant id, read from `replicaId` (default first). */
export const statusById = defineObservation({
  name: 'statusById',
  observe: async (s, participantId: string, replicaId?: string) =>
    asJson(await mmOf(s, replicaId).status(participantId)),
});

/** Status of one aliased participant, read from `replicaId` (default first). */
export const statusOf = defineObservation({
  name: 'statusOf',
  observe: async (s, ref: string, replicaId?: string) => {
    const id = s.refs.get(ref);
    if (id === undefined) return null;
    return asJson(await mmOf(s, replicaId).status(id));
  },
});

/** Status of every aliased participant, keyed by alias. */
export const statuses = defineObservation({
  name: 'statuses',
  observe: async (s, replicaId?: string) => {
    const out: Record<string, JsonValue> = {};
    for (const [ref, id] of s.refs) {
      out[ref] = asJson(await mmOf(s, replicaId).status(id));
    }
    return out;
  },
});

/** One participant's status as seen by each replica, keyed by replica id. */
export const statusAcrossReplicas = defineObservation({
  name: 'statusAcrossReplicas',
  observe: async (s, participantId: string) => {
    const out: Record<string, JsonValue> = {};
    for (const id of s.replicas.keys()) {
      out[id] = asJson(await s.replica(id).mm.status(participantId));
    }
    return out;
  },
});

export const lastTick = defineObservation({
  name: 'lastTick',
  observe: (s) => asJson(s.last.tick),
});

export const lastTickAll = defineObservation({
  name: 'lastTickAll',
  observe: (s) => asJson(s.last.tickAll),
});

export const lastLeave = defineObservation({
  name: 'lastLeave',
  observe: (s) => asJson(s.last.leave),
});

export const lastUpdate = defineObservation({
  name: 'lastUpdate',
  observe: (s) => asJson(s.last.update),
});

export const lastHttp = defineObservation({
  name: 'lastHttp',
  observe: (s) => asJson(s.last.http),
});

/** True when any of `refs` is matched on `replicaId` (default first). */
export const matched = defineObservation({
  name: 'matched',
  observe: async (s, refs: readonly string[], replicaId?: string) => {
    for (const ref of refs) {
      const id = s.refs.get(ref);
      if (id === undefined) continue;
      const st = await mmOf(s, replicaId).status(id);
      if (st?.status === 'matched') return true;
    }
    return false;
  },
});

export const replicasAgree = defineProperty({
  name: 'replicasAgree',
  *watch() {
    while (true) {
      const o = yield* observe({ violations: agreementViolations });
      if (o.violations.length > 0) throw new Error(o.violations[0]!);
    }
  },
});

export const MATCHMAKING_PROPERTIES = [replicasAgree];
