import { type Action, defineSurface, draw } from '@pkgs/dst';
import type { TickOptions } from '../../interface/matchmaking';
import type { DistanceFormula, JoinInput } from '../../interface/types';
import type { MatchmakingSurface } from './facade';
import { SIM_AUTH_HEADERS, simRequireAuth } from './http';
import { asJson, caps } from './observations';
import { mmOf, type ParticipantTarget, targetId } from './refs';

const { defineAction } = defineSurface<MatchmakingSurface>();

export type JoinSpec = {
  readonly ref: string;
  readonly input: JoinInput;
  readonly replicaId?: string;
};

async function joinInto(s: MatchmakingSurface, one: JoinSpec): Promise<void> {
  const handle = await s.join(one.input, one.replicaId);
  s.refs.set(one.ref, handle.participantId);
}

export const join = defineAction({
  name: 'join',
  generate(one: JoinSpec) {
    return (s) => joinInto(s, one);
  },
});

export const leave = defineAction({
  name: 'leave',
  generate(target: ParticipantTarget) {
    return async (s) => {
      s.last.leave = await mmOf(s, target.replicaId).leave(targetId(s, target));
    };
  },
});

export const ready = defineAction({
  name: 'ready',
  generate(on: { readonly replicaId?: string }) {
    return (s) => mmOf(s, on.replicaId).ready();
  },
});

export type TickSpec = {
  readonly opts?: TickOptions;
  readonly replicaId?: string;
};

export const tick = defineAction({
  name: 'tick',
  generate(on: TickSpec) {
    return async (s) => {
      s.last.tick = await s.tick(on.opts, on.replicaId);
    };
  },
});

export const tickAll = defineAction({
  name: 'tickAll',
  generate() {
    return async (s) => {
      s.last.tickAll = [...(await s.tickAll({ maxPassesPerPartition: 2 }))];
    };
  },
});

/** Scripted variant of {@link tickAll} that takes tick options. */
export const tickAllWith = defineAction({
  name: 'tickAllWith',
  generate(opts: TickOptions) {
    return async (s) => {
      s.last.tickAll = [...(await s.tickAll(opts))];
    };
  },
});

/** Scripted / poll helper — `run.apply(passTime, 500)`. */
export const passTime = defineAction({
  name: 'passTime',
  generate(ms: number) {
    return (s) => s.advance(ms);
  },
});

/** Random pool member — draws ms then delegates to typed {@link passTime}. */
export const randomPassTime = defineAction({
  name: 'randomPassTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield* passTime(ms);
  },
});

/**
 * Advance virtual time and tick all replicas — use with `untilObserved` /
 * `neverObserved` when waiting on match status (radius growth needs ticks).
 */
export const stepTime = defineAction({
  name: 'stepTime',
  generate(ms: number) {
    return async (s) => {
      await s.advance(ms);
      await s.tickAll({ maxPassesPerPartition: 4 });
    };
  },
});

export type UpdateFormulasSpec = ParticipantTarget & {
  readonly formulas: readonly DistanceFormula[];
};

export const updateFormulas = defineAction({
  name: 'updateFormulas',
  generate(on: UpdateFormulasSpec) {
    return async (s) => {
      s.last.update = await mmOf(s, on.replicaId).updateFormulas(
        targetId(s, on),
        on.formulas
      );
    };
  },
});

export const addReplica = defineAction({
  name: 'addReplica',
  generate(on: { readonly id: string }) {
    return async (s) => {
      await s.addReplica(on.id);
    };
  },
});

export type JoinsDuringTickSpec = {
  readonly tickReplicaId: string;
  readonly tickOpts?: TickOptions;
  readonly joins: readonly JoinSpec[];
  /** Virtual ms advanced before each concurrent join. */
  readonly gapMs?: number;
};

/** Race one replica's tick against joins landing on other replicas. */
export const joinsDuringTick = defineAction({
  name: 'joinsDuringTick',
  generate(plan: JoinsDuringTickSpec) {
    return async (s) => {
      await Promise.all([
        s.replica(plan.tickReplicaId).tick(plan.tickOpts),
        (async () => {
          for (const one of plan.joins) {
            await s.advance(plan.gapMs ?? 1);
            await joinInto(s, one);
          }
        })(),
      ]);
    };
  },
});

export type HttpSpec = {
  readonly path: string;
  readonly method?: 'GET' | 'POST';
  readonly body?: unknown;
  /** Omit to send the stub bearer; pass `{}` to send none. */
  readonly headers?: Record<string, string>;
  readonly replicaId?: string;
};

function appFor(s: MatchmakingSurface, replicaId?: string) {
  const key = replicaId ?? '*';
  const cached = s.apps.get(key);
  if (cached !== undefined) return cached;
  const app = mmOf(s, replicaId).app({ requireAuth: simRequireAuth });
  s.apps.set(key, app);
  return app;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export const httpRequest = defineAction({
  name: 'httpRequest',
  generate(req: HttpSpec) {
    return async (s) => {
      const method = req.method ?? 'GET';
      const res = await appFor(s, req.replicaId).request(req.path, {
        method,
        headers: {
          ...(req.headers ?? SIM_AUTH_HEADERS),
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify(req.body ?? {}) } : {}),
      });
      s.last.http = { status: res.status, body: asJson(await readBody(res)) };
    };
  },
});

export const MATCHMAKING_ACTIONS: readonly Action<MatchmakingSurface, []>[] = [
  tickAll,
  randomPassTime,
];
