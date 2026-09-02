/**
 * Matchmaking system kernel. Worlds are framework-owned:
 * {@link defineMatchmakingSystem} + `assertSample` / `replay` / {@link openMatchmakingWorld}.
 */

export {
  type DefineMatchmakingSystemOpts,
  defineMatchmakingSystem,
  MATCHMAKING_SYSTEM,
  type MatchmakingSystemDef,
  type MatchmakingSystemWorld,
  type OpenMatchmakingWorldArgs,
  openMatchmakingWorld,
} from './define-matchmaking-system';
export { MM_BACKEND, mmReplicaNode, mmStoreNode } from './node-kinds';
export {
  createMatchmakingSystemConfig,
  type MatchmakingSystemConfig,
  type MatchmakingSystemOpts,
} from './system';
