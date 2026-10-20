import type { PuzzleGame } from '@libs/game-puzzle-shared/puzzle-setup';
import { PILE_GAME } from './pile-game';

export const SOLO_PILE_GAME: PuzzleGame = {
  rules: {
    ...PILE_GAME.rules,
    play(position, action, history, actions) {
      const played = PILE_GAME.rules.play(position, action, history, actions);
      return played === null
        ? null
        : {
            ...played,
            position: played.position.replace(/:black$/, ':white'),
            turn: 'white',
            winner: played.winner === null ? null : 'white',
          };
    },
  },
  puzzles: { ...PILE_GAME.puzzles, lineMode: 'solver-only' },
};
