import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import { soloCustomGame } from '@libs/game-session-shared-ts/custom-game-local';
import {
  type CustomGame,
  CustomGamesAttr,
} from '@libs/game-session-shared-ts/custom-game-state';
import { LocalSimulationSession } from '@libs/game-session-shared-ts/simulation-local-session';
import {
  ClaimSimulationControl,
  SimulationSteeringChanged,
} from '@libs/game-session-shared-ts/simulation-steering';
import { simulationReplicaMeasures } from '@libs/game-session-shared-ts/simulation-telemetry';
import type { SpaceOpenRoomEntry } from '@libs/spaces-client-ts/space-open-rooms-store';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { forwardLocalSimulation } from './local-simulation-forwarding';
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
  /** Which device steers each seat a person controls, as the room says. */
  readonly steered?: (steering: Readonly<Record<string, string>>) => void;
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
  const stopForwarding =
    local === null ? () => {} : forwardLocalSimulation(local, room);
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
      local === null
        ? RoomMetaAttr.isSynced.from(room.getSnapshot())
        : local.isReady(),
    send: local === null ? room.sendSignal.bind(room) : local.send.bind(local),
    subscribeSignal:
      local === null
        ? (receive) =>
            // The room says which device steers on the same signal subscription.
            room.subscribeSignal((message) => {
              if (SimulationSteeringChanged.is(message))
                options.steered?.(message.payload.steering);
              else receive(message);
            })
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
    /** A local game this device saw begin elsewhere runs on that device. */
    runsElsewhere: () => local?.runsElsewhere() ?? false,
    /** Steer this person's seats of a shared game from this device. */
    claim:
      local === null
        ? () => {
            room.sendSignal(ClaimSimulationControl({ version: 1 }));
          }
        : undefined,
    dispose: () => {
      stopForwarding();
      connection.dispose();
      local?.dispose();
    },
  };
}
