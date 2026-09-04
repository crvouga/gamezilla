import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { TickOptions } from '../../interface/matchmaking';
import type { DistanceFormula, JoinInput } from '../../interface/types';
import type { MatchmakingSurface } from './facade';
import { SIM_AUTH_HEADERS, simRequireAuth } from './http';
import { asJson, caps } from './observations';
import { mmOf, type ParticipantTarget, targetId } from './refs';
import { matchmaking } from './system';

export type JoinSpec = {
  readonly ref: string;
  readonly input: JoinInput;
  readonly replicaId?: string;
};

async function joinInto(s: MatchmakingSurface, one: JoinSpec): Promise<void> {
  const handle = await s.join(one.input, one.replicaId);
  s.refs.set(one.ref, handle.participantId);
}

export const join = matchmaking.action({
  name: 'join',
  pool: false,
  act: (s, one: JoinSpec) => joinInto(s, one),
});

export const leave = matchmaking.action({
  name: 'leave',
  pool: false,
  act: async (s, target: ParticipantTarget) => {
    s.last.leave = await mmOf(s, target.replicaId).leave(targetId(s, target));
  },
});

export const ready = matchmaking.action({
  name: 'ready',
  pool: false,
  act: (s, on: { readonly replicaId?: string }) =>
    mmOf(s, on.replicaId).ready(),
});

export type TickSpec = {
  readonly opts?: TickOptions;
  readonly replicaId?: string;
};

export const tick = matchmaking.action({
  name: 'tick',
  pool: false,
  act: async (s, on: TickSpec) => {
    s.last.tick = await s.tick(on.opts, on.replicaId);
  },
});

export const tickAll = matchmaking.action({
  name: 'tickAll',
  act: async (s) => {
    s.last.tickAll = [...(await s.tickAll({ maxPassesPerPartition: 2 }))];
  },
});

/** Scripted variant of {@link tickAll} that takes tick options. */
export const tickAllWith = matchmaking.action({
  name: 'tickAllWith',
  pool: false,
  act: async (s, opts: TickOptions) => {
    s.last.tickAll = [...(await s.tickAll(opts))];
  },
});

/**
 * Advance virtual time and tick all replicas — use between `s.observe(matched,
 * …)` polls when radius growth needs ticks (plain `s.elapse` does not tick).
 */
export const stepTime = matchmaking.action({
  name: 'stepTime',
  enabled: (s) => caps(s).includes('virtualTime'),
  draw: () => gen(fc.tuple(fc.integer({ min: 0, max: 5_000 }))),
  act: async (s, ms: number) => {
    await s.session.elapse(ms);
    await s.tickAll({ maxPassesPerPartition: 4 });
  },
});

export type UpdateFormulasSpec = ParticipantTarget & {
  readonly formulas: readonly DistanceFormula[];
};

export const updateFormulas = matchmaking.action({
  name: 'updateFormulas',
  pool: false,
  act: async (s, on: UpdateFormulasSpec) => {
    s.last.update = await mmOf(s, on.replicaId).updateFormulas(
      targetId(s, on),
      on.formulas
    );
  },
});

export const addReplica = matchmaking.action({
  name: 'addReplica',
  pool: false,
  act: async (s, on: { readonly id: string }) => {
    await s.addReplica(on.id);
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
export const joinsDuringTick = matchmaking.action({
  name: 'joinsDuringTick',
  pool: false,
  act: async (s, plan: JoinsDuringTickSpec) => {
    await Promise.all([
      s.replica(plan.tickReplicaId).tick(plan.tickOpts),
      (async () => {
        for (const one of plan.joins) {
          await s.session.elapse(plan.gapMs ?? 1);
          await joinInto(s, one);
        }
      })(),
    ]);
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

export const httpRequest = matchmaking.action({
  name: 'httpRequest',
  pool: false,
  act: async (s, req: HttpSpec) => {
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
  },
});
