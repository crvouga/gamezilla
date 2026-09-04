import { describe, expect, test } from 'bun:test';
import { defineSystem } from '@pkgs/dst';
import {
  addClient,
  bootRoomSurface,
  dispatch,
  logSeq,
  ROOM_ARGS,
  ROOM_DRAW,
  type RoomApp,
  type RoomArgs,
  type RoomSurface,
  roomVirtual,
} from '../../sim/scenario';
import { ROOM_ERROR_TYPE } from '../../types';
import { authzApp } from '../apps/authz/app';
import { expectConverged } from '../expect-converged';
import { authzCount, Bump, Claim } from '../fixtures/authz-module';
import { readClient, readRejection, readServer } from '../scenario/read-state';

const denyEveApp: RoomApp = {
  ...authzApp,
  authorize: async (identity) => {
    if (identity === 'eve') {
      return { ok: false, reason: 'banned' };
    }
    return { ok: true };
  },
};

const denyEveSystem = defineSystem<RoomSurface, RoomArgs>({
  name: 'room.authz-deny-eve',
  args: ROOM_ARGS,
  draw: ROOM_DRAW,
  create: (session, args) => bootRoomSurface(session, denyEveApp, args),
});

denyEveSystem.host({ default: true, name: 'virtual', create: roomVirtual });

describe('room sim: authorize reject (E-D03)', () => {
  test('authorize hook denies without mutating', async () => {
    await using s = await denyEveSystem.script({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'eve' });
    await expectConverged(s);

    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Claim({}),
    });
    expect(authzCount(await readClient(s, 'alice'))).toBe(0);

    await s.apply(dispatch, {
      clientId: 'eve',
      payload: Bump({}),
    });
    expect((await readRejection(s, 'eve'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );
    expect(await s.observe(logSeq)).toBe(1);
    expect(authzCount(await readServer(run))).toBe(0);
    expect(authzCount(await readClient(s, 'alice'))).toBe(0);
  });
});
