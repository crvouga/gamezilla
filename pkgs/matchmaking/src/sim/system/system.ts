import type { MatchmakingTuning } from '../../interface/matchmaking';
import type { MatchmakingSchema } from '../../interface/schema';
import type { RadiusOptions } from '../../interface/types';
import type { WorldReplicaOps } from '../handles';
import type { SimStore } from '../store';
import type {
  MatchmakingSimBackend,
  MatchmakingSimWorld,
  ReplicaHandle,
} from '../world-api';

/**
 * Mutable bag shared by `mm.*` node kinds. Filled during boot; scenarios
 * reach the facade via {@link requireMmWorld}.
 */
export type MatchmakingSystem = {
  readonly schema: MatchmakingSchema;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: Partial<MatchmakingTuning>;
  store: SimStore | null;
  replicas: Map<string, ReplicaHandle>;
  firstId: string | null;
  ops: WorldReplicaOps | null;
  /** Built after replicas boot — dispose closes the shared store. */
  facade: MatchmakingSimWorld | null;
};

export type MatchmakingSystemOpts = {
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: Partial<MatchmakingTuning>;
};

export function createMatchmakingSystem(
  opts?: MatchmakingSystemOpts
): MatchmakingSystem {
  return {
    schema: opts?.schema ?? {},
    radius: opts?.radius,
    tuning: opts?.tuning ?? {},
    store: null,
    replicas: new Map(),
    firstId: null,
    ops: null,
    facade: null,
  };
}

export function requireStore(system: MatchmakingSystem): SimStore {
  if (system.store === null) {
    throw new Error('matchmaking system: mm.store has not booted');
  }
  return system.store;
}

export function requireMmWorld(system: MatchmakingSystem): MatchmakingSimWorld {
  if (system.facade === null) {
    throw new Error('matchmaking system: facade not ready (warmup not booted)');
  }
  return system.facade;
}

export type { MatchmakingSimBackend };
