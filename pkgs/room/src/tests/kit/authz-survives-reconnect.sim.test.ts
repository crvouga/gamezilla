import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { roomWorld } from '../../sim/system';
import { ROOM_ERROR_TYPE } from '../../types';
import { authzSystem } from '../apps/authz/system';
import { authzCount, authzOwner, Bump, Claim } from '../fixtures/authz-module';

describe('kit: authz survives reconnect (M-F05)', () => {
  test('non-owner still unauthorized after soft reconnect', async () => {
    await using host = await openWorld(authzSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = roomWorld(host.state);
    const alice = await world.addClient({ id: 'alice' });
    const bob = await world.addClient({ id: 'bob' });
    await world.assertConverged();

    alice.dispatch(Claim({}));
    await world.drain();
    expect(authzOwner(await world.serverSnapshot())).toBe('alice');
    expect(authzOwner(alice.snapshot())).toBe('alice');

    bob.dispatch(Bump({}));
    await world.drain();
    expect(bob.lastRejection()?.type).toBe(ROOM_ERROR_TYPE.unauthorized);

    await bob.disconnect();
    await bob.connect();
    bob.dispatch(Bump({}));
    await world.drain();
    expect(bob.lastRejection()?.type).toBe(ROOM_ERROR_TYPE.unauthorized);
    expect(authzCount(await world.serverSnapshot())).toBe(0);
    expect(authzCount(alice.snapshot())).toBe(0);
  });
});
