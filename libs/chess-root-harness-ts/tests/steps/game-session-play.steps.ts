import { expect } from 'bun:test';
import { changeGameSession } from '@libs/chess-root-harness-ts/chess-game-session-board';
import { chessCustomBoard as gameSessionChess } from '@libs/chess-rules-shared-ts/chess-harness';
import { Then, When } from '@libs/harness-ts/define';
import { remember } from '@libs/harness-ts/spec-world';
import { customSide } from './game-session-choices.steps';
import { customPerson, gameSession } from './game-session-world';
import { lastMoveKey, promotionPiece } from './puzzle-world';

When(
  '{actor} plays {word} in the game session',
  async (w, actor: string, move: string) => {
    const game = await gameSession(w, actor);
    remember(w, lastMoveKey(actor), move.replace('-', ''));
    await w.s.apply(changeGameSession, actor, {
      operation: 'move',
      uci: move.replace('-', ''),
      ply: game.moves.length,
    });
  }
);
When(
  '{actor} plays {word} and promotes to a {word} in the game session',
  async (w, actor: string, move: string, piece: string) => {
    const game = await gameSession(w, actor);
    await w.s.apply(changeGameSession, actor, {
      operation: 'move',
      uci: move.replace('-', '') + promotionPiece(piece),
      ply: game.moves.length,
    });
  }
);

Then('{word} is to move in the game session', async (w, side: string) =>
  expect((await gameSession(w)).turn).toBe(customSide(side))
);
Then('The game session move list shows {word}', async (w, san: string) =>
  expect((await gameSession(w)).moves.at(-1)?.san).toBe(san)
);
Then('The game session remains active', async (w) =>
  expect((await gameSession(w)).status).toBe('active')
);
Then('neither person has won the game session', async (w) =>
  expect((await gameSession(w)).outcome).toBe('')
);
Then('The game session is completed as a draw', async (w) => {
  const game = await gameSession(w);
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe('draw');
});
Then('{actor} wins the game session on time', async (w, actor: string) => {
  const game = await gameSession(w);
  const side = game.white.person === customPerson(w, actor) ? 'white' : 'black';
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe(`${side} wins on time`);
});
Then('{actor} wins the game session by checkmate', async (w, actor: string) => {
  const game = await gameSession(w);
  const side = game.white.person === customPerson(w, actor) ? 'white' : 'black';
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe(`${side} wins by checkmate`);
});
Then('Black is in check in the active game session', async (w) => {
  const game = await gameSession(w);
  expect(game.status).toBe('active');
  expect(game.turn).toBe('black');
  expect(gameSessionChess(game).isCheck()).toBe(true);
});
