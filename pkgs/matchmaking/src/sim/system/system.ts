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
 * reach the facade via framework `world.facade`.
 */
export type MatchmakingSystem = {
  readonly schema: MatchmakingSchema;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: Partial<MatchmakingTuning>;
  store: SimStore | null;
  replicas: Map<string, ReplicaHandle>;
  firstId: string | null;
  ops: WorldReplicaOps | null;
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
  };
}

export function requireStore(state: MatchmakingSystem): SimStore {
  if (state.store === null) {
    throw new Error('matchmaking system: mm.store has not booted');
  }
  return state.store;
}

export type { MatchmakingSimBackend, MatchmakingSimWorld };
