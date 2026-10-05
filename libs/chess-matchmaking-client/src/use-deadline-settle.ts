import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { multiplayerDeadlineMs } from '@libs/chess-matchmaking-shared/multiplayer-clock';
import { createTimedValue, useTimers } from '@pkgs/clock-client/solid';
import {
  type Accessor,
  createEffect,
  createSignal,
  onCleanup,
} from 'solid-js';

const RETRY_MS = 2000;

/**
 * When this device sees a deadline pass — a missed first move or a clock at
 * zero — it asks the server to settle the game. The server decides on its
 * own clock; until the game changes, the device asks again now and then.
 */
export function useDeadlineSettle(args: {
  readonly game: Accessor<MultiplayerGame | null>;
  readonly online: Accessor<boolean>;
  readonly settle: (gameId: string) => Promise<void>;
}): void {
  const timers = useTimers();
  const [retry, setRetry] = createSignal(0);
  const due = createTimedValue(
    (now) => {
      const game = args.game();
      const deadline = game === null ? null : multiplayerDeadlineMs(game);
      return game !== null && deadline !== null && now >= deadline
        ? game.id
        : null;
    },
    (value) => {
      const game = args.game();
      if (value !== null || game === null) return null;
      return multiplayerDeadlineMs(game);
    }
  );
  createEffect(() => {
    retry();
    const gameId = due();
    if (gameId === null || !args.online()) return;
    void args.settle(gameId).catch(() => undefined);
    const handle = timers.setTimeout(() => setRetry((n) => n + 1), RETRY_MS);
    onCleanup(() => timers.clearTimeout(handle));
  });
}
