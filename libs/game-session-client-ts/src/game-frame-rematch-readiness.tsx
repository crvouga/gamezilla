import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { t } from '@lingui/core/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * MOCK seam: who is ready for a rematch, as the game-over standings show it.
 *
 * Custom games record no rematch readiness: the person who created the game
 * starts the rematch (`custom-game-rematch`) and everyone keeps their seat,
 * so there is nothing per player to show. Until custom games store each
 * player's readiness (a data-model change, deferred), this seam says so
 * once (`note`) and gives every row no readiness (`of` is `null`). Replace
 * the body with the stored readiness when it exists; callers stay as they
 * are. Logged in `docs/ui-overhaul/DECISIONS.md`.
 */
export type FrameRematchReadiness = {
  /** One player's readiness, as a word for their standings row; `null` for none. */
  readonly of: (side: GameSide) => FrameReadiness | null;
  /** One line under the headline about how the rematch starts; `null` for none. */
  readonly note: () => string | null;
};

export type FrameReadiness = {
  readonly label: string;
  readonly ready: boolean;
};

export function customGameRematchReadiness(
  game: () => CustomGame | null
): FrameRematchReadiness {
  return {
    of: () => null,
    note: () =>
      game()?.status === 'completed' ? t`Host starts the rematch` : null,
  };
}
