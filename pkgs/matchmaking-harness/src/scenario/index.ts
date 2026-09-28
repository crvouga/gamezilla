/**
 * Matchmaking system kernel. One `defineSystem` (`matchmaking`) with typed
 * args; actions / properties / hosts are declared in the catalog. Drive with
 * `matchmaking.run` / `matchmaking.explore` / `matchmaking.replay`.
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
  ready,
  stepTime,
  type TickSpec,
  tick,
  tickAll,
  tickAllWith,
  type UpdateFormulasSpec,
  updateFormulas,
} from './actions';
export {
  HARNESS_AUTH_HEADER,
  HARNESS_AUTH_HEADERS,
  harnessRequireAuth,
} from './http';
export {
  agreementViolations,
  caps,
  lastHttp,
  lastLeave,
  lastTick,
  lastTickAll,
  lastUpdate,
  matched,
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
  MATCHMAKING_START_MS,
  type MatchmakingArgs,
  type MatchmakingHarness,
  matchmaking,
} from './system';
