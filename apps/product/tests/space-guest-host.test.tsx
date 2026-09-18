// goal:spaces:1
import { describe, expect, test } from 'bun:test';
import { activeSpaceVisible, createSpace, endSpace } from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

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
