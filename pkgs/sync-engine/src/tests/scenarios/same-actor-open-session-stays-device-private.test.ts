import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import { openSimWorld } from '../../sim/world';
import {
  acmeDomainPack,
  createSpace,
  expectNoForeignOpenSessions,
  expectOpenSession,
  readLiveOpenSessions,
  SPACE_MEMBERSHIP_SESSION,
} from '../apps/acme';

/**
 * Replicates the product bug: createSpace writes spaces + spaces_users (user
 * wake) and spaces_open_sessions (device-private). Same-account peer must get
 * the space via live fanout but must NOT apply the writer's open-session row.
 */
describe('same actor open session stays device private', () => {
  test('createSpace open-session row images do not land on peer device', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 1401,
      rowImageFanout: true,
    });
    const phone = await world.addClient({
      id: 'phone',
      actorId: 'user-1',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    const tablet = await world.addClient({
      id: 'tablet',
      actorId: 'user-1',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    expect(phone.deviceId).not.toBe(tablet.deviceId);

    await phone.mutate(createSpace, { id: 'room-1', title: 'Private open' });
    await world.assertConverged();
    await world.runFor(200);

    await expectOpenSession(phone.db, phone.deviceId, 'room-1');
    await expectNoForeignOpenSessions(tablet.db, tablet.deviceId);

    const tabletSessions = await readLiveOpenSessions(tablet.db);
    expect(tabletSessions).toEqual([]);

    const tabletSpaces = await tablet.db.query(sql<{ id: string }>`
      SELECT id FROM spaces WHERE id = ${'room-1'} AND deleted_at IS NULL
    `);
    expect(tabletSpaces.length).toBe(1);
  });
});
