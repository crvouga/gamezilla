import { describe, test } from 'bun:test';
import { assert } from '@pkgs/assert';
import { ActionNotEnabled } from '@pkgs/sim';
import {
  caps,
  clientIds,
  partition,
  restoreNetwork,
  signInWithDev,
  spawnActor,
} from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

describe('topology partition', () => {
  test('partition alice–server then restoreNetwork still allows sign-up', async () => {
    await using s = await openSim('topology-partition-restoreNetwork');
    await s.apply(spawnActor, 'alice');
    const hostCaps = await s.read(caps);

    if (!hostCaps.includes('partition')) {
      let threw = false;
      try {
        await s.apply(partition, 'alice');
      } catch (e) {
        threw = e instanceof ActionNotEnabled;
      }
      assert.ok(threw, 'localhost profile: partition is not enabled');
      return;
    }

    await s.apply(partition, 'alice');
    await s.apply(restoreNetwork);
    await s.apply(signInWithDev, 'alice');
    const ids = await s.read(clientIds);
    assert.ok(ids.includes('alice'), 'alice client mounted after sign-in');
  });
});
