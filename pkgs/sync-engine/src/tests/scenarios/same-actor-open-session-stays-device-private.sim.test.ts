import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  createSpace,
  deviceId,
  expectConverged,
  liveSpace,
  mutate,
  passTime,
  SPACE_MEMBERSHIP_SESSION,
  syncVirtualHost,
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
    await using run = await start(acmeSystem, {
      seed: 1401,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: true }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'phone',
      actorId: 'user-1',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });
    await run.apply(addClient, {
      id: 'tablet',
      actorId: 'user-1',
      sessionQuery: SPACE_MEMBERSHIP_SESSION,
    });

    expect(await run.observe(deviceId('phone'))).not.toBe(
      await run.observe(deviceId('tablet'))
    );

    await run.apply(mutate, 'phone', createSpace, {
      id: 'room-1',
      title: 'Private open',
    });
    await expectConverged(run);
    await run.apply(passTime, 200);

    await expectOpenSessionAt(run, 'phone', 'room-1');
    await expectNoForeignOpenSessionsAt(run, 'tablet');

    expect(await run.observe(liveOpenSessions('tablet'))).toEqual([]);

    const tabletSpace = await run.observe(liveSpace('tablet', 'room-1'));
    expect(tabletSpace).not.toBeNull();
    expect(tabletSpace?.deletedAt).toBeNull();
  });
});
