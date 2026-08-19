/**
 * Product scenario: partition client:alice–api then heal; UI still drives.
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

  testFn('partition alice–api then heal still allows sign-up', async () => {
    await using sim = await openSim('topology-partition-heal');
    const app = await AppDriver.forActor(sim, 'alice');

    sim.world.faults.partition('client:alice', 'api');
    sim.world.faults.heal('client:alice', 'api');

    await app.auth.signUpWithEmail(aliceCreds);
    expect(sim.world.instances.has('client:alice')).toBe(true);
    expect(sim.world.instances.has('events')).toBe(true);
  });
});
