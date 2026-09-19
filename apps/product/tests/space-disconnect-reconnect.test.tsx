// goal:spaces:5
import { describe, expect, test } from 'bun:test';
import {
  caps,
  clientIds,
  partition,
  restoreNetwork,
  signInWithGoogle,
} from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('space disconnect reconnect', () => {
  test('product topology can partition and restore an actor session', async () => {
    await using s = await openSim('topology-partition-restoreNetwork');
    await s.apply(signInWithGoogle, 'alice');
    expect((await s.read(caps)).includes('partition')).toBe(true);
    await s.apply(partition, 'alice');
    await s.apply(restoreNetwork);
    expect(await s.read(clientIds)).toContain('alice');
  });
});
