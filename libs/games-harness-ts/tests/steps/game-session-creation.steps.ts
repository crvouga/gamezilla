import { expect } from 'bun:test';
import { switchSpaceGame } from '@libs/game-session-harness-ts/game-navigation';
import { createGameSessionIn } from '@libs/game-session-harness-ts/game-session-controls';
import { gameSessionShownUnrated } from '@libs/game-session-harness-ts/game-session-reads';
import { initialHarnessPosition } from '@libs/game-session-harness-ts/simulation-fixtures';
import { Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { current, identityOf, toldOf } from './game-session-set-up-world';
import { anotherGame, before, gameOf, hostOf, view } from './game-world';

/** The host of the space the scenario is in, however it was set up. */
function spaceHostOf(w: HarnessWorld): string {
  return String(w.memo.get('spaceHost') ?? hostOf(w));
}

When('{actor} creates a game session', async (w, actor: string) => {
  // regression: chess-custom-client-schedules — a guest's first create.
  const host = spaceHostOf(w);
  w.memo.set('game-session-host', host);
  await w.s.apply(createGameSessionIn, gameOf(w).shared.id, host, actor);
});

Then('{actor} is the creator of the game session', async (w, actor: string) => {
  expect((await current(w)).creator).toBe(await identityOf(w, actor));
});
Then('a new game session is being set up with no moves', async (w) => {
  const game = await current(w);
  expect(game.id).not.toBe(before(w).current?.id);
  expect(game.status).toBe('configuring');
  expect(game.moves).toEqual([]);
});
Then(
  "the game session is under way from the game's starting position",
  async (w) => {
    const game = await current(w);
    expect(game.status).toBe('active');
    expect(game.moves).toEqual([]);
    expect(game.fen).toBe(initialHarnessPosition(gameOf(w).shared, game.id));
  }
);
Then('the game session is unrated and untimed', async (w) => {
  const game = await current(w);
  expect({ minutes: game.minutes, increment: game.increment }).toEqual({
    minutes: 0,
    increment: 0,
  });
  expect(await w.s.read(gameSessionShownUnrated, hostOf(w))).toBe(true);
});

Then(
  '{actor} is told only the host creates a game session',
  async (w, actor: string) =>
    toldOf(w, actor, 'only the host creates a Game Session')
);
Then(
  '{actor} is told the game session must finish or be cancelled first',
  async (w, actor: string) => toldOf(w, actor, 'finish or cancel first')
);

When(
  '{actor} opens game sessions for a different game',
  async (w, actor: string) =>
    w.s.apply(switchSpaceGame, actor, anotherGame(w, 'vs-human').shared.id)
);
Then(
  '{actor} sees the game she/he was setting up with its seats unchanged',
  async (w, actor: string) => {
    const original = before(w).current;
    expect(original?.status).toBe('configuring');
    expect((await view(w, actor)).current).toEqual(original);
  }
);
