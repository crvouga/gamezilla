import type { SokobanSquare } from '@libs/sokoban-shared-ts/sokoban-types';
import { useLingui } from '@lingui/solid/macro';

/** Localized names for squares, pieces and the rules' refusal codes. */
export function useSokobanWords() {
  const { t } = useLingui();
  const squares = (): Readonly<Record<SokobanSquare, string>> => ({
    wall: t`wall`,
    floor: t`floor`,
    goal: t`goal`,
    outside: t`outside`,
  });
  const refusals = (): Readonly<Record<string, string>> => ({
    blocked: t`The worker's way is blocked.`,
    crate_blocked: t`That crate cannot move.`,
    board_too_large: t`A board has at most 20 columns and 20 rows.`,
    board_too_small: t`A board has at least 1 column and 1 row.`,
    invalid_size: t`Enter whole numbers of columns and rows.`,
    not_standable: t`The worker and crates stand only on floor or goals.`,
    occupied: t`That square already has a piece.`,
    no_crate: t`There is no crate on that square.`,
    not_on_board: t`Choose a square on the board.`,
    needs_worker: t`The board needs a worker.`,
    needs_crate: t`The board needs at least one crate.`,
    crate_goal_mismatch: t`The board needs as many crates as goals.`,
  });
  return {
    square: (square: SokobanSquare): string => squares()[square],
    worker: () => t`worker`,
    crate: () => t`crate`,
    refusal: (code: string, fallback: string): string =>
      refusals()[code] ?? fallback,
  };
}
