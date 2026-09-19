// goal:spaces:3
import { describe, expect, test } from 'bun:test';
import { clientIds, signInWithGoogle } from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('space host selects game', () => {
  test('product session exposes the host actor for game selection', async () => {
    await using s = await openSim('space-create');
    await s.apply(signInWithGoogle, 'alice');
    expect(await s.read(clientIds)).toContain('alice');
  });
});
