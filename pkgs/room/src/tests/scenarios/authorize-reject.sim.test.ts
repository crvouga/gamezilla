import { describe, expect, test } from 'bun:test';
import { openWorld } from '@pkgs/determinism';
import { defineRoomSystem, type RoomApp } from '../../sim/scenario';
import { ROOM_ERROR_TYPE } from '../../types';
import { authzApp } from '../apps/authz/app';
import { authzCount, Bump, Claim } from '../fixtures/authz-module';

const denyEveApp: RoomApp = {
  ...authzApp,
  authorize: async (identity) => {
    if (identity === 'eve') {
      return { ok: false, reason: 'banned' };
    }
    return { ok: true };
  },
};

const denyEveSystem = defineRoomSystem(denyEveApp, {
  id: 'room.authz-deny-eve',
});

describe('room sim: authorize reject (E-D03)', () => {
  test('authorize hook denies without mutating', async () => {
    await using host = await openWorld(denyEveSystem, {
      seed: process.env['SIM_SEED'] ?? '42',
      knobs: { clientCount: 0 },
    });
    const world = host;
    const alice = await world.addClient({ id: 'alice' });
    const eve = await world.addClient({ id: 'eve' });
    await world.assertConverged();

    alice.dispatch(Claim({}));
    await world.drain();
    expect(authzCount(alice.snapshot())).toBe(0);

    eve.dispatch(Bump({}));
    await world.drain();
    const err = eve.lastRejection();
    expect(err && 'type' in err ? err.type : null).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );
    expect(await world.storage.getLastSeq(world.topic)).toBe(1);
    expect(authzCount(await world.serverSnapshot())).toBe(0);
    expect(authzCount(alice.snapshot())).toBe(0);
  });
});
