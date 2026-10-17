import { expect } from 'bun:test';
import {
  attemptCustomGameBoundary,
  readCustomGameBoundary,
} from '@libs/game-session-harness/custom-game-boundary';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import { Given, Then } from '@libs/harness/define';
import { openSpaceLink } from '@libs/spaces-harness/space-actions';
import { activeSpaceVisible } from '@libs/spaces-harness/spaces-ui-reads';
import {
  customDefault,
  customFact,
  customGame,
  customStart,
} from './custom-game-world';

Given(
  '{actor} has an active Custom Game between two bots',
  async (w, actor: string) => {
    await customDefault(w, actor);
    await customFact(w, actor, { operation: 'bot', side: 'white' });
    await customFact(w, actor, { operation: 'bot', side: 'black' });
    await customStart(w);
    expect((await customGame(w)).status).toBe('active');
  }
);
Given("{actor}'s deleted account had a Custom Game", async (w) => {
  expect(w.memo.get('deleted-custom-game-id')).toBeString();
  expect(w.memo.get('deleted-custom-game-link')).toBeString();
});
Then("{actor}'s space has not ended", async (w, actor: string) => {
  await w.s.apply(openSpaceLink, actor, String(w.memo.get('custom-link')));
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
});
Then(
  "{actor} cannot see the deleted account's Custom Game",
  async (w, actor: string) => {
    const link = String(w.memo.get('deleted-custom-game-link'));
    await w.s.apply(openSpaceLink, actor, link);
    await w.s.apply(attemptCustomGameBoundary, actor, {
      spaceId: link.split('/space/')[1] ?? '',
    });
    expect(await w.s.read(readCustomGameProbe, actor)).toBeNull();
    expect(await w.s.read(readCustomGameBoundary, actor)).toEqual({
      reason: 'not in the space',
      disclosed: false,
    });
  }
);
