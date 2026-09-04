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
      await using s = await openSim('topology-partition-heal', ctx);
      const app = await AppDriver.forActor(s, 'alice');
      const hostCaps = await s.observe(caps);

      if (!hostCaps.includes('partition')) {
        let threw = false;
        try {
          await s.apply(partition, 'alice');
        } catch (e) {
          threw = e instanceof ActionNotEnabled;
        }
        assert.ok(threw, 'maxHost: partition is not enabled');
        return;
      }

      await s.apply(partition, 'alice');
      await s.apply(heal);
      await app.auth.signInWithDev(aliceCreds);
      const ids = await s.observe(clientIds);
      assert.ok(ids.includes('alice'), 'alice client mounted after sign-in');
    }
  );
});
