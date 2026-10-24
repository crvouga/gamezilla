import { configureCustomGame } from '@libs/game-session-harness-ts/custom-game-ui';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { QuoridorMode } from '@libs/quoridor-shared-ts/quoridor';
import { establishQuoridor } from './quoridor-actions';

/** Ordinary turns bring the South bot one move from the selected goal. */
export const establishQuoridorBotVictory = scenarioAction({
  name: 'establishQuoridorBotVictory',
  act: async (s, mode: QuoridorMode) => {
    await Promise.resolve(establishQuoridor.act(s, { mode, first: 'bot' }));
    await s.session.advanceTime(1000);
    if (mode === 'classic') {
      const replies = ['d9', 'd8', 'd7', 'd6', 'd5', 'd4', 'd3'];
      for (const [index, uci] of replies.entries()) {
        await configureCustomGame(s, 'bob', {
          operation: 'move',
          uci,
          ply: index * 2 + 1,
        });
        if (index < replies.length - 1) await s.session.advanceTime(1000);
      }
    } else {
      const actors = ['bob', 'carol', 'dave'];
      const walls = [
        'a1h',
        'b1v',
        'c1h',
        'd1v',
        'e1h',
        'f1v',
        'g1h',
        'h1v',
        'a2h',
      ];
      for (const [index, uci] of walls.entries()) {
        await configureCustomGame(s, actors[index % 3]!, {
          operation: 'move',
          uci,
          ply: index + Math.floor(index / 3) + 1,
        });
        if (index % 3 === 2 && index < walls.length - 1)
          await s.session.advanceTime(1000);
      }
    }
  },
});

export const playQuoridorBot = scenarioAction({
  name: 'playQuoridorBot',
  act: (s) => s.session.advanceTime(1000),
});
