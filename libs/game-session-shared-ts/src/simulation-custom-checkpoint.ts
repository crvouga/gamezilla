import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
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
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { finishCustomGame } from './custom-game-play';
import { changedCustomGames, refuseCustomGame } from './custom-game-result';
import {
  type CustomGame,
  type CustomGames,
  CustomGamesAttr,
} from './custom-game-state';
import {
  simulationAbsenceWinner,
  simulationAwaitsAbsence,
} from './simulation-absence';
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

export function simulationCustomEffects(
  game: CustomGame | null
): readonly RoomEffect[] {
  const execution = game?.execution;
  return simulationAwaitsAbsence(execution)
    ? [
        ScheduleEffect({
          id: SIMULATION_DISCONNECT_SCHEDULE,
          at: execution.expiresAt,
          payload: ExpireSimulation({
            gameId: game!.id,
            epoch: execution.epoch,
            expiresAt: execution.expiresAt,
          }),
        }),
      ]
    : [CancelScheduleEffect({ id: SIMULATION_DISCONNECT_SCHEDULE })];
}

/** The authority checkpoints boundaries, never each simulation tick. */
function recordSimulationGames(
  games: CustomGames,
  ctx: GameCommandContext,
  rules: TurnGames
): HandleResult {
  const changed = changedCustomGames(games, ctx, rules);
  return changed.ok
    ? {
        ...changed,
        effects: [
          ...(changed.effects ?? []),
          ...simulationCustomEffects(games.current),
        ],
      }
    : changed;
}

export function checkpointCustomSimulation(
  state: RoomState,
  ctx: GameCommandContext,
  checkpoint: SimulationCheckpoint,
  rules: TurnGames
): HandleResult {
  if (ctx.identity !== ROOM_SERVICE_IDENTITY)
    return refuseCustomGame('only the game authority records live state');
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  if (
    game === null ||
    game.id !== checkpoint.gameId ||
    game.status !== 'active'
  )
    return refuseCustomGame('this game is no longer running');
  if (staleSimulationCheckpoint(game.execution, checkpoint))
    return recordSimulationGames(games, ctx, rules);
  if (!validSimulationCheckpoint(game.execution, checkpoint))
    return refuseCustomGame('this live state belongs to an earlier game');
  const simulation = rules.simulation(rules.forPosition(game.fen).id);
  const decoded = simulation?.codec.decode(checkpoint.position);
  if (
    simulation === undefined ||
    decoded == null ||
    !rules.forPosition(game.fen).recognizes(checkpoint.position)
  )
    return refuseCustomGame('invalid live game state');
  // A queued checkpoint may share a tick with a newer discrete command.
  if (
    simulationCommandKey(simulation, game.fen) !==
    simulationCommandKey(simulation, checkpoint.position)
  )
    return recordSimulationGames(games, ctx, rules);
  const result = simulation.result(decoded);
  const execution = {
    ...checkpoint.execution,
    phase:
      result === null ? checkpoint.execution.phase : ('completed' as const),
    expiresAt: result === null ? checkpoint.execution.expiresAt : null,
  };
  if (result === null && execution.phase === 'completed')
    return refuseCustomGame('the game has not finished');
  let next: CustomGame = {
    ...game,
    fen: checkpoint.position,
    execution,
    revision: game.revision + 1,
  };
  if (result !== null)
    next = finishCustomGame(
      next,
      result.winner === 'draw'
        ? 'draw'
        : `${result.winner} wins by ${result.reason}`,
      ctx.ts
    );
  else if (execution.phase === 'abandoned')
    next = finishCustomGame(next, 'cancelled', ctx.ts);
  return recordSimulationGames({ ...games, current: next }, ctx, rules);
}

/** A persistent room deadline ends an interrupted game even after every socket is gone. */
export function expireCustomSimulation(
  state: RoomState,
  ctx: GameCommandContext,
  expiry: SimulationExpiry,
  rules: TurnGames
): HandleResult {
  if (ctx.identity !== ROOM_SCHEDULER_IDENTITY)
    return refuseCustomGame('only the game authority ends an interrupted game');
  const games = CustomGamesAttr.from(state);
  const game = games.current;
  const execution = game?.execution;
  if (
    game === null ||
    game.status !== 'active' ||
    execution === undefined ||
    game.id !== expiry.gameId ||
    execution.epoch !== expiry.epoch ||
    !simulationAwaitsAbsence(execution) ||
    execution.expiresAt !== expiry.expiresAt ||
    ctx.ts < expiry.expiresAt
  )
    return refuseCustomGame('this interruption is no longer current');
  const winner = simulationAbsenceWinner(game.sides, execution.missing);
  const abandoned = winner === null;
  const outcome = abandoned
    ? 'cancelled'
    : `${winner} wins because the opponent stayed away`;
  const next = finishCustomGame(
    {
      ...game,
      execution: {
        ...execution,
        phase: abandoned ? 'abandoned' : 'completed',
        expiresAt: null,
      },
    },
    outcome,
    ctx.ts
  );
  return recordSimulationGames({ ...games, current: next }, ctx, rules);
}
