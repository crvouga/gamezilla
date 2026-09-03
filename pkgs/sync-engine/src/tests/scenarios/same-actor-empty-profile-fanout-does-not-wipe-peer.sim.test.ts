import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
  acmeSystem,
  addClient,
  deviceId,
  ensureProfileEmpty,
  expectConverged,
  mutate,
  OWN_PROFILE_SESSION,
  passTime,
  readProfileUsernameAt,
  setProfileUsername,
  syncVirtualHost,
} from '../apps/acme';

/**
 * Replicates the product bug: ensureProfile-style empty username INSERT fans
 * out on user:{actor} and upsert-wipes a same-account peer's assigned handle.
 * Framework scrubbers must keep the peer's username intact.
 */
describe('same actor empty profile fanout does not wipe peer', () => {
  test('empty ensureProfile seed does not blank peer username', async () => {
    await using run = await start(acmeSystem, {
      seed: 1501,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0, rowImageFanout: true }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'phone',
      actorId: 'user-1',
      sessionQuery: OWN_PROFILE_SESSION,
    });
    await run.apply(addClient, {
      id: 'tablet',
      actorId: 'user-1',
      sessionQuery: OWN_PROFILE_SESSION,
    });

    expect(await run.observe(deviceId('phone'))).not.toBe(
      await run.observe(deviceId('tablet'))
    );

    await run.apply(mutate, 'phone', setProfileUsername, {
      username: 'AliceHandle',
    });
    await expectConverged(run);
    expect(await readProfileUsernameAt(run, 'phone', 'user-1')).toBe(
      'AliceHandle'
    );
    expect(await readProfileUsernameAt(run, 'tablet', 'user-1')).toBe(
      'AliceHandle'
    );

    await run.apply(mutate, 'tablet', ensureProfileEmpty, {});
    await run.apply(passTime, 200);

    expect(await readProfileUsernameAt(run, 'phone', 'user-1')).toBe(
      'AliceHandle'
    );

    await expectConverged(run);
    expect(await readProfileUsernameAt(run, 'phone', 'user-1')).toBe(
      'AliceHandle'
    );
    expect(await readProfileUsernameAt(run, 'tablet', 'user-1')).toBe(
      'AliceHandle'
    );
  });
});
