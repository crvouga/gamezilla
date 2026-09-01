/**
 * Matchmaking system kernel. Worlds are framework-owned:
 * {@link defineMatchmakingSystem} + `assertSample` / `replay` / {@link openMatchmakingWorld}.
 */

export {
  defineMatchmakingSystem,
  MATCHMAKING_SYSTEM,
  openMatchmakingWorld,
  requireMmWorld,
  type DefineMatchmakingSystemOpts,
  type MatchmakingSystemDef,
  type MatchmakingSystemWorld,
  type OpenMatchmakingWorldArgs,
} from './define-matchmaking-system';
export { MM_REPLICA, MM_STORE, MM_WARMUP } from './node-kinds';
export {
  createMatchmakingSystem,
  type MatchmakingSystem,
  type MatchmakingSystemOpts,
} from './system';
