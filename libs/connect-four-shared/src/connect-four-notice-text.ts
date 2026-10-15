import type { GameNoticeText } from '@pkgs/turn-game-shared/game-rules';
export const connectFourNoticeText: GameNoticeText = {
  timeoutDraw: (side) =>
    `${side === 'white' ? 'Red' : 'Yellow'} ran out of time, but the other side cannot win.`,
  side: (side) => (side === 'white' ? 'Red' : 'Yellow'),
  ending: (reason) =>
    reason === 'four in a row'
      ? 'Four in a row.'
      : reason === 'full board'
        ? 'The board is full. Game drawn.'
        : undefined,
};
