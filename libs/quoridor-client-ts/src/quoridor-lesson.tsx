import {
  type GameLesson,
  practiceBoard,
  turnLessonStep,
} from '@libs/game-menu-client-ts/game-lesson';
import {
  quoridorHillRules,
  quoridorRules,
} from '@libs/quoridor-shared-ts/quoridor-rules';
import { t } from '@lingui/core/macro';
import { QuoridorBoard } from './quoridor-board';

export function quoridorLesson(hill: boolean): GameLesson {
  const rules = hill ? quoridorHillRules : quoridorRules;
  const board = practiceBoard(QuoridorBoard);
  return [
    turnLessonStep(rules, board, {
      before: [],
      action: 'e2',
      prompt: () =>
        t`Move South's circle one square forward, from e1 to e2. Tap e2 or choose it with the keyboard.`,
      success: () => t`Your pawn is on e2. Moving one square uses your turn.`,
    }),
    turnLessonStep(rules, board, {
      before: hill ? ['e2', 'a4', 'e8', 'i4'] : ['e2', 'e8'],
      action: 'd6h',
      prompt: () =>
        t`Tap the gap above the right half of d6 to preview a wall. Tap the same gap again to place it. With a keyboard, open Coordinates and choose Horizontal wall, d6, then Place wall.`,
      success: () =>
        t`The wall blocks two crossings. Each pawn still has a route to its goal.`,
    }),
    turnLessonStep(rules, board, {
      before: hill
        ? [
            'e2',
            'a4',
            'e8',
            'i4',
            'e3',
            'a3',
            'e7',
            'i3',
            'e4',
            'a2',
            'e6',
            'i2',
          ]
        : [
            'e2',
            'd9',
            'e3',
            'd8',
            'e4',
            'd7',
            'e5',
            'd6',
            'e6',
            'd5',
            'e7',
            'd4',
            'e8',
            'd3',
          ],
      action: hill ? 'e5' : 'e9',
      prompt: () =>
        hill
          ? t`South is one move from the hill. Move to the star on e5.`
          : t`South is one move from the opposite row. Move to e9.`,
      success: () =>
        hill
          ? t`You reached the central hill and won the practice game.`
          : t`You reached North's home row and won the practice game.`,
    }),
  ];
}
