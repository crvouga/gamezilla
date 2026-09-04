import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  createSpace,
  deviceId,
  expectConverged,
  liveSpace,
  mutate,
  SPACE_MEMBERSHIP_SESSION,
} from '../apps/acme';
import {
  expectNoForeignOpenSessionsAt,
  expectOpenSessionAt,
  liveOpenSessions,
} from '../apps/acme/reads';

/**
 * Replicates the product bug: createSpace writes spaces + spaces_users (user
 * wake) and spaces_open_sessions (device-private). Same-account peer must get
 * the space via live fanout but must NOT apply the writer's open-session row.
 */
describe('same actor open session stays device private', () => {
  test('createSpace open-session row images do not land on peer device', async () => {
    await using s = await acmeSystem.script({
      seed: 1401,
      args: { clientCount: 0, rowImageFanout: true },
    });

    await s.apply(addClient, {
      id: 'phone',
      actorId: 'user-1',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await s.apply(addClient, {
      id: 'tablet',
      actorId: 'user-1',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    expect(await s.observe(deviceId, 'phone')).not.toBe(
      await s.observe(deviceId, 'tablet')
    );

    await s.apply(mutate, 'phone', createSpace, {
      id: 'room-1',
      title: 'Private open',
    });
    await expectConverged(s);
    await s.elapse(200);

    await expectOpenSessionAt(s, 'phone', 'room-1');
    await expectNoForeignOpenSessionsAt(s, 'tablet');

    expect(await s.observe(liveOpenSessions, 'tablet')).toEqual([]);

    const tabletSpace = await s.observe(liveSpace, 'tablet', 'room-1');
    expect(tabletSpace).not.toBeNull();
    expect(tabletSpace?.deletedAt).toBeNull();
  });
});
