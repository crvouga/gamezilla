import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import { decodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import { HEARTS_REASON } from '@libs/hearts-shared-ts/hearts-rules';
import { t } from '@lingui/core/macro';
import { HeartsBoard } from './hearts-board';
import { heartsRefusal, heartsSeatName } from './hearts-copy';
import { heartsFrame } from './hearts-frame';

/** The finished game every player shares the lowest score of: a draw. */
function everyScoreLevel(position: string): boolean {
  const decoded = decodeHearts(position);
  if (decoded?.phase !== 'done') return false;
  return decoded.scores.every((score) => score === decoded.scores[0]);
}

export const heartsPresentation: GameClientPresentation = {
  canFlip: false,
  name: () => t`Hearts`,
  goal: () =>
    t`Avoid the hearts and the queen of spades. The lowest score wins.`,
  Board: HeartsBoard,
  sideLabel: heartsSeatName,
  frame: heartsFrame,
  endingDescription: (reason) =>
    reason === HEARTS_REASON
      ? t`A score reached 100, and the lowest score wins.`
      : undefined,
  rulesDrawDescription: (position) =>
    everyScoreLevel(position)
      ? t`A score reached 100 with every player on the same score.`
      : undefined,
  timeoutDrawDescription: (side) => {
    const flagged = heartsSeatName(side);
    return t`${flagged} ran out of time. The game is a draw.`;
  },
  endingLabel: (reason) =>
    reason === HEARTS_REASON ? t`the lowest score` : reason,
  refusalDescription: heartsRefusal,
};
