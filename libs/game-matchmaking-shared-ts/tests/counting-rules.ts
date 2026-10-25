import type { GameRules } from '@pkgs/turn-game-shared-ts/game-rules';

/** A finite counting game for catalog and formation contracts. */
export function countingRules(id: string): GameRules {
  const position = (count: number) => `${id}:${count}`;
  return {
    id,
    initial: () => position(0),
    recognizes: (value) =>
      [position(0), position(1), position(2)].includes(value),
    legal: (value) => (value === position(2) ? [] : ['count']),
    play(value, action) {
      const count = Number(value.slice(id.length + 1));
      if (action !== 'count' || ![0, 1].includes(count)) return null;
      return {
        position: position(count + 1),
        history: String(count + 1),
        turn: count === 0 ? 'black' : 'white',
        label: 'count',
        winner: count === 1 ? 'black' : null,
        reason: count === 1 ? 'finished counting' : null,
      };
    },
    replay: (_actions, ply) => position(Math.min(2, ply)),
    canWin: () => true,
    moves: (_value, _history, actions) =>
      actions.map((_action, index) => ({
        label: 'count',
        before: position(index),
        after: position(index + 1),
      })),
  };
}
