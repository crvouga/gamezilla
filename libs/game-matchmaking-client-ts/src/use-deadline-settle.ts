import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerDeadlineMs } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import { createTimedValue, useTimers } from '@pkgs/clock-client-ts/solid';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';
import { multiplayerSettleDue } from './multiplayer-settle-due';

const RETRY_MS = 2000;

/**
 * When this device sees a deadline pass — a missed first move or a clock at
 * zero — or sees a live game's result its durable record does not have yet,
 * it asks the server to settle the game. The server decides on its own clock
 * and its own room; until the game changes, the device asks again now and then.
 */
export function useDeadlineSettle(args: {
  readonly game: Accessor<MultiplayerGame | null>;
  /** The durable record of the game shown, which a live room can be ahead of. */
  readonly stored: Accessor<MultiplayerGame | null>;
  readonly online: Accessor<boolean>;
  readonly settle: (gameId: string) => Promise<void>;
}): void {
  const timers = useTimers();
  const [retry, setRetry] = createSignal(0);
  const due = createTimedValue(
    (now) => multiplayerSettleDue(args.game(), args.stored(), now),
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
