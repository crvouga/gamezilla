import { endMultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerGameFromRoom } from '@libs/game-matchmaking-shared-ts/match-intent';
import {
  type MatchRoomGame,
  MultiplayerGameChanged,
  matchRoomGame,
} from '@libs/game-matchmaking-shared-ts/match-room';
import {
  CancelScheduleEffect,
  ROOM_SCHEDULER_IDENTITY,
  ScheduleEffect,
} from '@pkgs/room-root-shared-ts/builtin';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import type {
  HandleResult,
  RoomEffect,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { simulationCommandKey } from './simulation-command-state';
import {
  staleSimulationCheckpoint,
  validSimulationCheckpoint,
} from './simulation-session-checkpoint';
import {
  ExpireSimulation,
  SIMULATION_DISCONNECT_SCHEDULE,
  type SimulationCheckpoint,
  type SimulationExpiry,
} from './simulation-session-state';

export function refuseMatchSimulation(
  reason: string,
  code?: string
): HandleResult {
  return {
    ok: false,
    error: {
      type: ROOM_ERROR_TYPE.conflict,
      reason,
      ...(code === undefined ? {} : { code }),
    },
  };
}

export function simulationMatchEffects(
  game: MatchRoomGame | null
): readonly RoomEffect[] {
  const execution = game?.execution;
  return game?.outcome === 'ongoing' &&
    execution?.phase === 'paused' &&
    execution.expiresAt !== null
    ? [
        ScheduleEffect({
          id: SIMULATION_DISCONNECT_SCHEDULE,
          at: execution.expiresAt,
          payload: ExpireSimulation({
            gameId: game.id,
            epoch: execution.epoch,
            expiresAt: execution.expiresAt,
          }),
        }),
      ]
    : [CancelScheduleEffect({ id: SIMULATION_DISCONNECT_SCHEDULE })];
}

export function checkpointMatchSimulation(
  state: RoomState,
  identity: string,
  checkpoint: SimulationCheckpoint,
  rules: TurnGames
): HandleResult {
  if (identity !== ROOM_SERVICE_IDENTITY)
    return refuseMatchSimulation('only the game authority records live state');
  const game = matchRoomGame(state);
  if (game === null || game.id !== checkpoint.gameId)
    return refuseMatchSimulation('this game is unavailable');
  if (game.outcome !== 'ongoing') return { ok: true, events: [] };
  if (staleSimulationCheckpoint(game.execution, checkpoint))
    return retainMatchSimulation(game);
  if (!validSimulationCheckpoint(game.execution, checkpoint))
    return refuseMatchSimulation('this live state belongs to an earlier game');
  const simulation = rules.simulation(rules.forPosition(game.fen).id);
  const decoded = simulation?.codec.decode(checkpoint.position);
  if (simulation === undefined || decoded == null)
    return refuseMatchSimulation('invalid live game state');
  if (
    simulationCommandKey(simulation, game.fen) !==
    simulationCommandKey(simulation, checkpoint.position)
  )
    return retainMatchSimulation(game);
  const result = simulation.result(decoded);
  if (result === null && checkpoint.execution.phase === 'completed')
    return refuseMatchSimulation('the game has not finished');
  const next: MatchRoomGame = {
    ...game,
    fen: checkpoint.position,
    revision: game.revision + 1,
    execution: checkpoint.execution,
    ...(result === null
      ? {}
      : { outcome: result.winner, reason: result.reason }),
    ...(checkpoint.execution.phase === 'abandoned'
      ? { outcome: 'aborted' as const, reason: 'simulation unavailable' }
      : {}),
  };
  return {
    ok: true,
    events: [MultiplayerGameChanged(next)],
    effects: simulationMatchEffects(next),
  };
}

function retainMatchSimulation(game: MatchRoomGame): HandleResult {
  return {
    ok: true,
    events: [MultiplayerGameChanged(game)],
    effects: simulationMatchEffects(game),
  };
}

export function expireMatchSimulation(
  state: RoomState,
  identity: string,
  expiry: SimulationExpiry,
  now: number
): HandleResult {
  if (identity !== ROOM_SCHEDULER_IDENTITY)
    return refuseMatchSimulation(
      'only the game authority ends an interrupted game'
    );
  const game = matchRoomGame(state);
  const execution = game?.execution;
  if (
    game === null ||
    game.id !== expiry.gameId ||
    game.outcome !== 'ongoing' ||
    execution?.phase !== 'paused' ||
    execution.epoch !== expiry.epoch ||
    execution.expiresAt !== expiry.expiresAt ||
    now < expiry.expiresAt
  )
    return { ok: true, events: [] };
  const abandoned = execution.missing.length !== 1;
  const next: MatchRoomGame = {
    ...endMultiplayerGame(
      multiplayerGameFromRoom(game),
      abandoned
        ? 'aborted'
        : execution.missing[0] === 'white'
          ? 'black'
          : 'white',
      abandoned ? 'everyone stayed away' : 'opponent stayed away'
    ),
    execution: {
      ...execution,
      phase: abandoned ? 'abandoned' : 'completed',
      expiresAt: null,
    },
    revision: game.revision + 1,
  };
  return {
    ok: true,
    events: [MultiplayerGameChanged(next)],
    effects: simulationMatchEffects(next),
  };
}
