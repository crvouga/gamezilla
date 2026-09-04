import { defineSystem, draw, start } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import { asSeededRng } from '@pkgs/dst/kernel';
import fc from 'fast-check';
import type { MatchmakingSimBackend } from '../world-api';
import {
  assertReplicaAgreement,
  buildMatchmakingKit,
  type MatchmakingSurface,
} from './facade';
import { startReplica, startStore } from './node-kinds';
import {
  createMatchmakingSystemConfig,
  type MatchmakingSystemConfig,
  type MatchmakingSystemOpts,
} from './system';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export type DefineMatchmakingSystemOpts = MatchmakingSystemOpts & {
  readonly name?: string;
};

function defineMatchmakingSystemInner(
  config: MatchmakingSystemConfig,
  opts?: DefineMatchmakingSystemOpts
) {
  return defineSystem({
    name: opts?.name ?? 'matchmaking.replicas',
    async *generate(session) {
      const replicaCount = yield* draw(gen(fc.integer({ min: 1, max: 3 })));
      const backend = yield* draw(
        gen(fc.constant('sqlite' as MatchmakingSimBackend))
      );
      const { store } = await startStore(session.fork('store'), backend);
      const boots = await Promise.all(
        range(replicaCount).map((i) => {
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
 * Framework-owned matchmaking world: shared SQL store + N replicas.
 */
export function defineMatchmakingSystem(opts?: DefineMatchmakingSystemOpts) {
  return defineMatchmakingSystemInner(
    createMatchmakingSystemConfig(opts),
    opts
  );
}

export const matchmaking = defineMatchmakingSystem();

const { defineObservation, defineAction, defineProperty } = matchmaking;

export const caps = defineObservation({
  name: 'caps',
  observe: (s: MatchmakingSurface) => [...s.session.caps] as string[],
});

export const replicaIds = defineObservation({
  name: 'replicaIds',
  observe: (s: MatchmakingSurface) => [...s.replicas.keys()],
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

export const tickAll = defineAction({
  name: 'tickAll',
  *generate() {
    yield {
      weight: 1,
      act: (s: MatchmakingSurface) => s.tickAll({ maxPassesPerPartition: 2 }),
    };
  },
});

export const passTime = defineAction({
  name: 'passTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield {
      weight: 1,
      act: (s: MatchmakingSurface) => s.advance(ms),
    };
  },
});

export const MATCHMAKING_ACTIONS = [tickAll, passTime];

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

export const MATCHMAKING_SYSTEM = matchmaking;

export type MatchmakingSystemDef = ReturnType<typeof defineMatchmakingSystem>;
export type MatchmakingSystemWorld = MatchmakingSurface;

export type StartMatchmakingArgs = {
  readonly seed: number | bigint | string;
  readonly replicas?: number;
  readonly backend?: MatchmakingSimBackend;
  readonly schema?: import('../../interface/schema').MatchmakingSchema;
  readonly radius?: import('../../interface/types').RadiusOptions;
  readonly tuning?: Partial<
    import('../../interface/matchmaking').MatchmakingTuning
  >;
};

/** Boot a matchmaking run via {@link start} (pinned replica count / backend). */
export async function startMatchmaking(
  args: StartMatchmakingArgs
): Promise<import('@pkgs/dst').Script<MatchmakingSurface>> {
  const needsCustom =
    args.schema !== undefined ||
    args.radius !== undefined ||
    args.tuning !== undefined;
  const system = needsCustom
    ? defineMatchmakingSystem({
        ...(args.schema !== undefined ? { schema: args.schema } : {}),
        ...(args.radius !== undefined ? { radius: args.radius } : {}),
        ...(args.tuning !== undefined ? { tuning: args.tuning } : {}),
      })
    : matchmaking;
  return start(system, {
    seed: args.seed,
    draws: [args.replicas ?? 1, args.backend ?? 'sqlite'],
    properties: MATCHMAKING_PROPERTIES,
  });
}

/**
 * Imperative pin helper — surface + dispose (legacy `openMatchmakingWorld`).
 */
export async function openMatchmakingWorld(
  args: StartMatchmakingArgs
): Promise<MatchmakingSurface & AsyncDisposable> {
  const run = await startMatchmaking(args);
  return Object.assign(run._internal.surface, {
    async [Symbol.asyncDispose]() {
      await run[Symbol.asyncDispose]();
    },
  });
}

export type { MatchmakingSurface };
