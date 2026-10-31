import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import { HEARTS_REASON } from '@libs/hearts-shared-ts/hearts-rules';
import { t } from '@lingui/core/macro';
import { HeartsBoard } from './hearts-board';
import { heartsRefusal, heartsSeatName } from './hearts-copy';
import { heartsFrame } from './hearts-frame';

export const heartsPresentation: GameClientPresentation = {
  canFlip: false,
  name: () => t`Hearts`,
  Board: HeartsBoard,
  sideLabel: heartsSeatName,
  frame: heartsFrame,
  endingDescription: (reason) =>
    reason === HEARTS_REASON
      ? t`A score reached 100, and the lowest score wins.`
      : undefined,
  timeoutDrawDescription: (side) => {
    const flagged = heartsSeatName(side);
    return t`${flagged} ran out of time. The game is a draw.`;
  },
  endingLabel: (reason) =>
    reason === HEARTS_REASON ? t`the lowest score` : reason,
  refusalDescription: heartsRefusal,
};
