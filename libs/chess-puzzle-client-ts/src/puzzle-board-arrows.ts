import {
  chessPuzzleArrows,
  PUZZLE_SOLUTION_ARROW_ID,
} from '@libs/chess-puzzle-shared-ts/recommendation-arrows';

/** A narrow translucent solution keeps the captured piece readable. */
export function puzzleBoardArrows(
  args: Parameters<typeof chessPuzzleArrows>[0]
) {
  return chessPuzzleArrows(args).map((arrow) =>
    arrow.id === PUZZLE_SOLUTION_ARROW_ID
      ? { ...arrow, thickness: 0.06, opacity: 0.8 }
      : arrow
  );
}
