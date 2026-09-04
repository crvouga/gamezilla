/**
 * Product scenario: partition alice–server then restoreNetwork; UI still drives.
 * On hosts without the partition capability, apply throws ActionNotEnabled.
 */

import { assert } from '@pkgs/assert';
import { ActionNotEnabled } from '@pkgs/sim';
import { describe } from '@pkgs/ui-testing';

import { AppDriver } from '../src/drivers/app-driver';
import { aliceCreds } from '../src/fixtures/fixtures';
import { openSim } from '../src/setup/open-sim';
import { caps, clientIds, partition, restoreNetwork } from '../src/sim';

describe('topology partition', (ctx) => {
  ctx.test(
    'partition alice–server then restoreNetwork still allows sign-up',
    async () => {
      await using s = await openSim('topology-partition-restoreNetwork', ctx);
      const app = await AppDriver.forActor(s, 'alice');
      const hostCaps = await s.read(caps);

      if (!hostCaps.includes('partition')) {
        let threw = false;
        try {
          await s.apply(partition, 'alice');
        } catch (e) {
          threw = e instanceof ActionNotEnabled;
        }
        assert.ok(threw, 'maxRuntime: partition is not enabled');
        return;
      }

      await s.apply(partition, 'alice');
      await s.apply(restoreNetwork);
      await app.auth.signInWithDev(aliceCreds);
      const ids = await s.read(clientIds);
      assert.ok(ids.includes('alice'), 'alice client mounted after sign-in');
    }
  );
});
