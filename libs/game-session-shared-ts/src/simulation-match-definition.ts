import {
  DecideMultiplayerGame,
  decideMatchIntent,
  multiplayerGameFromRoom,
} from '@libs/game-matchmaking-shared-ts/match-intent';
import {
  MATCH_GAME_KEY,
  MultiplayerGameChanged,
  matchRoomGame,
  matchRoomModule,
} from '@libs/game-matchmaking-shared-ts/match-room';
import {
  multiplayerOwner,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomRuntimePorts } from '@pkgs/room-root-shared-ts/runtime';
import { ROOM_SERVICE_IDENTITY } from '@pkgs/room-root-shared-ts/service-identity';
import type {
  HandleResult,
  RoomModule,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { GameSide, TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  checkpointMatchSimulation,
  expireMatchSimulation,
  refuseMatchSimulation,
  simulationMatchEffects,
} from './simulation-match-checkpoint';
import {
  SessionSimulation,
  type SimulationSessionView,
} from './simulation-session-runtime';
import {
  CheckpointSimulation,
  ExpireSimulation,
} from './simulation-session-state';
import {
  simulationFailed,
  simulationInputProcessingMeasures,
  simulationMeasures,
} from './simulation-telemetry';

function selectMatchSimulation(
  state: RoomState,
  rules: TurnGames
): SimulationSessionView | null {
  const game = matchRoomGame(state);
  if (game === null) return null;
  const simulation = rules.simulation(rules.forPosition(game.fen).id);
  if (simulation === undefined) return null;
  const roster = multiplayerGameFromRoom(game);
  return {
    id: game.id,
    active: game.outcome === 'ongoing',
    available: game.paused_at_ms === null,
    position: game.fen,
    simulation,
    execution: game.execution,
    controllers: new Map<GameSide, string>(
      multiplayerSides(roster).map((side) => [
        side,
        multiplayerOwner(roster, side),
      ])
    ),
    bots: [],
  };
}

function decideLiveMatch(
  state: RoomState,
  message: ReturnType<typeof DecideMultiplayerGame>,
  rules: TurnGames,
  nowMs: number
): HandleResult {
  const current = matchRoomGame(state);
  if (current === null)
    return refuseMatchSimulation('this game is unavailable');
  const simulation = rules.simulation(rules.forPosition(current.fen).id);
  const decoded = simulation?.codec.decode(current.fen);
  if (simulation === undefined || decoded == null)
    return refuseMatchSimulation('this game has no live controls');
  const result = simulation.result(decoded);
  try {
    const decided = decideMatchIntent(
      multiplayerGameFromRoom(
        result === null
          ? current
          : { ...current, outcome: result.winner, reason: result.reason }
      ),
      result === null ? message.payload : { ...message.payload, kind: 'sync' },
      { started: current.execution?.started === true, nowMs, rules }
    );
    const execution = current.execution;
    const next = {
      ...decided,
      revision: current.revision + 1,
      ...(execution === undefined
        ? {}
        : {
            execution:
              decided.outcome === 'ongoing'
                ? execution
                : {
                    ...execution,
                    phase:
                      decided.outcome === 'aborted'
                        ? ('abandoned' as const)
                        : ('completed' as const),
                    expiresAt: null,
                  },
          }),
    };
    return {
      ok: true,
      events: [MultiplayerGameChanged(next)],
      effects: simulationMatchEffects(next),
    };
  } catch (error) {
    if (!(error instanceof MutationError)) throw error;
    return refuseMatchSimulation(error.message, error.code);
  }
}

/** Continuous matches run in the existing matched room and reuse the custom execution controller. */
export function simulationMatchRoom(
  rules: TurnGames
): RoomModule<RoomState, Message, Message, string> {
  if (!rules.games.some((game) => game.simulation !== undefined))
    return matchRoomModule;
  return {
    ...matchRoomModule,
    recoverEffects: (state) => simulationMatchEffects(matchRoomGame(state)),
    handle(state, command, identity) {
      if (CheckpointSimulation.is(command.payload))
        return checkpointMatchSimulation(
          state,
          identity,
          command.payload.payload,
          rules
        );
      if (ExpireSimulation.is(command.payload))
        return expireMatchSimulation(
          state,
          identity,
          command.payload.payload,
          command.ts
        );
      if (DecideMultiplayerGame.is(command.payload))
        return identity === ROOM_SERVICE_IDENTITY
          ? decideLiveMatch(state, command.payload, rules, command.ts)
          : refuseMatchSimulation(
              'only accepted mutations decide a multiplayer game'
            );
      const current = matchRoomGame(state);
      if (
        current?.execution !== undefined &&
        MultiplayerGameChanged.is(command.payload)
      ) {
        // SQL delivers ratings and rematch metadata; it cannot replace a live decision.
        const incoming = command.payload.payload;
        return matchRoomModule.handle(
          state,
          {
            ...command,
            payload: MultiplayerGameChanged({
              ...incoming,
              fen: current.fen,
              pgn: current.pgn,
              revision: current.revision,
              turn: current.turn,
              outcome: current.outcome,
              reason: current.reason,
              draw_offer_by: current.draw_offer_by,
              execution: current.execution,
            }),
          },
          identity
        );
      }
      return matchRoomModule.handle(state, command, identity);
    },
    createRuntime: (ports) => createLiveMatchSession(ports, rules),
  };
}

function createLiveMatchSession(
  ports: RoomRuntimePorts<Message>,
  rules: TurnGames
): SessionSimulation {
  return new SessionSimulation(
    {
      clock: ports.clock,
      get timers() {
        return ports.timers;
      },
      publish: ports.publish,
      commit: ports.commit,
      enqueue: ports.enqueue,
      onError: (error) => {
        simulationFailed('matched');
        ports.onError(error);
      },
    },
    {
      persist: ports.checkpoint,
      select: (state) => selectMatchSimulation(state, rules),
      checkpoint: (view, position, change) =>
        CheckpointSimulation({ gameId: view.id, position, ...change }),
      project: (state, position, execution) => {
        const game = matchRoomGame(state);
        return game === null
          ? state
          : {
              ...state,
              [MATCH_GAME_KEY]: { ...game, fen: position, execution },
            };
      },
      measure: simulationMeasures('matched'),
      inputProcessed: simulationInputProcessingMeasures('matched'),
    }
  );
}
