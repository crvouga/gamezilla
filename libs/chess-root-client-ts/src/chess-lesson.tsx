import { chessGameShared } from '@libs/chess-sub-shared-ts/chess-game';
import {
  type GameLesson,
  practiceBoard,
  turnLessonStep,
} from '@libs/game-menu-client-ts/game-lesson';
import { t } from '@lingui/core/macro';
import { ChessGameBoard } from './chess-game-presentation';

const board = practiceBoard(ChessGameBoard);
const rules = chessGameShared.turnGame.rules;
export const chessLesson: GameLesson = [
  turnLessonStep(rules, board, {
    before: [],
    action: 'e2e4',
    prompt: () =>
      t`Open the centre. Select the white pawn on e2, then select e4.`,
    success: () =>
      t`A pawn can advance two squares on its first move when both are clear.`,
  }),
  turnLessonStep(rules, board, {
    before: ['e2e4', 'd7d5'],
    action: 'e4d5',
    prompt: () =>
      t`Black has moved beside your path. Capture the pawn on d5 with your pawn on e4.`,
    success: () => t`Pawns move straight ahead and capture diagonally.`,
  }),
  turnLessonStep(rules, board, {
    before: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6'],
    action: 'h5f7',
    prompt: () =>
      t`Capture f7 with the queen on h5. Your bishop on c4 protects the queen.`,
    success: () => t`Checkmate. Black's king cannot escape the queen's attack.`,
  }),
];
