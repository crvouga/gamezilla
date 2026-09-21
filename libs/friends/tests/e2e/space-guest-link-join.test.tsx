// goal:spaces:2
// goal:social:1
import { describe, expect, test } from 'bun:test';
import {
  closeSpaceMembers,
  createSpace,
  joinFromPrompt,
  openSpaceLink,
  openSpaceMembers,
} from '@libs/spaces/sim/space-actions';
import {
  activeSpaceVisible,
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces/sim/spaces-ui-reads';
import { openSim } from './support/open-friends-sim';

describe('space guest link join', () => {
  test('a guest with no account opens the link and joins the space', async () => {
    await using s = await openSim('guest-link-join');
    // Neither person has an account: alice hosts as a guest, bob has only
    // the link she copied.
    await s.apply(createSpace, 'alice');
    const link = await s.read(readSpaceLink, 'alice');
    expect(link).toMatch(/^\/space\/.+/);

    await s.apply(openSpaceLink, 'bob', link ?? '');
    await s.apply(joinFromPrompt, 'bob');
    expect(await s.read(activeSpaceVisible, 'bob')).toBe(true);

    // Both are in the same space: each sees the other connected.
    for (const actor of ['bob', 'alice']) {
      await s.apply(openSpaceMembers, actor);
      await s.until((surf) => readSpacePresenceCount(surf, actor), {
        pred: (n) => n === 2,
        maxMs: 15_000,
      });
      await s.apply(closeSpaceMembers, actor);
    }
  });
});
