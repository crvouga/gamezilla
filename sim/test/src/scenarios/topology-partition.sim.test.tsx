/**
 * Product scenario: partition alice–server then heal; UI still drives.
 */

import { describe, expect, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import {
  isWorldMeshSupported,
  resolveOpenSimFidelity,
} from '../setup/fidelity';
import { openSim } from '../setup/open-sim';

describe('topology partition', () => {
  const fidelity = resolveOpenSimFidelity();
  const testFn = isWorldMeshSupported(fidelity) ? test : test.skip;

  testFn('partition alice–server then heal still allows sign-up', async () => {
    await using handle = await openSim('topology-partition-heal');
    const app = await AppDriver.forActor(handle, 'alice');

    handle.sim.partition('alice', 'server');
    handle.sim.heal('alice', 'server');

    await app.auth.signInWithDev(aliceCreds);
    expect(handle.sim.clientIds().includes('alice')).toBe(true);
  });
});
