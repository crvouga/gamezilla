import { expect } from 'bun:test';
import { setGameSessionAvailability } from '@libs/game-session-harness-ts/game-session-availability';
import { gameSessionClaimWinOffered } from '@libs/game-session-harness-ts/game-session-reads';
import { Given, Then } from '@libs/harness-ts/define';
import { toldOf } from './game-session-set-up-world';
import { spaceLinkOf } from './game-world';

Given('the game session is paused', async (w) => {
  const space = (await spaceLinkOf(w)).split('/space/')[1] ?? '';
  await w.s.apply(setGameSessionAvailability, space, false);
});

Then('{actor} is told the game session is paused', async (w, actor: string) =>
  toldOf(w, actor, 'the Game Session is temporarily unavailable')
);
Then('neither participant is offered to claim the win', async (w) => {
  for (const actor of ['alice', 'bob'])
    expect(await w.s.read(gameSessionClaimWinOffered, actor)).toBe(false);
});
