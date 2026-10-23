import type { GameBots, GameRules } from '@pkgs/turn-game-shared-ts/game-rules';

/** A counting race exercises opaque actions and positions unrelated to a board. */
export const rules: GameRules = {
  id: 'counting-race',
  recognizes: (position) => /^race:[0-4]$/.test(position),
  initial: () => 'race:0',
  play(position, action) {
    const count = Number(position.slice(5));
    if (action !== 'advance-token' || count >= 4) return null;
    return {
      position: `race:${count + 1}`,
      history: String(count + 1),
      turn: count % 2 === 0 ? 'black' : 'white',
      label: `step ${count + 1}`,
      winner: count === 3 ? 'black' : null,
      reason: count === 3 ? 'finish line' : null,
    };
  },
  replay: (_actions, ply) => `race:${ply}`,
  legal: (position) => (position === 'race:4' ? [] : ['advance-token']),
  canWin: () => true,
  moves: () => [],
};
export const bots: GameBots = {
  difficulties: [],
  choose: (position) => (position === 'race:4' ? null : 'advance-token'),
};
export const notice = {
  timeoutDraw: () => 'drawn on time',
  side: (side: string) => side,
  ending: () => undefined,
};
