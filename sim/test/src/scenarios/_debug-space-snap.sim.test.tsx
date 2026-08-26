import { describe, test } from '@jest/globals';
import { sql } from '@pkgs/sql';

import { AppDriver } from '../drivers/app-driver';
import { bobUsername } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('debug space with snapshot', () => {
  test('signed-in-alice creates space on server', async () => {
    await using sim = await openSim('debug-space-snap', {
      snapshot: 'signed-in-alice',
    });
    const alice = await AppDriver.forActor(sim, 'alice');
    await alice.space.createSpace();
    const aliceSql = sim.sim.clientSql('alice');
    const pendingBefore =
      aliceSql === undefined
        ? []
        : await aliceSql.sqlClient.query(sql`
            SELECT name, id FROM sync_engine_mutations
          `);
    // eslint-disable-next-line no-console
    console.log('pendingBefore', pendingBefore);
    await sim.drainMutations(['alice']);
    const spaces = await sim.sim.serverSql.sqlClient.query(sql`
      SELECT id, host_user_id FROM spaces
    `);
    // eslint-disable-next-line no-console
    console.log('spaces', spaces);
    expect(spaces.length).toBeGreaterThan(0);
  }, 30_000);
});
