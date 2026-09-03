/**
 * Matchmaking system kernel. Topologies are framework-owned via
 * {@link defineMatchmakingSystem} + `start` / `check` / `replay`.
 */

export {
  addReplica,
  type HttpSpec,
  httpRequest,
  type JoinSpec,
  type JoinsDuringTickSpec,
  join,
  joinsDuringTick,
  leave,
  MATCHMAKING_ACTIONS,
  passTime,
  ready,
  type TickSpec,
  tick,
  tickAll,
  tickAllWith,
  type UpdateFormulasSpec,
  updateFormulas,
  type WaitSpec,
  waitNeverMatched,
  waitUntilMatched,
} from './actions';
export {
  type DefineMatchmakingSystemOpts,
  defineMatchmakingSystem,
  MATCHMAKING_SYSTEM,
  type MatchmakingSurface,
  type MatchmakingSystemDef,
  matchmaking,
  type StartMatchmakingArgs,
  startMatchmaking,
} from './define-matchmaking-system';
export { SIM_AUTH_HEADER, SIM_AUTH_HEADERS, simRequireAuth } from './http';
export { startReplica, startStore } from './node-kinds';
export {
  agreementViolations,
  caps,
  lastHttp,
  lastLeave,
  lastTick,
  lastTickAll,
  lastUpdate,
  MATCHMAKING_PROPERTIES,
  participantIds,
  replicaIds,
  replicasAgree,
  statusAcrossReplicas,
  statusById,
  statuses,
  statusOf,
} from './observations';
export type { ParticipantTarget } from './refs';
export {
  createMatchmakingSystemConfig,
  type MatchmakingSystemConfig,
  type MatchmakingSystemOpts,
} from './system';
