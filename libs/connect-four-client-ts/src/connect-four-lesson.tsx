import { connectFourRules } from '@libs/connect-four-shared-ts/connect-four-rules';
import {
  type GameLesson,
  practiceBoard,
  turnLessonStep,
} from '@libs/game-menu-client-ts/game-lesson';
import { t } from '@lingui/core/macro';
import { ConnectFourGameBoard } from './connect-four-presentation';

const board = practiceBoard(ConnectFourGameBoard);
export const connectFourLesson: GameLesson = [
  turnLessonStep(connectFourRules, board, {
    before: [],
    action: '3',
    prompt: () =>
      t`Drop your first red disc in column 4. Tap the column or use the arrow keys and Enter.`,
    success: () => t`The disc fell to the lowest empty space in the column.`,
  }),
  turnLessonStep(connectFourRules, board, {
    before: ['3', '6', '3', '6', '3', '5'],
    action: '3',
    prompt: () =>
      t`Three red discs are stacked in column 4. Drop a fourth to win.`,
    success: () =>
      t`Four in a column wins. Four across or diagonally wins too.`,
  }),
];
