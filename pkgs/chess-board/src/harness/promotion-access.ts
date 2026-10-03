import { chessBoardPromotionTestId } from '@pkgs/chess-board-core/probe';
import type { BoardWorld } from './board-world';
export const readPromotionAccess = (w: BoardWorld) => ({
  names: (['q', 'r', 'b', 'n'] as const).map(
    (piece) =>
      w.app.host
        .querySelector(
          `[data-testid="${chessBoardPromotionTestId('example-board', piece)}"]`
        )
        ?.getAttribute('aria-label') ?? ''
  ),
  focusedSquare: document.activeElement?.getAttribute('data-square') ?? null,
  focusedControl: document.activeElement?.getAttribute('data-testid') ?? null,
  automaticQueen: w.app.config().autoPromoteQueen === true,
});
export const readSoundAuthority = (w: BoardWorld) => ({
  enabled: w.app.config().sound !== false,
});
