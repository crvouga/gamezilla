import type { GameNoticeText } from '@pkgs/turn-game-shared-ts/game-rules';
import { BATTLESHIP_REASON } from './battleship-position';

const side: GameNoticeText['side'] = (of) =>
  of === 'white' ? 'Blue fleet' : 'Red fleet';
export const battleshipNoticeText: GameNoticeText = {
  timeoutDraw: (flagged) =>
    `${side(flagged)} ran out of time, but the other side cannot win.`,
  side,
  ending: (reason) =>
    reason === BATTLESHIP_REASON ? 'Sank the whole fleet.' : undefined,
};
