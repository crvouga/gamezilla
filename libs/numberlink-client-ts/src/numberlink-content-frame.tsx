import type { PuzzleContentFrame } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { t } from '@lingui/core/macro';

/** The board already names both figures beside the paths they describe. */
export const numberlinkContentFrame: PuzzleContentFrame = {
  stats: {
    connectedPairs: () => t`Connected pairs`,
    coveredCells: () => t`Covered cells`,
  },
  figuresPlacement: 'board',
  turnStatus: () => null,
};
