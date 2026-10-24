import type { Message } from '@pkgs/message-shared-ts/message';
import type {
  RoomLivePorts,
  RoomLiveSession,
} from '@pkgs/room-root-shared-ts/live';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  projectCustomSimulation,
  selectCustomSimulation,
} from './simulation-custom-selection';
import { LocalSimulationRelay } from './simulation-local-relay';
import { SessionSimulation } from './simulation-session-runtime';
import { CheckpointSimulation } from './simulation-session-state';
import { simulationFailed, simulationMeasures } from './simulation-telemetry';

/** One room lifetime owns either shared execution or forwarding from its local creator. */
export function createCustomSimulationRuntime(
  ports: RoomLivePorts<Message>,
  rules: TurnGames
): RoomLiveSession<RoomState, string> {
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
      project: projectCustomSimulation,
      select: (state) => selectCustomSimulation(state, rules, null),
      checkpoint: (view, position, change) =>
        CheckpointSimulation({ gameId: view.id, position, ...change }),
      measure: simulationMeasures('custom'),
    }
  );
  return {
    project: (state) => shared.project(state),
    receive: (command, identity, actor) =>
      relay.active
        ? relay.receive(command, identity, actor)
        : shared.receive(command, identity),
    update: (state) => {
      shared.update(state);
      relay.update(state);
    },
    presence: (actors) => {
      shared.presence(actors);
      relay.presence(actors);
    },
    dispose: () => {
      shared.dispose();
      relay.dispose();
    },
  };
}
