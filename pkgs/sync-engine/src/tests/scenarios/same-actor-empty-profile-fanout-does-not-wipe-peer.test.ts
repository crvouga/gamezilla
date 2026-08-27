import { describe, expect, test } from 'bun:test';
import {
  ensureProfileEmpty,
  acmeDomainPack,
  OWN_PROFILE_SESSION,
  readProfileUsername,
  setProfileUsername,
} from '../apps/acme';
import { openSimWorld } from '../../sim/world';

/**
 * Replicates the product bug: ensureProfile-style empty username INSERT fans
 * out on user:{actor} and upsert-wipes a same-account peer's assigned handle.
 * Framework scrubbers must keep the peer's username intact.
 */
describe('same actor empty profile fanout does not wipe peer', () => {
  test('empty ensureProfile seed does not blank peer username', async () => {
    await using world = await openSimWorld({
      domain: acmeDomainPack,
      seed: 1501,
      rowImageFanout: true,
    });
    const phone = await world.addClient({
      id: 'phone',
      actorId: 'user-1',
      sessionQuery: OWN_PROFILE_SESSION,
    });
    const tablet = await world.addClient({
      id: 'tablet',
      actorId: 'user-1',
      sessionQuery: OWN_PROFILE_SESSION,
    });

    expect(phone.deviceId).not.toBe(tablet.deviceId);

    await phone.mutate(setProfileUsername, { username: 'AliceHandle' });
    await world.assertConverged();
    expect(await readProfileUsername(phone.db, 'user-1')).toBe('AliceHandle');
    expect(await readProfileUsername(tablet.db, 'user-1')).toBe('AliceHandle');

    await tablet.mutate(ensureProfileEmpty, {});
    await world.runFor(200);

    expect(await readProfileUsername(phone.db, 'user-1')).toBe('AliceHandle');

    await world.assertConverged();
    expect(await readProfileUsername(phone.db, 'user-1')).toBe('AliceHandle');
    expect(await readProfileUsername(tablet.db, 'user-1')).toBe('AliceHandle');
  });
});
