// goal:spaces:2
import { describe, expect, test } from 'bun:test';
import { clientIds, signInWithGoogle } from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('space guest link join', () => {
  test('product session can mount a second actor', async () => {
    await using s = await openSim('space-friend-join');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(signInWithGoogle, 'bob');
    const ids = await s.read(clientIds);
    expect(ids.includes('alice')).toBe(true);
    expect(ids.includes('bob')).toBe(true);
  });
});
