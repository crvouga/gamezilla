/**
 * Product scenario: partition alice–server then heal; UI still drives.
 */

import { describe, expect, test } from '@jest/globals';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('topology partition', () => {
  test('partition alice–server then heal still allows sign-up', async () => {
    await using sim = await openSim('topology-partition-heal');
    const app = await AppDriver.forActor(sim, 'alice');

    await sim.edge('alice', 'server').partition();
    await sim.edge('alice', 'server').heal();

    await app.auth.signUpWithEmail(aliceCreds);
    expect(sim.topology().nodes.some((n) => n.id === 'alice')).toBe(true);
    expect(sim.topology().nodes.some((n) => n.id === 'pubsub')).toBe(true);
  });
});
