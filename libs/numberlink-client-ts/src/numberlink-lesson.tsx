import {
  type GameLesson,
  puzzleLessonStep,
} from '@libs/game-menu-client-ts/game-lesson';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import {
  connectedPairs,
  decodeNumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-state';
import type { NumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-types';
import { t } from '@lingui/core/macro';
import { NumberlinkPlayer } from './numberlink-player';

const board: NumberlinkDefinition = {
  format: 1,
  width: 3,
  height: 2,
  coverage: 'all',
  pairs: [
    {
      id: 'one',
      label: '1',
      color: 'red',
      endpoints: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    },
    {
      id: 'two',
      label: '2',
      color: 'blue',
      endpoints: [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
    },
  ],
};
const definition = JSON.stringify(board);
const topRow = JSON.stringify({
  pairId: 'one',
  cells: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ],
});
const rules = numberlinkPuzzleContent.rules;
export const numberlinkLesson: GameLesson = [
  puzzleLessonStep(rules, NumberlinkPlayer, {
    definition,
    prompt: () =>
      t`Join the 1s across the top row. Drag between them, or press Enter at a 1, use the arrows and press Enter again.`,
    success: () =>
      t`The 1s are connected. Other paths must go around this path.`,
    reachedGoal: (state) => {
      const progress = decodeNumberlinkState(board, state);
      return (
        progress.valid && connectedPairs(board, progress.value).includes('one')
      );
    },
  }),
  puzzleLessonStep(rules, NumberlinkPlayer, {
    definition,
    before: [topRow],
    prompt: () =>
      t`Connect the 2s through the remaining cells in the bottom row.`,
    success: () => t`Both pairs are joined and every cell is covered.`,
    reachedGoal: (state) => rules.complete(definition, state),
  }),
];
