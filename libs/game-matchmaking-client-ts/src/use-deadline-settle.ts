import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerDeadlineMs } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import { createTimedValue, useTimers } from '@pkgs/clock-client-ts/solid';
import { type Accessor, createEffect } from 'solid-js';
import {
  multiplayerSettleDue,
  unrecordedLiveResult,
} from './multiplayer-settle-due';

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
  readonly refresh: () => Promise<void>;
}): void {
  const timers = useTimers();
  const due = createTimedValue(
    (now) => multiplayerSettleDue(args.game(), args.stored(), now),
    (value) => {
      const game = args.game();
      if (value !== null || game === null) return null;
      return multiplayerDeadlineMs(game);
    }
  );
  createEffect(
    () => (args.online() ? due() : null),
    (gameId) => {
      if (gameId === null) return;
      let active = true;
      let timer: unknown;
      const reconcile = async (): Promise<void> => {
        await args.settle(gameId);
        // Settling an already recorded result is a successful no-op. There is
        // no new game push to repair a device that missed the original one.
        if (
          active &&
          unrecordedLiveResult(args.game(), args.stored()) === gameId
        )
          await args.refresh();
      };
      const attempt = () => {
        void reconcile()
          .catch(() => undefined)
          .then(() => {
            if (active && due() === gameId && args.online())
              timer = timers.setTimeout(attempt, RETRY_MS);
          });
      };
      attempt();
      return () => {
        active = false;
        if (timer !== undefined) timers.clearTimeout(timer);
      };
    }
  );
}
