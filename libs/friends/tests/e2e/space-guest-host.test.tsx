// goal:spaces:1
import { describe, expect, test } from 'bun:test';
import { createSpace, endSpace } from '@libs/spaces/sim/space-actions';
import { activeSpaceVisible } from '@libs/spaces/sim/spaces-ui-reads';
import { openSim } from './support/open-friends-sim';

describe('space guest host', () => {
  test('a guest creates a space and hosts it', async () => {
    await using s = await openSim('space-guest-host');

    await s.apply(createSpace, 'alice');
    expect(await s.read(activeSpaceVisible, 'alice')).toBe(true);
  });

  test('a guest host can end their own space', async () => {
    await using s = await openSim('space-guest-host-end');

    await s.apply(createSpace, 'alice');
    await s.apply(endSpace, 'alice');
    expect(await s.read(activeSpaceVisible, 'alice')).toBe(false);
  });
});
