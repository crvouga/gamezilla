import type { PuzzleContentFrame } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { t } from '@lingui/core/macro';

/** The board names both figures; TSX keeps its labels in the macro transform. */
export const numberlinkContentFrame: PuzzleContentFrame = {
  stats: {
    connectedPairs: () => t`Connected pairs`,
    coveredCells: () => t`Covered cells`,
  },
  figuresPlacement: 'board',
  turnStatus: () => null,
};
