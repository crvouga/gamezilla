/**
 * In-memory adapter for `@pkgs/matchmaking`.
 *
 * Import via `@pkgs/matchmaking/impl-in-memory`. Used by default contract
 * tests; production composition roots use `@pkgs/matchmaking/impl-sql`.
 */

export {
  MatchmakingImplInMemory,
  type MatchmakingImplInMemoryOptions,
} from './matchmaking';
