import { expect } from 'bun:test';
import { setCustomGameAvailability } from '@libs/chess-custom-game-harness/custom-game-availability';
import { customGameAwayClaimShown } from '@libs/chess-custom-game-harness/custom-game-play-reads';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import { Given, Then } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { customGame } from './custom-game-world';

async function pauseSharedGame(w: HarnessWorld): Promise<void> {
  const space = String(w.memo.get('custom-link')).slice('/space/'.length);
  await w.s.apply(setCustomGameAvailability, space, false);
}

Given("the Custom Game's clocks are paused", pauseSharedGame);
Given(
  'the Custom Game cannot currently be played by either participant',
  pauseSharedGame
);
Then('the Custom Game remains active without a winner', async (w) => {
  const game = await customGame(w);
  expect(game.status).toBe('active');
  expect(game.outcome).toBe('');
});
Then(
  '{actor} is told the Custom Game is temporarily unavailable',
  async (w, actor: string) => {
    expect((await w.s.read(readCustomGameProbe, actor))?.error).toBe(
      'the Custom Game is temporarily unavailable'
    );
  }
);
Then('neither participant is offered to claim an away win', async (w) => {
  for (const actor of ['alice', 'bob'])
    expect(await w.s.read(customGameAwayClaimShown, actor)).toBe(false);
});
