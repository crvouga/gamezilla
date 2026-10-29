import { BATTLESHIP_REASON } from '@libs/battleship-shared-ts/battleship-position';
import type { GameClientPresentation } from '@libs/game-menu-client-ts/game-client';
import { t } from '@lingui/core/macro';
import { BattleshipBoard } from './battleship-board';
import { sideName } from './battleship-copy';
import { battleshipFrame } from './battleship-frame';
import { BattleshipSetupBoard } from './battleship-setup-board';

export const battleshipPresentation: GameClientPresentation = {
  canFlip: false,
  name: () => t`Battleship`,
  Board: BattleshipBoard,
  SetupBoard: BattleshipSetupBoard,
  sideLabel: sideName,
  frame: battleshipFrame,
  endingDescription: (reason) => {
    const descriptions: Readonly<Record<string, string>> = {
      [BATTLESHIP_REASON]: t`Sank the whole fleet.`,
    };
    return descriptions[reason];
  },
  timeoutDrawDescription: (side) => {
    const flagged = sideName(side);
    return t`${flagged} ran out of time, but the other side cannot win.`;
  },
  endingLabel: (reason) =>
    reason === BATTLESHIP_REASON ? t`fleet sunk` : reason,
};
