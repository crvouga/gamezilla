import { expect, test } from 'bun:test';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import {
  closeSpaceMembers,
  createSpace,
  endSpace,
  joinViaLink,
  openSpaceMembers,
  returnToLobby,
} from '@libs/spaces-harness/space-actions';
import {
  lobbySpaceCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces-harness/spaces-ui-reads';
import { openHarness } from './open-friends-harness';

test('a joined guest can observe their lobby card without the host profile', async () => {
  // regression: space-guest-lobby-card-unobservable
  await using s = await openHarness('space-guest-lobby-card-unobservable');
  await s.apply(createSpace, 'alice');
  const link = await s.read(readSpaceLink, 'alice');
  if (link === null) throw new Error('Alice did not create a space');
  await s.apply(joinViaLink, 'bob', link);
  await s.apply(openSpaceMembers, 'alice');
  await s.until((h) => readSpacePresenceCount(h, 'alice'), {
    pred: (count) => count === 2,
  });
  await s.apply(closeSpaceMembers, 'alice');
  await s.apply(partition, 'alice');
  await s.advanceTime(1_000);
  await s.apply(returnToLobby, 'bob');
  expect(await s.read(lobbySpaceCardVisible, 'bob', link)).toBe(true);

  await s.apply(restoreActorConnection, 'alice');
  await s.apply(endSpace, 'alice');
  await s.until((h) => lobbySpaceCardVisible(h, 'bob', link), {
    pred: (listed) => !listed,
  });
  expect(await s.read(lobbySpaceCardVisible, 'bob', link)).toBe(false);
}, 60_000);
