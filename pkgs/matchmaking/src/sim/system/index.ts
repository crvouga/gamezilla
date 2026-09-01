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
  requireMmWorld,
} from './define-matchmaking-system';
export { mmReplicaNode, mmStoreNode } from './node-kinds';
export {
  createMatchmakingSystem,
  type MatchmakingSystem,
  type MatchmakingSystemOpts,
} from './system';
