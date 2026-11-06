import { chessPuzzleCellFeedback } from '@libs/chess-puzzle-shared-ts/cell-feedback';

/** Keep the hinted piece recognizable while retaining the shared marks. */
export function puzzleBoardFeedback(
  marks: Parameters<typeof chessPuzzleCellFeedback>[0]
): ReturnType<typeof chessPuzzleCellFeedback> {
  const feedback = chessPuzzleCellFeedback(marks);
  for (const mark of Object.values(feedback)) {
    if (mark?.kind === 'dot') {
      mark.shape = 'outline';
      mark.label = 'Hint: move this piece';
    }
  }
  return feedback;
}
