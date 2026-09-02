/**
 * Product scenario: partition alice–server then heal; UI still drives.
 */

import { assert } from '@pkgs/assert';
import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('topology partition', (ctx) => {
  if (ctx.fidelity !== 'sim') {
    return;
  }

  ctx.test(
    'partition alice–server then heal still allows sign-up',
    async () => {
      await using handle = await openSim('topology-partition-heal', ctx);
      const app = await AppDriver.forActor(handle, 'alice');

      handle.sim.partition('alice', 'server');
      handle.sim.heal('alice', 'server');

      await app.auth.signInWithDev(aliceCreds);
      assert.ok(
        handle.sim.clientIds().includes('alice'),
        'alice client mounted after sign-in'
      );
    }
  );
});
