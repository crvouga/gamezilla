import {
  defineObservation,
  defineProperty,
  type JsonValue,
  type Observation,
} from '@pkgs/dst';
import { assertReplicaAgreement, type MatchmakingSurface } from './facade';
import { mmOf } from './refs';

export function asJson(value: unknown): JsonValue {
  return (
    value === undefined ? null : JSON.parse(JSON.stringify(value))
  ) as JsonValue;
}

function replicaTag(replicaId?: string): string {
  return replicaId ?? '*';
}

export const caps = defineObservation({
  name: 'caps',
  observe: (s: MatchmakingSurface) => [...s.session.caps] as string[],
});

export const replicaIds = defineObservation({
  name: 'replicaIds',
  observe: (s: MatchmakingSurface) => [...s.replicas.keys()],
});

/** Every alias minted by the `join` action, in insertion order. */
export const participantIds = defineObservation({
  name: 'participantIds',
  observe: (s: MatchmakingSurface) =>
    Object.fromEntries(s.refs) as Record<string, string>,
});

export const agreementViolations = defineObservation({
  name: 'agreementViolations',
  observe: async (s: MatchmakingSurface) => {
    try {
      await assertReplicaAgreement(s);
      return [] as string[];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  },
});

/** Status of one raw participant id, read from `replicaId` (default first). */
export function statusById(
  participantId: string,
  replicaId?: string
): Observation<MatchmakingSurface, JsonValue> {
  return defineObservation({
    name: `statusById(${participantId}@${replicaTag(replicaId)})`,
    observe: async (s: MatchmakingSurface) =>
      asJson(await mmOf(s, replicaId).status(participantId)),
  });
}

/** Status of one aliased participant, read from `replicaId` (default first). */
export function statusOf(
  ref: string,
  replicaId?: string
): Observation<MatchmakingSurface, JsonValue> {
  return defineObservation({
    name: `status(${ref}@${replicaTag(replicaId)})`,
    observe: async (s: MatchmakingSurface) => {
      const id = s.refs.get(ref);
      if (id === undefined) return null;
      return asJson(await mmOf(s, replicaId).status(id));
    },
  });
}

/** Status of every aliased participant, keyed by alias. */
export function statuses(
  replicaId?: string
): Observation<MatchmakingSurface, JsonValue> {
  return defineObservation({
    name: `statuses(${replicaTag(replicaId)})`,
    observe: async (s: MatchmakingSurface) => {
      const out: Record<string, JsonValue> = {};
      for (const [ref, id] of s.refs) {
        out[ref] = asJson(await mmOf(s, replicaId).status(id));
      }
      return out;
    },
  });
}

/** One participant's status as seen by each replica, keyed by replica id. */
export function statusAcrossReplicas(
  participantId: string
): Observation<MatchmakingSurface, JsonValue> {
  return defineObservation({
    name: `statusAcrossReplicas(${participantId})`,
    observe: async (s: MatchmakingSurface) => {
      const out: Record<string, JsonValue> = {};
      for (const id of s.replicas.keys()) {
        out[id] = asJson(await s.replica(id).mm.status(participantId));
      }
      return out;
    },
  });
}

export const lastTick = defineObservation({
  name: 'lastTick',
  observe: (s: MatchmakingSurface) => asJson(s.last.tick),
});

export const lastTickAll = defineObservation({
  name: 'lastTickAll',
  observe: (s: MatchmakingSurface) => asJson(s.last.tickAll),
});

export const lastLeave = defineObservation({
  name: 'lastLeave',
  observe: (s: MatchmakingSurface) => asJson(s.last.leave),
});

export const lastUpdate = defineObservation({
  name: 'lastUpdate',
  observe: (s: MatchmakingSurface) => asJson(s.last.update),
});

export const lastHttp = defineObservation({
  name: 'lastHttp',
  observe: (s: MatchmakingSurface) => asJson(s.last.http),
});

export const replicasAgree = defineProperty({
  name: 'replicasAgree',
  *watch() {
    while (true) {
      const v = (yield agreementViolations) as string[];
      if (v.length > 0) throw new Error(v[0]!);
    }
  },
});

export const MATCHMAKING_PROPERTIES = [replicasAgree];
