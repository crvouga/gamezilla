import { chessPuzzleCellFeedback } from '@libs/chess-puzzle-shared-ts/cell-feedback';

/** Keep the hinted piece recognizable while retaining the shared marks. */
export function puzzleBoardFeedback(
  marks: Parameters<typeof chessPuzzleCellFeedback>[0] & {
    readonly solution?: {
      readonly from: string | null;
      readonly to: string | null;
    } | null;
  }
): ReturnType<typeof chessPuzzleCellFeedback> {
  const feedback = chessPuzzleCellFeedback(marks);
  for (const mark of Object.values(feedback)) {
    if (mark?.kind === 'dot') {
      mark.shape = 'outline';
      mark.label = 'Hint: move this piece';
    }
  }
  if (marks.solution?.from && marks.solution.to) {
    const { from, to } = marks.solution;
    feedback[from as keyof typeof feedback] = {
      kind: 'dot',
      shape: 'outline',
      label: `Solution: move from ${from} to ${to}`,
    };
    feedback[to as keyof typeof feedback] = {
      kind: 'dot',
      shape: 'outline',
      label: `Solution destination: ${to}`,
    };
  }
  return feedback;
}
