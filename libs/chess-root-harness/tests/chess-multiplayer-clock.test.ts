/**
 * Whether Black could still win: the framework draws a flag fall against a
 * side that cannot be beaten (`GameRules.canWin`), so chess's mating
 * material decides a timeout. White, to move, is out of time.
 */
import { describe, expect, test } from 'bun:test';
import { chessTurnGame } from '@libs/chess-sub-shared/chess-game';

const { canWin } = chessTurnGame.rules;
const blackCanWin = (position: string) => canWin(position, 'black');

describe('running out of time against material that cannot checkmate', () => {
  // regression: chess-timeout-lone-knight-vs-queens
  test('a lone knight cannot mate a king whose only helpers are queens', () => {
    expect(blackCanWin('4k3/8/8/8/8/2n5/8/Q3K3 w - - 0 60')).toBe(false);
    expect(blackCanWin('4k3/8/8/8/8/2n5/8/QQ2K3 w - - 0 60')).toBe(false);
  });

  // regression: chess-timeout-lone-bishop-vs-major-piece
  test('a lone bishop cannot mate a king whose only helpers are rooks or queens', () => {
    expect(blackCanWin('4k3/8/8/8/8/1b6/8/R3K3 w - - 0 60')).toBe(false);
    expect(blackCanWin('4k3/8/8/8/8/1b6/8/Q3K3 w - - 0 60')).toBe(false);
  });

  test('a bare king draws', () => {
    expect(blackCanWin('4k3/8/8/8/8/8/8/Q3K3 w - - 0 60')).toBe(false);
  });
});

describe('running out of time against material that can still checkmate', () => {
  test('a knight wins on time when a rook, bishop, knight or pawn can block', () => {
    expect(blackCanWin('4k3/8/8/8/8/2n5/8/R3K3 w - - 0 60')).toBe(true);
    expect(blackCanWin('4k3/8/8/8/8/2n5/8/B3K3 w - - 0 60')).toBe(true);
    expect(blackCanWin('4k3/8/8/8/8/2n5/8/N3K3 w - - 0 60')).toBe(true);
    expect(blackCanWin('4k3/8/8/8/8/2n5/P7/4K3 w - - 0 60')).toBe(true);
  });

  test('a bishop wins on time against a knight, a pawn or an opposite bishop', () => {
    expect(blackCanWin('4k3/8/8/8/8/1b6/8/N3K3 w - - 0 60')).toBe(true);
    expect(blackCanWin('4k3/8/8/8/8/1b6/P7/4K3 w - - 0 60')).toBe(true);
    expect(blackCanWin('4k3/8/8/8/8/1b6/8/B3K3 w - - 0 60')).toBe(true);
  });

  test('a pawn, rook or queen always wins on time', () => {
    expect(blackCanWin('4k3/7p/8/8/8/8/8/Q3K3 w - - 0 60')).toBe(true);
    expect(blackCanWin('r3k3/8/8/8/8/8/8/4K3 w - - 0 60')).toBe(true);
  });
});
