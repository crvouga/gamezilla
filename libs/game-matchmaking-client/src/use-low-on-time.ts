import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import type { MultiplayerSide } from '@libs/game-matchmaking-shared/multiplayer-clock';
import {
  clockLeftMs,
  clockLowOnTime,
  lowOnTimeAtMs,
  sideToMove,
} from '@libs/game-matchmaking-shared/multiplayer-clock';
import { isDailyTimeControl } from '@libs/game-matchmaking-shared/time-control';
import { createTimedValue } from '@pkgs/clock-client/solid';
import { useSoundEngine } from '@pkgs/sounds-client/solid';
import { type Accessor, createEffect, createMemo } from 'solid-js';
import { useGameMark, WARNED_GAME } from './use-game-mark';
import { useOfflineSince } from './use-offline-since';

/** The side whose clock is low on time, as this device first saw it so. */
export type LowOnTime = {
  readonly side: MultiplayerSide;
  /** What that clock had left when this device first saw it low on time. */
  readonly leftMs: number;
};

type Seen = LowOnTime & { readonly turn: string };

/**
 * The clock that is low on time in this game, if one is. It wakes once, at
 * the moment the running clock becomes low on time, and keeps the time left
 * it saw then: an announcement made from it is said once, not every second.
 */
export function useLowOnTime(
  game: Accessor<MultiplayerGame>
): Accessor<LowOnTime | null> {
  const offlineSince = useOfflineSince();
  const seen = createTimedValue<Seen | null>(
    (now) => {
      const at = offlineSince() ?? now;
      const current = game();
      const side = sideToMove(current);
      if (!clockLowOnTime(current, side, at)) return null;
      return {
        side,
        leftMs: clockLeftMs(current, side, at),
        turn: `${current.id}:${String(current.revision)}`,
      };
    },
    (value, now) => {
      if (value !== null || offlineSince() !== null) return null;
      const at = lowOnTimeAtMs(game());
      return at === null || at <= now ? null : at;
    }
  );
  return createMemo<Seen | null>(seen, null, {
    equals: (before, after) => before?.turn === after?.turn,
  });
}

/**
 * The low on time warning: a sound for the person whose clock it is, once
 * per game on this device, when that clock first becomes low on time. A
 * daily game gives none, and the sounds preference silences it like any
 * other sound.
 */
export function useLowOnTimeWarning(args: {
  readonly game: Accessor<MultiplayerGame>;
  readonly myId: Accessor<string>;
  readonly low: Accessor<LowOnTime | null>;
}): void {
  const sounds = useSoundEngine();
  const warned = useGameMark(WARNED_GAME);
  createEffect(() => {
    const low = args.low();
    const game = args.game();
    if (low === null || !warned.ready() || warned.marks(game.id)) return;
    if (isDailyTimeControl(game.time_control)) return;
    const owner = low.side === 'white' ? game.white_id : game.black_id;
    if (owner !== args.myId()) return;
    warned.mark(game.id, true);
    sounds.play(sounds.Sounds.gameplay.timerWarning);
  });
}
