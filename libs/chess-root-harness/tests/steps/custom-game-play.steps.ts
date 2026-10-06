import { expect } from 'bun:test';
import { changeCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import {
  readCustomGameSeconds,
  readCustomGameTime,
} from '@libs/chess-custom-game-harness/custom-game-clocks';
import { customGameChess } from '@libs/chess-custom-game-shared/custom-game-position';
import type { CustomGame } from '@libs/chess-custom-game-shared/custom-game-state';
import { customGameTimeLeft } from '@libs/chess-custom-game-shared/custom-game-state';
import { Given, Then, When } from '@libs/harness/define';
import { remember } from '@libs/harness/spec-world';
import { customSide } from './custom-game-choices.steps';
import {
  customFact,
  customGame,
  customHost,
  customHumans,
  customPerson,
  customStart,
} from './custom-game-world';
import { lastMoveKey, promotionPiece } from './puzzle-world';

Given(
  '{actor} has a completed Custom Game between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) => {
    await customHumans(w, { host, white, black, active: true });
    await customFact(w, white, { operation: 'resign' });
    w.memo.set('custom-completed', await customGame(w));
  }
);
Given(
  '{actor} has an active Custom Game with {int} minute and {int} seconds increment',
  async (w, host: string, minutes: number, increment: number) => {
    await customHumans(w, { host, white: host, black: 'bob' });
    await customFact(w, host, { operation: 'clock', minutes, increment });
    await customStart(w);
  }
);
Given(
  '{int} seconds have passed in the Custom Game',
  async (w, seconds: number) => w.s.advanceTime(seconds * 1000)
);
Given("White's time has run out in the Custom Game", async (w) => {
  const game = await customGame(w);
  await w.s.advanceTime(
    customGameTimeLeft(game, 'white', await w.s.read(readCustomGameTime))
  );
});
Given(
  '{actor} has offered a draw in the Custom Game',
  async (w, actor: string) => customFact(w, actor, { operation: 'offer' })
);
Given('{actor} has resigned the Custom Game', async (w, actor: string) => {
  await customFact(w, actor, { operation: 'resign' });
  w.memo.set('custom-completed', await customGame(w));
});

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
When('{actor} offers a draw in the Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'offer' })
);
When('{actor} accepts the draw in the Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'agree' })
);
When('{actor} declines the draw in the Custom Game', async (w, actor: string) =>
  w.s.apply(changeCustomGame, actor, { operation: 'reject' })
);

Then('{word} is to move in the Custom Game', async (w, side: string) =>
  expect((await customGame(w)).turn).toBe(customSide(side))
);
Then('The Custom Game move list shows {word}', async (w, san: string) =>
  expect((await customGame(w)).moves.at(-1)?.san).toBe(san)
);
Then('The Custom Game move list is unchanged', async (w) =>
  expect((await customGame(w)).moves).toEqual(
    w.memo.get('custom-before-moves') as CustomGame['moves']
  )
);
Then('The Custom Game remains active', async (w) =>
  expect((await customGame(w)).status).toBe('active')
);
Then('The Custom Game remains configuring', async (w) =>
  expect((await customGame(w)).status).toBe('configuring')
);
Then('Neither person has won the Custom Game', async (w) =>
  expect((await customGame(w)).outcome).toBe('')
);
Then('The Custom Game is completed as a draw', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('completed');
  expect(game.outcome).toBe('draw');
});
Then('The Custom Game is cancelled with no winner', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('cancelled');
  expect(game.outcome).toBe('cancelled');
});
Then('Neither person is offered a draw in the Custom Game', async (w) =>
  expect((await customGame(w)).drawOfferedBy).toBe('')
);
Then(
  '{actor} is offered a draw in the Custom Game',
  async (w, actor: string) => {
    const game = await customGame(w, actor);
    expect(game.drawOfferedBy).not.toBe('');
    expect(game.drawOfferedBy).not.toBe(customPerson(w, actor));
  }
);
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
Then(
  'White has {int} seconds and Black has {int} seconds in the Custom Game',
  async (w, white: number, black: number) => {
    expect(await w.s.read(readCustomGameSeconds, customHost(w), 'white')).toBe(
      white
    );
    expect(await w.s.read(readCustomGameSeconds, customHost(w), 'black')).toBe(
      black
    );
  }
);
Then('Black has {int} seconds in the Custom Game', async (w, seconds: number) =>
  expect(await w.s.read(readCustomGameSeconds, customHost(w), 'black')).toBe(
    seconds
  )
);
Then('Black is in check in the active Custom Game', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('active');
  expect(game.turn).toBe('black');
  expect(customGameChess(game).isCheck()).toBe(true);
});
Then('The Custom Game keeps its completed outcome', async (w) => {
  const before = w.memo.get('custom-completed') as CustomGame;
  const game = await customGame(w);
  expect(game.outcome).toBe(before.outcome);
  expect(game.moves).toEqual(before.moves);
});
Then('Neither side offers an invitation', async (w) => {
  const game = await customGame(w);
  expect(game.white.kind).not.toBe('invitation');
  expect(game.black.kind).not.toBe('invitation');
});
