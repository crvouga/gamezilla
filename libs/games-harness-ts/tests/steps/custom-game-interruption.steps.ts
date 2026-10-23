import { expect } from 'bun:test';
import { setCustomGameAvailability } from '@libs/game-session-harness-ts/custom-game-availability';
import { customGameClaimWinOffered } from '@libs/game-session-harness-ts/custom-game-reads';
import { Given, Then } from '@libs/harness-ts/define';
import { toldOf } from './custom-game-set-up-world';
import { spaceLinkOf } from './game-world';

Given('the custom game is paused', async (w) => {
  const space = (await spaceLinkOf(w)).split('/space/')[1] ?? '';
  await w.s.apply(setCustomGameAvailability, space, false);
});

Then('{actor} is told the custom game is paused', async (w, actor: string) =>
  toldOf(w, actor, 'the Custom Game is temporarily unavailable')
);
Then('neither participant is offered to claim the win', async (w) => {
  for (const actor of ['alice', 'bob'])
    expect(await w.s.read(customGameClaimWinOffered, actor)).toBe(false);
});
