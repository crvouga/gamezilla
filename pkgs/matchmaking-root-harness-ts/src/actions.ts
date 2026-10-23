import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { gen } from '@pkgs/harness-root-shared-ts/fast-check';
import type { TickOptions } from '@pkgs/matchmaking-root-shared-ts/matchmaking';
import type { DistanceFormula } from '@pkgs/matchmaking-root-shared-ts/types';
import fc from 'fast-check';
import type { HarnessJoinInput } from './api';
import type { MatchmakingHarness } from './facade';
import { HARNESS_AUTH_HEADERS, harnessRequireAuth } from './http';
import { LOBBY_ACTIONS } from './lobby';
import { asJson, caps } from './observations';
import type { ParticipantTarget } from './refs';
import { mmOf, targetRequest } from './refs';

export type JoinSpec = {
  readonly ref: string;
  readonly input: HarnessJoinInput;
  readonly replicaId?: string;
};

async function joinInto(s: MatchmakingHarness, one: JoinSpec): Promise<void> {
  const handle = await s.join(one.input, one.replicaId);
  s.refs.set(one.ref, handle.participantId);
}

export const join = defineAction({
  name: 'join',
  pool: false,
  act: (s: MatchmakingHarness, one: JoinSpec) => joinInto(s, one),
});

export const leave = defineAction({
  name: 'leave',
  pool: false,
  act: async (s: MatchmakingHarness, target: ParticipantTarget) => {
    s.last.leave = await mmOf(s, target.replicaId).leave(
      targetRequest(s, target)
    );
  },
});

export const ready = defineAction({
  name: 'ready',
  pool: false,
  act: (s: MatchmakingHarness, on: { readonly replicaId?: string }) =>
    mmOf(s, on.replicaId).ready(),
});

export type TickSpec = {
  readonly opts?: TickOptions;
  readonly replicaId?: string;
};

export const tick = defineAction({
  name: 'tick',
  pool: false,
  act: async (s: MatchmakingHarness, on: TickSpec) => {
    s.last.tick = await s.tick(on.opts, on.replicaId);
  },
});

export const tickAll = defineAction({
  name: 'tickAll',
  act: async (s: MatchmakingHarness) => {
    s.last.tickAll = [...(await s.tickAll({ maxPassesPerPartition: 2 }))];
  },
});

/** Scripted variant of {@link tickAll} that takes tick options. */
export const tickAllWith = defineAction({
  name: 'tickAllWith',
  pool: false,
  act: async (s: MatchmakingHarness, opts: TickOptions) => {
    s.last.tickAll = [...(await s.tickAll(opts))];
  },
});

/**
 * Advance virtual time and tick all replicas — use between `s.read(matched,
 * …)` polls when radius growth needs ticks (plain `s.elapse` does not tick).
 */
export const stepTime = defineAction({
  name: 'stepTime',
  enabled: (s: MatchmakingHarness) => caps(s).includes('virtualTime'),
  sample: () => gen(fc.tuple(fc.integer({ min: 0, max: 5_000 }))),
  act: async (s: MatchmakingHarness, ms: number) => {
    await s.session.advanceTime(ms);
    await s.tickAll({ maxPassesPerPartition: 4 });
  },
});

export type UpdateFormulasSpec = ParticipantTarget & {
  readonly formulas: readonly DistanceFormula[];
};

export const updateFormulas = defineAction({
  name: 'updateFormulas',
  pool: false,
  act: async (s: MatchmakingHarness, on: UpdateFormulasSpec) => {
    s.last.update = await mmOf(s, on.replicaId).updateFormulas(
      targetRequest(s, on),
      on.formulas
    );
  },
});

export const addReplica = defineAction({
  name: 'addReplica',
  pool: false,
  act: async (s: MatchmakingHarness, on: { readonly id: string }) => {
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
export const joinsDuringTick = defineAction({
  name: 'joinsDuringTick',
  pool: false,
  act: async (s: MatchmakingHarness, plan: JoinsDuringTickSpec) => {
    await Promise.all([
      s.replica(plan.tickReplicaId).tick(plan.tickOpts),
      (async () => {
        for (const one of plan.joins) {
          await s.session.advanceTime(plan.gapMs ?? 1);
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

function appFor(s: MatchmakingHarness, replicaId?: string) {
  const key = replicaId ?? '*';
  const cached = s.apps.get(key);
  if (cached !== undefined) return cached;
  const app = mmOf(s, replicaId).app({
    requireAuth: harnessRequireAuth,
    ownerId: (c) => c.req.header('x-test-user')!,
  });
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
  pool: false,
  act: async (s: MatchmakingHarness, req: HttpSpec) => {
    const method = req.method ?? 'GET';
    const res = await appFor(s, req.replicaId).request(req.path, {
      method,
      headers: {
        ...(req.headers ?? HARNESS_AUTH_HEADERS),
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(req.body ?? {}) } : {}),
    });
    s.last.http = { status: res.status, body: asJson(await readBody(res)) };
  },
});

export const MATCHMAKING_ACTIONS = [
  join,
  leave,
  ready,
  tick,
  tickAll,
  tickAllWith,
  stepTime,
  updateFormulas,
  addReplica,
  joinsDuringTick,
  httpRequest,
  ...LOBBY_ACTIONS,
] as const;
