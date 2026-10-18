/**
 * A game the platform knows nothing about, for its puzzle suites: take one
 * or two stones from a pile, and whoever takes the last stone wins.
 * Positions are `<id>:<stones>:<side to move>`.
 */

import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';
import type { PuzzlesCapability } from '@pkgs/turn-game-shared/game-puzzles';
import type { GameRules, GameSide } from '@pkgs/turn-game-shared/game-rules';

const other = (side: GameSide): GameSide =>
  side === 'white' ? 'black' : 'white';
const parse = (position: string) => {
  const [, stones, side] = position.split(':');
  return { stones: Number(stones), side: side as GameSide };
};
const TAKES: Readonly<Record<string, number>> = { take1: 1, take2: 2 };

/** The pile game under the id `id` (its positions name it). */
export function pileRules(id: string): GameRules {
  const shape = new RegExp(`^${id}:\\d+:(white|black)$`);
  return {
    id,
    recognizes: (position) => shape.test(position),
    initial: () => `${id}:9:white`,
    play(position, action) {
      const { stones, side } = parse(position);
      const take = TAKES[action];
      if (stones === 0 || take === undefined || take > stones) return null;
      const left = stones - take;
      return {
        position: `${id}:${String(left)}:${other(side)}`,
        history: '',
        turn: other(side),
        label: `−${String(take)}`,
        winner: left === 0 ? side : null,
        reason: left === 0 ? 'last stone' : null,
      };
    },
    replay: () => `${id}:9:white`,
    legal: (position) =>
      Object.keys(TAKES).filter(
        (a) => (TAKES[a] ?? 0) <= parse(position).stones
      ),
    canWin: () => true,
    moves: () => [],
  };
}

/** The pile game's puzzles in `namespace`; a line naming `bad` is refused. */
export function pilePuzzles(namespace: string): PuzzlesCapability {
  return {
    namespace,
    content: {
      validate: (record) =>
        record.line.includes('bad')
          ? { ok: false, reason: 'badMove', detail: 'the line names bad' }
          : { ok: true },
    },
    // `TAKE1` is how a careless person spells it.
    judge: { canonical: (_position, action) => action.toLowerCase() },
    marks: (_position, action) => ({ from: null, to: action }),
    isCell: (cell) => cell.length > 0,
  };
}

export const PILE_GAME: PuzzleGame = {
  rules: pileRules('pile'),
  puzzles: pilePuzzles('pile/'),
};
