import { defineSystem, type Run, start } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import { asSeededRng } from '@pkgs/dst/kernel';
import fc from 'fast-check';
import type { MatchmakingTuning } from '../../interface/matchmaking';
import type { MatchmakingSchema } from '../../interface/schema';
import type { RadiusOptions } from '../../interface/types';
import type { MatchmakingSimBackend } from '../sim-api';
import { buildMatchmakingKit, type MatchmakingSurface } from './facade';
import { startReplica, startStore } from './node-kinds';
import { MATCHMAKING_PROPERTIES } from './observations';
import {
  createMatchmakingSystemConfig,
  type MatchmakingSystemConfig,
  type MatchmakingSystemOpts,
} from './system';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export type MatchmakingKnobs = {
  readonly replicas: number;
  readonly backend: MatchmakingSimBackend;
};

export const DEFAULT_MATCHMAKING_KNOBS: MatchmakingKnobs = {
  replicas: 1,
  backend: 'sqlite',
};

export function matchmakingKnobs(
  knobs?: Partial<MatchmakingKnobs>
): MatchmakingKnobs {
  return { ...DEFAULT_MATCHMAKING_KNOBS, ...knobs };
}

export const arbMatchmakingKnobs = (): fc.Arbitrary<MatchmakingKnobs> =>
  fc.record({
    replicas: fc.integer({ min: 1, max: 3 }),
    backend: fc.constant('sqlite' as MatchmakingSimBackend),
  });

export type DefineMatchmakingSystemOpts = MatchmakingSystemOpts & {
  readonly name?: string;
};

function defineMatchmakingSystemInner(
  config: MatchmakingSystemConfig,
  opts?: DefineMatchmakingSystemOpts
) {
  return defineSystem({
    name: opts?.name ?? 'matchmaking.replicas',
    async generate(session, knobs: MatchmakingKnobs) {
      const { store } = await startStore(session.fork('store'), knobs.backend);
      const boots = await Promise.all(
        range(knobs.replicas).map((i) => {
          const id = `r${String(i)}`;
          return startReplica(session.fork(id), store, id, config);
        })
      );
      const surface = buildMatchmakingKit({
        session,
        store,
        boots,
        config,
        rng: asSeededRng(session.ports.rng as never),
      });
      const sessionDispose = session.dispose.bind(session);
      (session as { dispose: () => Promise<void> }).dispose = async () => {
        try {
          await store.close();
        } finally {
          await sessionDispose();
        }
      };
      return surface;
    },
  });
}

/**
 * Framework-owned matchmaking topology: shared SQL store + N replicas.
 */
export function defineMatchmakingSystem(opts?: DefineMatchmakingSystemOpts) {
  return defineMatchmakingSystemInner(
    createMatchmakingSystemConfig(opts),
    opts
  );
}

export const matchmaking = defineMatchmakingSystem();

export const MATCHMAKING_SYSTEM = matchmaking;

export type MatchmakingSystemDef = ReturnType<typeof defineMatchmakingSystem>;

export type StartMatchmakingArgs = {
  readonly seed: number | bigint | string;
  readonly replicas?: number;
  readonly backend?: MatchmakingSimBackend;
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: Partial<MatchmakingTuning>;
};

function systemFor(args: StartMatchmakingArgs): MatchmakingSystemDef {
  if (
    args.schema === undefined &&
    args.radius === undefined &&
    args.tuning === undefined
  ) {
    return matchmaking;
  }
  return defineMatchmakingSystem({
    ...(args.schema !== undefined ? { schema: args.schema } : {}),
    ...(args.radius !== undefined ? { radius: args.radius } : {}),
    ...(args.tuning !== undefined ? { tuning: args.tuning } : {}),
  });
}

/** Boot a matchmaking run via {@link start} (pinned replica count / backend). */
export async function startMatchmaking(
  args: StartMatchmakingArgs
): Promise<Run<MatchmakingSurface>> {
  return start(systemFor(args), {
    seed: args.seed,
    knobs: matchmakingKnobs({
      ...(args.replicas !== undefined ? { replicas: args.replicas } : {}),
      ...(args.backend !== undefined ? { backend: args.backend } : {}),
    }),
    properties: MATCHMAKING_PROPERTIES,
  });
}

export type { MatchmakingSurface };

/** Gen for `check(..., { knobs })` campaigns. */
export const genMatchmakingKnobs = () => gen(arbMatchmakingKnobs());
