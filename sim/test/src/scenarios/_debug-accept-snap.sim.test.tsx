import { describe, test } from '@jest/globals';
import { sql } from '@pkgs/sql';

import { AppDriver } from '../drivers/app-driver';
import { aliceUsername, bobUsername } from '../fixtures/fixtures';
import { openSim } from '../setup/open-sim';

describe('debug accept with snapshot', () => {
  test('signed-in-pair snapshot then accept', async () => {
    await using sim = await openSim('debug-accept-snap', {
      snapshot: 'signed-in-pair',
    });
    const alice = await AppDriver.forActor(sim, 'alice');
    const bob = await AppDriver.forActor(sim, 'bob');
    await alice.search.expectUserVisible(bobUsername);
    await alice.search.addFriend(bobUsername);
    await sim.drainMutations(['alice', 'bob']);
    const requests = await sim.sim.serverSql.sqlClient.query(sql`
      SELECT id, from_user_id, to_user_id, status FROM friends_requests
    `);
    const notifications = await sim.sim.serverSql.sqlClient.query(sql`
      SELECT id, user_id, title, category FROM notifications
    `);
    const rejections = await sim.sim.serverSql.sqlClient.query(sql`
      SELECT code, message, mutation_id FROM sync_engine_write_rejections
    `);
    const aliceSql = sim.sim.clientSql('alice');
    const pending =
      aliceSql === undefined
        ? []
        : await aliceSql.sqlClient.query(sql`
            SELECT name, id FROM sync_engine_mutations
          `);
    // eslint-disable-next-line no-console
    console.log('friends_requests', requests);
    // eslint-disable-next-line no-console
    console.log('notifications', notifications);
    // eslint-disable-next-line no-console
    console.log('rejections', rejections);
    // eslint-disable-next-line no-console
    console.log('pending', pending);
    await bob.notifications.acceptFriendRequest(aliceUsername);
  }, 30_000);
});
