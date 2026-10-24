import { soloCustomGame } from '@libs/game-session-shared-ts/custom-game-local';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import type { SimulationReplica } from '@libs/game-session-shared-ts/simulation-replica';
import { useSpaceOpenRoomEntry } from '@libs/spaces-client-ts/space-open-rooms-store';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameSimulationControls } from '@pkgs/turn-game-shared-ts/game-presentation';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import { connectCustomSimulation } from './custom-simulation-session';

/** A rendered board subscribes to its existing room, or the same controller on the host's device. */
export function useCustomSimulation(
  current: Accessor<CustomGame | null>,
  myId: Accessor<string>,
  allowed: Accessor<boolean>
) {
  const rules = useTurnGames();
  const spaceId = useSpaceRoomSessionId();
  const entry = useSpaceOpenRoomEntry(() => spaceId() ?? '');
  const clock = useClock();
  const timers = useTimers();
  const createId = useCreateId();
  const [position, setPosition] = createSignal<string | null>(null);
  const [paused, setPaused] = createSignal(true);
  const [stale, setStale] = createSignal(true);
  const [error, setError] = createSignal(false);
  let replica: SimulationReplica | null = null;
  const key = createMemo(() => {
    const game = current();
    return game?.status === 'active' &&
      rules.simulation(rules.forPosition(game.fen).id) !== undefined
      ? `${game.id}:${soloCustomGame(game, rules) ? myId() : 'shared'}`
      : '';
  });
  createEffect(() => {
    const room = entry()?.room;
    const id = key();
    setPosition(null);
    setError(false);
    if (room === undefined || id === '') return;
    const connection = connectCustomSimulation({
      room,
      game: untrack(current)!,
      owner: untrack(myId),
      rules,
      clock,
      timers,
      createId,
      changed: (next) => {
        setPosition(next.position);
        setPaused(next.paused);
        setStale(next.stale);
      },
      failed: () => setError(true),
    });
    replica = connection.replica;
    onCleanup(() => {
      connection.dispose();
      if (replica === connection.replica) replica = null;
    });
  });
  const sides = createMemo(() => {
    const game = current();
    return game === null || !allowed()
      ? []
      : (['white', 'black'] as const).filter((side) =>
          game[side].kind === 'person'
            ? game[side].person === myId()
            : game[side].kind === 'local' && game.creator === myId()
        );
  });
  const controls = createMemo<GameSimulationControls>(() => ({
    paused: paused(),
    stale: stale(),
    sides: sides(),
    onInput: (side, input) => {
      if (sides().includes(side)) replica?.control(side, input);
    },
    onRelease: () => replica?.release(),
  }));
  return { position, controls, error, active: () => key() !== '' };
}
