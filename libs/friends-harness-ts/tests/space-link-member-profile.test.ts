import { expect, test } from 'bun:test';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness-ts/profile-actions';
import { profileIdOf } from '@libs/profile-harness-ts/profile-ui-reads';
import {
  createSpace,
  joinViaLink,
  openSpaceMembers,
} from '@libs/spaces-harness-ts/space-actions';
import {
  readSpaceLink,
  readSpacePresenceCount,
  spaceMemberName,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openHarness } from './open-friends-harness';

test('a host sees the name of a person who joined by link', async () => {
  // regression: isolated-solid-workspace-export-resolution
  // regression: unconfirmed-join-keeps-preview-grants
  // regression: space-link-member-profile-missing
  await using s = await openHarness('space-link-member-profile-missing');
  await s.apply(openProfileEdit, 'bob');
  await s.apply(setUsername, 'bob', 'bob_w');
  await s.apply(createSpace, 'alice');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('Alice did not create a space');
  await s.apply(joinViaLink, 'bob', link);
  await s.apply(openSpaceMembers, 'alice');
  await s.until((h) => readSpacePresenceCount(h, 'alice'), {
    pred: (count) => count === 2,
    maxMs: 20_000,
  });
  const member = await s.read(profileIdOf, 'bob');
  if (member === null) throw new Error('Bob has no profile');
  await s.apply(focusActor, 'alice');
  const name = await s.until((h) => spaceMemberName(h, 'alice', member), {
    pred: (shown) => shown === 'bob_w',
    maxMs: 20_000,
  });
  expect(name).toBe('bob_w');
}, 60_000);
