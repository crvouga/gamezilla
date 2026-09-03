/**
 * Matchmaking system kernel. Worlds are framework-owned via
 * {@link defineMatchmakingSystem} + `start` / `check` / `replay`.
 */

export {
  type DefineMatchmakingSystemOpts,
  defineMatchmakingSystem,
  MATCHMAKING_ACTIONS,
  MATCHMAKING_PROPERTIES,
  MATCHMAKING_SYSTEM,
  type MatchmakingSurface,
  type MatchmakingSystemDef,
  type MatchmakingSystemWorld,
  matchmaking,
  openMatchmakingWorld,
  passTime,
  type StartMatchmakingArgs,
  startMatchmaking,
  tickAll,
} from './define-matchmaking-system';
export { startReplica, startStore } from './node-kinds';
export {
  createMatchmakingSystemConfig,
  type MatchmakingSystemConfig,
  type MatchmakingSystemOpts,
} from './system';
