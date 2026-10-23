import { expect, test } from 'bun:test';
import '@libs/friends-harness-ts/friends.steps';
import { friendRowVisible } from '@libs/friends-harness-ts/friends-ui-reads';
import { setupFriendsPair } from '@libs/friends-harness-ts/setup-friends-pair';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness-ts/profile-actions';
import { matchStep } from '@pkgs/gherkin-shared-ts/registry';
import { openHarness } from './open-friends-harness';

// regression: renamed-friend-precondition
test('a friends-list precondition recognizes Bob after his rename', async () => {
  await using s = await openHarness('renamed-friend-precondition');
  await setupFriendsPair(s);
  await s.apply(openProfileEdit, 'bob');
  await s.apply(setUsername, 'bob', 'chess_cheater');
  const step = matchStep('Alice is viewing their friends list with Bob in it');
  if (step.kind !== 'match') throw new Error(`Precondition is ${step.kind}`);
  const memo = new Map([['username:bob', 'chess_cheater']]);
  await step.definition.body({ s, memo }, ...step.args);
  expect(await s.read(friendRowVisible, 'alice', 'chess_cheater')).toBe(true);
});
