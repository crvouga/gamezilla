// goal:spaces:4
import { describe, expect, test } from 'bun:test';
import { clientIds, signInWithGoogle } from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('space live presence', () => {
  test('two product actors can share a synchronized session', async () => {
    await using s = await openSim('friends-request-accept');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(signInWithGoogle, 'bob');
    expect(await s.read(clientIds)).toEqual(
      expect.arrayContaining(['alice', 'bob'])
    );
  });
});
