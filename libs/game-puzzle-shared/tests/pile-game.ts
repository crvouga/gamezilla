/**
 * A game the platform knows nothing about, for its puzzle suites: take one
 * or two stones from a pile, and whoever takes the last stone wins.
 * Positions are `pile:<stones>:<side to move>`.
 */

import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';
import type { GameRules, GameSide } from '@pkgs/turn-game-shared/game-rules';

const other = (side: GameSide): GameSide =>
  side === 'white' ? 'black' : 'white';
const parse = (position: string) => {
  const [, stones, side] = position.split(':');
  return { stones: Number(stones), side: side as GameSide };
};
const TAKES: Readonly<Record<string, number>> = { take1: 1, take2: 2 };

const rules: GameRules = {
  id: 'pile',
  recognizes: (position) => /^pile:\d+:(white|black)$/.test(position),
  initial: () => 'pile:9:white',
  play(position, action) {
    const { stones, side } = parse(position);
    const take = TAKES[action];
    if (stones === 0 || take === undefined || take > stones) return null;
    const left = stones - take;
    return {
      position: `pile:${String(left)}:${other(side)}`,
      history: '',
      turn: other(side),
      label: `−${String(take)}`,
      winner: left === 0 ? side : null,
      reason: left === 0 ? 'last stone' : null,
    };
  },
  replay: () => 'pile:9:white',
  legal: (position) =>
    Object.keys(TAKES).filter((a) => (TAKES[a] ?? 0) <= parse(position).stones),
  canWin: () => true,
  moves: () => [],
};

export const PILE_GAME: PuzzleGame = {
  rules,
  puzzles: {
    namespace: 'pile/',
    content: { validate: () => ({ ok: true }) },
    // `TAKE1` is how a careless person spells it.
    judge: { canonical: (_position, action) => action.toLowerCase() },
    marks: (_position, action) => ({ from: null, to: action }),
    isCell: (cell) => cell.length > 0,
  },
};
