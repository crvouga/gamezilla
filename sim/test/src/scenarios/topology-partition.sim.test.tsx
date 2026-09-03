/**
 * Product scenario: partition alice–server then heal; UI still drives.
 * On hosts without the partition capability, apply throws ActionNotEnabled.
 */

import { assert } from '@pkgs/assert';
import { ActionNotEnabled } from '@pkgs/dst';
import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../drivers/app-driver';
import { aliceCreds } from '../fixtures/fixtures';
import { caps, clientIds, heal, partition } from '../scenario';
import { openSim } from '../setup/open-sim';

describe('topology partition', (ctx) => {
  ctx.test(
    'partition alice–server then heal still allows sign-up',
    async () => {
      await using run = await openSim('topology-partition-heal', ctx);
      const app = await AppDriver.forActor(run, 'alice');
      const hostCaps = await run.observe(caps);

      if (!hostCaps.includes('partition')) {
        let threw = false;
        try {
          await run.apply(partition, 'alice');
        } catch (e) {
          threw = e instanceof ActionNotEnabled;
        }
        assert.ok(threw, 'maxHost: partition is not enabled');
        return;
      }

      await run.apply(partition, 'alice');
      await run.apply(heal);
      await app.auth.signInWithDev(aliceCreds);
      const ids = await run.observe(clientIds);
      assert.ok(ids.includes('alice'), 'alice client mounted after sign-in');
    }
  );
});
