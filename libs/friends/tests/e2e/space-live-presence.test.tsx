// goal:spaces:4
import { describe, expect, test } from 'bun:test';
import { clientIds, signInWithGoogle } from '@libs/sim-harness';
import { openSim } from './support/open-friends-sim';

describe('space live presence', () => {
  test('two product actors can share a synchronized session', async () => {
    await using s = await openSim('friends-request-accept');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(signInWithGoogle, 'bob');
    const ids = await s.read(clientIds);
    expect(ids.includes('alice')).toBe(true);
    expect(ids.includes('bob')).toBe(true);
  });
});
