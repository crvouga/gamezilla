import { expect } from 'bun:test';
import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { chessCustomBoard as customGameChess } from '@libs/chess-rules-shared/chess-harness';
import { Then, When } from '@libs/harness/define';
import { remember } from '@libs/harness/spec-world';
import { customSide } from './custom-game-choices.steps';
import { customGame, customPerson } from './custom-game-world';
import { lastMoveKey, promotionPiece } from './puzzle-world';

When(
  '{actor} plays {word} in the Custom Game',
  async (w, actor: string, move: string) => {
    const game = await customGame(w, actor);
    remember(w, lastMoveKey(actor), move.replace('-', ''));
    await w.s.apply(changeCustomGame, actor, {
      operation: 'move',
      uci: move.replace('-', ''),
      ply: game.moves.length,
    });
  }
);
When(
  '{actor} plays {word} and promotes to a {word} in the Custom Game',
  async (w, actor: string, move: string, piece: string) => {
    const game = await customGame(w, actor);
    await w.s.apply(changeCustomGame, actor, {
      operation: 'move',
      uci: move.replace('-', '') + promotionPiece(piece),
      ply: game.moves.length,
    });
  }
);

Then('{word} is to move in the Custom Game', async (w, side: string) =>
  expect((await customGame(w)).turn).toBe(customSide(side))
);
Then('The Custom Game move list shows {word}', async (w, san: string) =>
  expect((await customGame(w)).moves.at(-1)?.san).toBe(san)
);
Then('The Custom Game remains active', async (w) =>
  expect((await customGame(w)).status).toBe('active')
);
Then('Neither person has won the Custom Game', async (w) =>
  expect((await customGame(w)).outcome).toBe('')
);
Then('The Custom Game is completed as a draw', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe('draw');
});
Then('{actor} wins the Custom Game on time', async (w, actor: string) => {
  const game = await customGame(w);
  const side = game.white.person === customPerson(w, actor) ? 'white' : 'black';
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe(`${side} wins on time`);
});
Then('{actor} wins the Custom Game by checkmate', async (w, actor: string) => {
  const game = await customGame(w);
  const side = game.white.person === customPerson(w, actor) ? 'white' : 'black';
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe(`${side} wins by checkmate`);
});
Then('Black is in check in the active Custom Game', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('active');
  expect(game.turn).toBe('black');
  expect(customGameChess(game).isCheck()).toBe(true);
});
