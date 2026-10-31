import type { Message } from '@pkgs/message-shared-ts/message';
import type {
  RoomRuntime,
  RoomRuntimePorts,
} from '@pkgs/room-root-shared-ts/runtime';
import {
  ROOM_ERROR_TYPE,
  type RoomActor,
  type RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { GameSide, TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  projectCustomSimulation,
  selectCustomSimulation,
} from './simulation-custom-selection';
import { LocalSimulationRelay } from './simulation-local-relay';
import {
  RequestSimulationSnapshot,
  SubmitSimulationInput,
} from './simulation-messages';
import { SessionSimulation } from './simulation-session-runtime';
import { CheckpointSimulation } from './simulation-session-state';
import {
  ClaimSimulationControl,
  SimulationSteering,
  SimulationSteeringChanged,
} from './simulation-steering';
import {
  simulationFailed,
  simulationInputProcessingMeasures,
  simulationMeasures,
} from './simulation-telemetry';

/** One room lifetime owns either shared execution or forwarding from its local creator. */
export function createCustomSimulationRuntime(
  ports: RoomRuntimePorts<Message>,
  rules: TurnGames
): RoomRuntime<RoomState, Message, string> {
  const relay = new LocalSimulationRelay(ports, rules);
  const shared = new SessionSimulation(
    {
      clock: ports.clock,
      get timers() {
        return ports.timers;
      },
      publish: ports.publish,
      commit: ports.commit,
      enqueue: ports.enqueue,
      onError: (error) => {
        simulationFailed('custom');
        ports.onError(error);
      },
    },
    {
      persist: ports.checkpoint,
      project: projectCustomSimulation,
      select: (state) => selectCustomSimulation(state, rules, null),
      checkpoint: (view, position, change) =>
        CheckpointSimulation({ gameId: view.id, position, ...change }),
      measure: simulationMeasures('custom'),
      inputProcessed: simulationInputProcessingMeasures('custom'),
    }
  );
  const steering = new SimulationSteering();
  let controllers: ReadonlyMap<GameSide, string> = new Map<GameSide, string>();
  let actors: readonly RoomActor[] = [];
  const people = () => [...new Set(controllers.values())];
  const publishSteering = () =>
    ports.publish(
      SimulationSteeringChanged({
        version: 1,
        steering: steering.bySide(controllers),
      })
    );
  const steer = () => {
    if (steering.presence(actors, people())) publishSteering();
  };
  return {
    recover: (state, payload) => shared.recover(state, payload),
    project: (state) => shared.project(state),
    receive: (command, identity, actor) => {
      if (relay.active) return relay.receive(command, identity, actor);
      // One device steers a person's seats; another of theirs claims it to take over.
      if (ClaimSimulationControl.is(command.payload)) {
        if (steering.claim(actor, people())) publishSteering();
        return null;
      }
      if (SubmitSimulationInput.is(command.payload) && !steering.steers(actor))
        return {
          type: ROOM_ERROR_TYPE.conflict,
          reason: 'another of your devices steers this game',
        };
      if (RequestSimulationSnapshot.is(command.payload)) publishSteering();
      return shared.receive(command, identity);
    },
    update: (state) => {
      shared.update(state);
      relay.update(state);
      const view = selectCustomSimulation(state, rules, null);
      controllers =
        view?.active === true ? view.controllers : new Map<GameSide, string>();
      steer();
    },
    presence: (next) => {
      actors = next;
      shared.presence(next);
      relay.presence(next);
      steer();
    },
    dispose: () => {
      shared.dispose();
      relay.dispose();
    },
  };
}
