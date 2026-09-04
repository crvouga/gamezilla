import { describe, expect, test } from 'bun:test';
import {
  acmeSystem,
  addClient,
  deviceId,
  ensureProfileEmpty,
  expectConverged,
  mutate,
  OWN_PROFILE_SESSION,
  readProfileUsernameAt,
  setProfileUsername,
} from '../apps/acme';

/**
 * Replicates the product bug: ensureProfile-style empty username INSERT fans
 * out on user:{actor} and upsert-wipes a same-account peer's assigned handle.
 * Framework scrubbers must keep the peer's username intact.
 */
describe('same actor empty profile fanout does not wipe peer', () => {
  test('empty ensureProfile seed does not blank peer username', async () => {
    await using s = await acmeSystem.script({
      seed: 1501,
      args: { clientCount: 0, rowImageFanout: true },
    });

    await s.apply(addClient, {
      id: 'phone',
      actorId: 'user-1',
      sessionQuery: OWN_PROFILE_SESSION,
    });
    await s.apply(addClient, {
      id: 'tablet',
      actorId: 'user-1',
      sessionQuery: OWN_PROFILE_SESSION,
    });

    expect(await s.observe(deviceId, 'phone')).not.toBe(
      await s.observe(deviceId, 'tablet')
    );

    await s.apply(mutate, 'phone', setProfileUsername, {
      username: 'AliceHandle',
    });
    await expectConverged(s);
    expect(await readProfileUsernameAt(s, 'phone', 'user-1')).toBe(
      'AliceHandle'
    );
    expect(await readProfileUsernameAt(s, 'tablet', 'user-1')).toBe(
      'AliceHandle'
    );

    await s.apply(mutate, 'tablet', ensureProfileEmpty, {});
    await s.elapse(200);

    expect(await readProfileUsernameAt(s, 'phone', 'user-1')).toBe(
      'AliceHandle'
    );

    await expectConverged(s);
    expect(await readProfileUsernameAt(s, 'phone', 'user-1')).toBe(
      'AliceHandle'
    );
    expect(await readProfileUsernameAt(s, 'tablet', 'user-1')).toBe(
      'AliceHandle'
    );
  });
});
