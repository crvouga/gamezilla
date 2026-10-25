import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { matchRoomGame } from '@libs/game-matchmaking-shared-ts/match-room';
import { simulationControls } from '@libs/game-session-client-ts/simulation-controls';
import {
  connectSimulationPresentation,
  type SimulationPresentation,
} from '@libs/game-session-client-ts/simulation-presentation-session';
import type { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import { simulationReplicaMeasures } from '@libs/game-session-shared-ts/simulation-telemetry';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import { matchingMultiplayerRoomGame } from './multiplayer-room-game';
import type { MatchRoomClient } from './use-match-room';

/** Matched play uses its already-open authoritative room, including viewers with no paddle. */
export function useMatchedSimulation(
  current: Accessor<MultiplayerGame>,
  room: Accessor<MatchRoomClient | null>,
  myId: Accessor<string>,
  online: Accessor<boolean>
) {
  const rules = useTurnGames();
  const clock = useClock();
  const timers = useTimers();
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
  createEffect(() => {
    const live = room();
    const id = key();
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
      timers,
      generation: () => {
        const execution = acceptedRoom()?.execution;
        return execution === undefined
          ? undefined
          : `${execution.epoch}:${execution.inputGeneration}`;
      },
      isReady: () =>
        untrack(online) &&
        acceptedRoom() !== null &&
        RoomMetaAttr.isSynced.from(live.getSnapshot()),
      send: live.sendSignal.bind(live),
      subscribeSignal: live.subscribeSignal.bind(live),
      subscribeRoom: live.subscribe.bind(live),
      changed: setShown,
      measure: simulationReplicaMeasures('matched'),
    });
    replica = connection.replica;
    createEffect(() => {
      if (online()) connection.refresh();
    });
    onCleanup(() => {
      connection.dispose();
      if (replica === connection.replica) replica = null;
    });
  });
  const sides = createMemo(() =>
    !online() || key() === ''
      ? []
      : (['white', 'black'] as const).filter(
          (side) =>
            current()[side === 'white' ? 'white_id' : 'black_id'] === myId()
        )
  );
  const controls = createMemo(() =>
    simulationControls({
      sides: sides(),
      paused: shown().paused,
      stale: shown().stale || !online(),
      replica: () => replica,
    })
  );
  return {
    active: () => key() !== '',
    position: () => shown().position,
    controls,
  };
}
