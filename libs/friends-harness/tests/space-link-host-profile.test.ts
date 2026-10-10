import { expect, test } from 'bun:test';
import { focusActor } from '@libs/harness/shell-actions';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile-harness/profile-actions';
import { createSpace, joinViaLink } from '@libs/spaces-harness/space-actions';
import {
  readSpaceLink,
  spaceTitleShown,
} from '@libs/spaces-harness/spaces-ui-reads';
import { openHarness } from './open-friends-harness';

test('a person who joins by link sees the host-based name follow the host', async () => {
  // regression: space-link-host-profile-missing
  await using s = await openHarness('space-link-host-profile-missing');
  await s.apply(createSpace, 'alice');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('Alice did not create a space');
  await s.apply(joinViaLink, 'bob', link);
  await s.apply(openProfileEdit, 'alice');
  await s.apply(setUsername, 'alice', 'alice_w');
  await s.apply(focusActor, 'bob');
  const title = await s.until((h) => spaceTitleShown(h, 'bob'), {
    pred: (shown) => shown === "alice_w's space",
    maxMs: 15_000,
  });
  expect(title).toBe("alice_w's space");
}, 60_000);
