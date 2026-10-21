import type { GameNoticeText } from '@pkgs/turn-game-shared-ts/game-rules';

const ENDINGS: Readonly<Record<string, string>> = {
  checkmate: 'By checkmate.',
  stalemate: 'By stalemate.',
  repetition: 'By repetition.',
  'insufficient material': 'Neither side can checkmate.',
  'fifty moves': 'By the fifty-move rule.',
};
export const chessNoticeText: GameNoticeText = {
  timeoutDraw: (side) =>
    `${side === 'white' ? 'White' : 'Black'} ran out of time, but the other side cannot checkmate.`,
  side: (side) => (side === 'white' ? 'White' : 'Black'),
  ending: (reason) => ENDINGS[reason],
};
