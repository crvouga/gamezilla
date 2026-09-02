import type { MatchmakingTuning } from '../../interface/matchmaking';
import type { MatchmakingSchema } from '../../interface/schema';
import type { RadiusOptions } from '../../interface/types';

/** Static matchmaking config closed over by {@link defineMatchmakingSystem}. */
export type MatchmakingSystemConfig = {
  readonly schema: MatchmakingSchema;
  readonly radius: RadiusOptions | undefined;
  readonly tuning: Partial<MatchmakingTuning>;
};

export type MatchmakingSystemOpts = {
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: Partial<MatchmakingTuning>;
};

export function createMatchmakingSystemConfig(
  opts?: MatchmakingSystemOpts
): MatchmakingSystemConfig {
  return {
    schema: opts?.schema ?? {},
    radius: opts?.radius,
    tuning: opts?.tuning ?? {},
  };
}
