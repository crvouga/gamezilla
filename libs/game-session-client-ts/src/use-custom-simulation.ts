import type { CustomGameChoice } from '@libs/game-session-shared-ts/custom-game-choice';
import { soloCustomGame } from '@libs/game-session-shared-ts/custom-game-local';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { useSpaceOpenRoomEntry } from '@libs/spaces-client-ts/space-open-rooms-store';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import { useLogger } from '@pkgs/logger-client-ts/solid';
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

/** The screen owns one controller for its board and its choices. */
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
  const logger = useLogger('local-simulation');
  const [position, setPosition] = createSignal<string | null>(null);
  const [paused, setPaused] = createSignal(true);
  const [stale, setStale] = createSignal(true);
  const [error, setError] = createSignal(false);
  let connection: ReturnType<typeof connectCustomSimulation> | null = null;
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
    const next = connectCustomSimulation({
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
      failed: (error) => {
        setError(true);
        try {
          logger.error('The local simulation stopped', { error });
        } catch {
          // Recovery remains available when the diagnostic sink fails.
        }
      },
    });
    connection = next;
    onCleanup(() => {
      next.dispose();
      if (connection === next) connection = null;
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
      if (sides().includes(side)) connection?.replica.control(side, input);
    },
    onRelease: () => connection?.replica.release(),
  }));
  return {
    position,
    controls,
    error,
    active: () => key() !== '',
    chooseLocal: (choice: CustomGameChoice) =>
      connection?.chooseLocal(choice) ?? null,
  };
}
