import { expect, test } from 'bun:test';
import { setupFriendsPair } from '@libs/friends-harness-ts/setup-friends-pair';
import { focusActor } from '@libs/harness-ts/shell-actions';
import {
  createSpace,
  renameSpace,
} from '@libs/spaces-harness-ts/space-actions';
import { spaceNameShown } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openHarness } from './open-friends-harness';

test('a host clears the space name and the space is named after them again', async () => {
  // regression: space-rename-clear-name
  await using s = await openHarness();
  await setupFriendsPair(s, 'alice', 'bob');
  await s.apply(focusActor, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(renameSpace, 'alice', 'Friday puzzles');
  await s.until((h) => spaceNameShown(h, 'alice'), {
    pred: (shown) => shown === 'Friday puzzles',
  });
  await s.apply(renameSpace, 'alice', '');
  const shown = await s.until((h) => spaceNameShown(h, 'alice'), {
    pred: (title) => title !== null && title !== 'Friday puzzles',
  });
  expect(shown?.endsWith('’s space')).toBe(true);
}, 60_000);
