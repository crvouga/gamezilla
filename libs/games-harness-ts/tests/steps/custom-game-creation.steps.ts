import { expect } from 'bun:test';
import { createCustomGameIn } from '@libs/game-session-harness-ts/custom-game-controls';
import { customGameShownUnrated } from '@libs/game-session-harness-ts/custom-game-reads';
import { Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { current, identityOf, toldOf } from './custom-game-set-up-world';
import { before, gameOf, hostOf } from './game-world';

/** The host of the space the scenario is in, however it was set up. */
function spaceHostOf(w: HarnessWorld): string {
  return String(w.memo.get('spaceHost') ?? hostOf(w));
}

When('{actor} creates a custom game', async (w, actor: string) => {
  // regression: chess-custom-client-schedules — a guest's first create.
  const host = spaceHostOf(w);
  w.memo.set('custom-game-host', host);
  await w.s.apply(createCustomGameIn, gameOf(w).shared.id, host, actor);
});

Then('{actor} is the creator of the custom game', async (w, actor: string) => {
  expect((await current(w)).creator).toBe(await identityOf(w, actor));
});
Then('a new custom game is being set up with no moves', async (w) => {
  const game = await current(w);
  expect(game.id).not.toBe(before(w).current?.id);
  expect(game.status).toBe('configuring');
  expect(game.moves).toEqual([]);
});
Then(
  "the custom game is under way from the game's starting position",
  async (w) => {
    const game = await current(w);
    expect(game.status).toBe('active');
    expect(game.moves).toEqual([]);
    expect(game.fen).toBe(gameOf(w).shared.registration.rules.initial());
  }
);
Then('the custom game is unrated and untimed', async (w) => {
  const game = await current(w);
  expect({ minutes: game.minutes, increment: game.increment }).toEqual({
    minutes: 0,
    increment: 0,
  });
  expect(await w.s.read(customGameShownUnrated, hostOf(w))).toBe(true);
});

Then(
  '{actor} is told only the host creates a custom game',
  async (w, actor: string) =>
    toldOf(w, actor, 'only the host creates a Custom Game')
);
Then(
  '{actor} is told the custom game must finish or be cancelled first',
  async (w, actor: string) => toldOf(w, actor, 'finish or cancel first')
);
