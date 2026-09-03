import { asSeededRng, defineSystem } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { MatchmakingSimBackend } from '../sim-api';
import { buildMatchmakingKit, type MatchmakingSurface } from './facade';
import { startReplica, startStore } from './node-kinds';
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
      session.onDispose(() => store.close());
      return buildMatchmakingKit({
        session,
        store,
        boots,
        config,
        rng: asSeededRng(session.ports.rng as never),
      });
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

export type { MatchmakingSurface };

/** Gen for `explore(..., { knobs })` campaigns. */
export const genMatchmakingKnobs = () => gen(arbMatchmakingKnobs());
