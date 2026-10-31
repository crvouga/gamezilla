import type { GameSeatLook as FrameSeatLook } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSeatLook } from '@pkgs/ui-root-client-ts/game-seat-swatch';

/** A game's seat look as the design system's swatch draws it (`3` → `player3`). */
export function frameSwatch(look: FrameSeatLook): GameSeatLook {
  return look.color === undefined
    ? { mark: look.mark }
    : { color: `player${look.color}`, mark: look.mark };
}
