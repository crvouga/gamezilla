import {
  type GameLesson,
  practiceBoard,
  turnLessonStep,
} from '@libs/game-menu-client-ts/game-lesson';
import { decodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import { t } from '@lingui/core/macro';
import { HeartsBoard } from './hearts-board';

function remaining(hand: readonly string[]) {
  return (position: string) =>
    hand
      .filter(
        (card) =>
          !decodeHearts(position)?.plays.some((played) => played === card)
      )
      .join('');
}
const south = [
  '2C',
  '7C',
  'KC',
  '2D',
  '3D',
  '7D',
  '9D',
  'AS',
  'QS',
  '4S',
  '3H',
  '8H',
  'QH',
];
const west = [
  '4C',
  '6C',
  'AC',
  '4D',
  '5D',
  'JD',
  'KD',
  '2S',
  '8S',
  'TS',
  '5H',
  '9H',
  'AH',
];

export const heartsLesson: GameLesson = [
  turnLessonStep(
    heartsRules,
    practiceBoard(HeartsBoard, { hand: remaining(south) }),
    {
      before: ['pass:white'],
      action: '2C',
      prompt: () =>
        t`After the pass, the two of clubs leads the first trick. Play it from your hand.`,
      success: () =>
        t`Clubs led the trick. The next player must follow clubs if they have one.`,
    }
  ),
  turnLessonStep(
    heartsRules,
    practiceBoard(HeartsBoard, { side: 'black', hand: remaining(west) }),
    {
      before: ['pass:white', '2C'],
      action: '4C',
      prompt: () =>
        t`Try the next seat. Follow suit with your lowest club, the four of clubs.`,
      success: () =>
        t`The highest club takes this trick. In Hearts you try to avoid hearts and the queen of spades.`,
    }
  ),
];
