import { expect } from 'bun:test';
import { changeCustomGame, openCustomGame } from '@libs/chess-custom-game-harness/custom-game-actions';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import { Given, Then, When } from '@libs/harness/define';
import {
  customDefault,
  customFact,
  customGame,
  customHost,
  customHumans,
  customPerson,
  customSpace,
} from './custom-game-world';

Given('{actor} has a configuring Custom Game', customDefault);
Given(
  '{actor} has (a )cancelled (the )Custom Game',
  async (w, actor: string) => {
    if (!w.memo.has('custom-link')) await customDefault(w, actor);
    w.memo.set('custom-before-moves', (await customGame(w)).moves);
    await customFact(w, actor, { operation: 'cancel' });
  }
);
Given(
  '{actor} has a Custom Game between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black })
);
Given(
  '{actor} has an active Custom Game between {actor} as White and {actor} as Black',
  async (w, host: string, white: string, black: string) =>
    customHumans(w, { host, white, black, active: true })
);
Given(
  '{actor} and {actor} are ready for the Custom Game',
  async (w, white: string, black: string) => {
    await customFact(w, white, { operation: 'ready' });
    await customFact(w, black, { operation: 'ready' });
  }
);

When('{actor} creates a Custom Game', async (w, actor: string) => {
  // regression: chess-custom-client-schedules — a guest's first create.
  const host = customHost(w);
  await customSpace(w, host, actor === host ? [] : [actor]);
  await w.s.apply(openCustomGame, actor);
  await w.s.apply(changeCustomGame, actor, { operation: 'create' });
});
When('{actor} starts the Custom Game', async (w, actor: string) => {
  await w.s.apply(changeCustomGame, actor, { operation: 'start' });
});
When('{actor} resigns the Custom Game', async (w, actor: string) => {
  await w.s.apply(changeCustomGame, actor, { operation: 'resign' });
});

Then('{actor} is the creator of the Custom Game', async (w, actor: string) => {
  expect((await customGame(w, actor)).creator).toBe(customPerson(w, actor));
});
Then(
  'White is {actor} and Black is an open place in the Custom Game',
  async (w, actor: string) => {
    const game = await customGame(w);
    expect(game.white).toEqual({
      kind: 'person',
      person: customPerson(w, actor),
    });
    expect(game.black.kind).toBe('open');
  }
);
Then(
  '{actor} is told only the host creates a Custom Game',
  async (w, actor: string) => {
    expect((await w.s.read(readCustomGameProbe, actor))?.error).toBe(
      'only the host creates a Custom Game'
    );
  }
);
Then(
  '{actor} has a configuring Custom Game with no moves',
  async (w, actor: string) => {
    const game = await customGame(w, actor);
    expect(game.status).toBe('configuring');
    expect(game.moves).toEqual([]);
  }
);
Then(
  '{actor} is told the Custom Game must finish or be cancelled first',
  async (w, actor: string) => {
    expect((await w.s.read(readCustomGameProbe, actor))?.error).toBe(
      'finish or cancel first'
    );
  }
);
Then('The Custom Game is active with White to move', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('active');
  expect(game.turn).toBe('white');
});
Then('The Custom Game is unrated and untimed', async (w) => {
  const game = await customGame(w);
  expect(game.minutes).toBe(0);
  expect(game.increment).toBe(0);
});
Then(
  '{actor} wins the Custom Game by resignation',
  async (w, actor: string) => {
    const game = await customGame(w);
    const side =
      game.white.person === customPerson(w, actor) ? 'white' : 'black';
    expect(game.status).toBe('completed');
    expect(game.outcome).toBe(`${side} wins by resignation`);
  }
);
