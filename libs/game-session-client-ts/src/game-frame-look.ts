import type { GameSeatLook as FrameSeatLook } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameSeatLook } from '@pkgs/ui-root-client-ts/game-seat-swatch';

/**
 * A game's seat look as the design system's swatch draws it (`3` →
 * `player3`; a board's own paint, such as `disc-one`, as it is).
 */
export function frameSwatch(look: FrameSeatLook): GameSeatLook {
  if (look.color === undefined) return { mark: look.mark };
  return typeof look.color === 'number'
    ? { color: `player${look.color}`, mark: look.mark }
    : { color: look.color, mark: look.mark };
}
