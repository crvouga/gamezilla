import { describe, expect, test } from 'bun:test';
import {
  addClient,
  defineRoomSystem,
  dispatch,
  logSeq,
  type RoomApp,
  startRoom,
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

const denyEveSystem = defineRoomSystem(denyEveApp, {
  name: 'room.authz-deny-eve',
});

describe('room sim: authorize reject (E-D03)', () => {
  test('authorize hook denies without mutating', async () => {
    await using run = await startRoom(denyEveSystem);
    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'eve' });
    await expectConverged(run);

    await run.apply(dispatch, {
      clientId: 'alice',
      payload: Claim({}),
    });
    expect(authzCount(await readClient(run, 'alice'))).toBe(0);

    await run.apply(dispatch, {
      clientId: 'eve',
      payload: Bump({}),
    });
    expect((await readRejection(run, 'eve'))?.type).toBe(
      ROOM_ERROR_TYPE.unauthorized
    );
    expect(await run.observe(logSeq)).toBe(1);
    expect(authzCount(await readServer(run))).toBe(0);
    expect(authzCount(await readClient(run, 'alice'))).toBe(0);
  });
});
