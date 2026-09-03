import { type Action, defineAction, draw } from '@pkgs/dst';
import type { TickOptions } from '../../interface/matchmaking';
import type { DistanceFormula, JoinInput } from '../../interface/types';
import type { MatchmakingSurface } from './facade';
import { SIM_AUTH_HEADERS, simRequireAuth } from './http';
import { asJson, caps } from './observations';
import { mmOf, type ParticipantTarget, targetId } from './refs';

/** Scripted-only spec: `run.apply(action, spec)` supplies the value. */
function spec<T>(fallback: T) {
  return draw((): T => fallback);
}

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
  *generate() {
    const one = yield* spec<JoinSpec>({
      ref: 'p0',
      input: { data: {}, formulas: [] } as unknown as JoinInput,
    });
    yield { weight: 1, act: (s: MatchmakingSurface) => joinInto(s, one) };
  },
});

export const leave = defineAction({
  name: 'leave',
  *generate() {
    const target = yield* spec<ParticipantTarget>({ ref: 'p0' });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        s.last.leave = await mmOf(s, target.replicaId).leave(
          targetId(s, target)
        );
      },
    };
  },
});

export const ready = defineAction({
  name: 'ready',
  *generate() {
    const on = yield* spec<{ readonly replicaId?: string }>({});
    yield {
      weight: 1,
      act: (s: MatchmakingSurface) => mmOf(s, on.replicaId).ready(),
    };
  },
});

export type TickSpec = {
  readonly opts?: TickOptions;
  readonly replicaId?: string;
};

export const tick = defineAction({
  name: 'tick',
  *generate() {
    const on = yield* spec<TickSpec>({});
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        s.last.tick = await s.tick(on.opts, on.replicaId);
      },
    };
  },
});

export const tickAll = defineAction({
  name: 'tickAll',
  *generate() {
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        s.last.tickAll = [...(await s.tickAll({ maxPassesPerPartition: 2 }))];
      },
    };
  },
});

/** Scripted variant of {@link tickAll} that takes tick options. */
export const tickAllWith = defineAction({
  name: 'tickAllWith',
  *generate() {
    const opts = yield* spec<TickOptions>({ maxPassesPerPartition: 2 });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        s.last.tickAll = [...(await s.tickAll(opts))];
      },
    };
  },
});

export const passTime = defineAction({
  name: 'passTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield { weight: 1, act: (s: MatchmakingSurface) => s.advance(ms) };
  },
});

export type UpdateFormulasSpec = ParticipantTarget & {
  readonly formulas: readonly DistanceFormula[];
};

export const updateFormulas = defineAction({
  name: 'updateFormulas',
  *generate() {
    const on = yield* spec<UpdateFormulasSpec>({ ref: 'p0', formulas: [] });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        s.last.update = await mmOf(s, on.replicaId).updateFormulas(
          targetId(s, on),
          on.formulas
        );
      },
    };
  },
});

export const addReplica = defineAction({
  name: 'addReplica',
  *generate() {
    const on = yield* spec<{ readonly id: string }>({ id: 'r9' });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        await s.addReplica(on.id);
      },
    };
  },
});

export type WaitSpec = {
  /** Aliases whose `matched` status the wait is watching. */
  readonly refs: readonly string[];
  readonly replicaId?: string;
  readonly budgetMs?: number;
  readonly forMs?: number;
  readonly stepMs?: number;
};

async function anyMatched(
  s: MatchmakingSurface,
  wait: WaitSpec
): Promise<boolean> {
  for (const ref of wait.refs) {
    const id = s.refs.get(ref);
    if (id === undefined) continue;
    const st = await mmOf(s, wait.replicaId).status(id);
    if (st?.status === 'matched') return true;
  }
  return false;
}

export const waitUntilMatched = defineAction({
  name: 'waitUntilMatched',
  *generate() {
    const wait = yield* spec<WaitSpec>({ refs: [] });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        await s.waitUntil(() => anyMatched(s, wait), {
          ...(wait.budgetMs !== undefined ? { budgetMs: wait.budgetMs } : {}),
          ...(wait.stepMs !== undefined ? { stepMs: wait.stepMs } : {}),
        });
      },
    };
  },
});

export const waitNeverMatched = defineAction({
  name: 'waitNeverMatched',
  *generate() {
    const wait = yield* spec<WaitSpec>({ refs: [], forMs: 100 });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        await s.waitNever(() => anyMatched(s, wait), {
          forMs: wait.forMs ?? 100,
          ...(wait.stepMs !== undefined ? { stepMs: wait.stepMs } : {}),
        });
      },
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
  *generate() {
    const plan = yield* spec<JoinsDuringTickSpec>({
      tickReplicaId: 'r0',
      joins: [],
    });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        await Promise.all([
          s.replica(plan.tickReplicaId).tick(plan.tickOpts),
          (async () => {
            for (const one of plan.joins) {
              await s.advance(plan.gapMs ?? 1);
              await joinInto(s, one);
            }
          })(),
        ]);
      },
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
  *generate() {
    const req = yield* spec<HttpSpec>({ path: '/status/unknown' });
    yield {
      weight: 1,
      act: async (s: MatchmakingSurface) => {
        const method = req.method ?? 'GET';
        const res = await appFor(s, req.replicaId).request(req.path, {
          method,
          headers: {
            ...(req.headers ?? SIM_AUTH_HEADERS),
            ...(method === 'POST'
              ? { 'Content-Type': 'application/json' }
              : {}),
          },
          ...(method === 'POST'
            ? { body: JSON.stringify(req.body ?? {}) }
            : {}),
        });
        s.last.http = { status: res.status, body: asJson(await readBody(res)) };
      },
    };
  },
});

export const MATCHMAKING_ACTIONS: readonly Action<MatchmakingSurface>[] = [
  tickAll,
  passTime,
];
