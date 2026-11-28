import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { matchRoomGame } from '@libs/game-matchmaking-shared-ts/match-room';
import {
  multiplayerOwner,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import {
  connectSimulationPresentation,
  type SimulationPresentation,
} from '@libs/game-session-client-ts/simulation-presentation-session';
import {
  simulationFrameMeasures,
  simulationReplicaMeasures,
} from '@libs/game-session-shared-ts/simulation-telemetry';
import type { SimulationReplica } from '@libs/game-simulation-shared-ts/simulation-replica';
import { useClock } from '@pkgs/clock-client-ts/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from 'solid-js';
import { matchingMultiplayerRoomGame } from './multiplayer-room-game';
import type { MatchRoomClient } from './use-match-room';

/** Names one run of inputs: a new epoch or input generation is a new run. */
function executionGeneration(
  execution: SimulationExecution | undefined
): string | undefined {
  return execution === undefined
    ? undefined
    : `${execution.epoch}:${execution.inputGeneration}`;
}

/** Matched play uses its already-open authoritative room, including viewers with no paddle. */
export function useMatchedSimulation(
  current: Accessor<MultiplayerGame>,
  room: Accessor<MatchRoomClient | null>,
  myId: Accessor<string>,
  online: Accessor<boolean>
) {
  const rules = useTurnGames();
  const clock = useClock();
  const [shown, setShown] = createSignal<SimulationPresentation>({
    position: null,
    paused: true,
    stale: true,
  });
  let replica: SimulationReplica | null = null;
  const key = createMemo(() =>
    current().outcome === 'ongoing' &&
    rules.simulation(rules.forPosition(current().fen).id) !== undefined
      ? current().id
      : ''
  );
  // The connection under way and whether this device is online live outside
  // the graph: a connection made while online is refreshed once, whichever
  // of the two effects runs first.
  let refresh: (() => void) | null = null;
  let connected = false;
  createEffect(online, (now) => {
    connected = now;
    if (now) refresh?.();
  });
  createEffect(
    () => [room(), key()] as const,
    ([live, id]) => {
      setShown({ position: null, paused: true, stale: true });
      if (live === null || id === '') return;
      const definition = rules.simulation(
        rules.forPosition(untrack(current).fen).id
      )!;
      const acceptedRoom = () =>
        matchingMultiplayerRoomGame(
          untrack(current),
          matchRoomGame(live.getSnapshot())
        );
      const connection = connectSimulationPresentation({
        simulation: definition,
        clock,
        generation: () => executionGeneration(acceptedRoom()?.execution),
        isReady: () =>
          untrack(online) &&
          acceptedRoom() !== null &&
          RoomMetaAttr.isSynced.from(live.getSnapshot()),
        send: live.sendSignal.bind(live),
        subscribeSignal: live.subscribeSignal.bind(live),
        subscribeRoom: live.subscribe.bind(live),
        changed: setShown,
        measure: simulationReplicaMeasures('matched'),
        framed: simulationFrameMeasures('matched'),
      });
      replica = connection.replica;
      refresh = connection.refresh;
      if (connected) connection.refresh();
      return () => {
        connection.dispose();
        if (replica === connection.replica) replica = null;
        if (refresh === connection.refresh) refresh = null;
      };
    }
  );
  const sides = createMemo(() =>
    !online() || key() === ''
      ? []
      : multiplayerSides(current()).filter(
          (side) => multiplayerOwner(current(), side) === myId()
        )
  );
  const controls = createMemo<GameSimulationControls>(() =>
    matchedControls(sides(), shown(), online(), () => replica)
  );
  return {
    active: () => key() !== '',
    position: () => shown().position,
    controls,
  };
}

/**
 * Handlers keep the sides these controls offer: a board releasing its input
 * while it is disposed must not read (and so rerun) the tree.
 */
function matchedControls(
  sides: GameSimulationControls['sides'],
  shown: SimulationPresentation,
  online: boolean,
  replica: () => SimulationReplica | null
): GameSimulationControls {
  return {
    sides,
    paused: shown.paused,
    stale: shown.stale || !online,
    onInput: (side, input) => {
      if (sides.includes(side)) replica()?.control(side, input);
    },
    onRelease: () => replica()?.release(),
  };
}
