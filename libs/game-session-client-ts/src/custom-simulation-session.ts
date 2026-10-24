import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import { soloCustomGame } from '@libs/game-session-shared-ts/custom-game-local';
import {
  type CustomGame,
  CustomGamesAttr,
} from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import { simulationReplicaMeasures } from '@libs/game-session-shared-ts/simulation-telemetry';
import type { SpaceOpenRoomEntry } from '@libs/spaces-client-ts/space-open-rooms-store';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { connectSimulationPresentation } from './simulation-presentation-session';

export function connectCustomSimulation(options: {
  readonly room: SpaceOpenRoomEntry['room'];
  readonly game: CustomGame;
  readonly owner: string;
  readonly rules: TurnGames;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly changed: (value: {
    position: string | null;
    paused: boolean;
    stale: boolean;
  }) => void;
  readonly failed: (error: unknown) => void;
}) {
  const { room, game, rules, clock, timers, createId } = options;
  const definition = rules.simulation(rules.forPosition(game.fen).id)!;
  const local =
    soloCustomGame(game, rules) && game.creator === options.owner
      ? new LocalSimulationSession({
          room,
          owner: game.creator,
          rules,
          clock,
          timers,
          createId,
          onError: options.failed,
        })
      : null;
  const connection = connectSimulationPresentation({
    simulation: definition,
    clock,
    timers,
    generation: () => {
      const execution = CustomGamesAttr.from(room.getSnapshot()).current
        ?.execution;
      return execution === undefined
        ? undefined
        : `${execution.epoch}:${execution.inputGeneration}`;
    },
    isReady: () =>
      local !== null || RoomMetaAttr.isSynced.from(room.getSnapshot()),
    send: local === null ? room.sendSignal.bind(room) : local.send.bind(local),
    subscribeSignal:
      local === null
        ? room.subscribeSignal.bind(room)
        : local.subscribe.bind(local),
    subscribeRoom: room.subscribe.bind(room),
    changed: options.changed,
    measure: simulationReplicaMeasures(local === null ? 'custom' : 'local'),
  });
  if (local === null) connection.refresh();
  else local.flush().then(connection.refresh, options.failed);
  return {
    replica: connection.replica,
    chooseLocal: (choice: CustomGameChoice) => local?.choose(choice) ?? null,
    dispose: () => {
      connection.dispose();
      local?.dispose();
    },
  };
}
