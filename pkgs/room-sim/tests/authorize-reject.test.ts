import { describe, expect, test } from 'bun:test';
import { ROOM_ERROR_TYPE } from '@pkgs/room';
import {
  addClient,
  authzApp,
  authzCount,
  Bump,
  bootRoomSim,
  Claim,
  dispatch,
  expectInSync,
  logSeq,
  ROOM_ARGS,
  ROOM_DRAW,
  ROOM_VIRTUAL_RUNTIME,
  type RoomApp,
  type RoomArgs,
  type RoomSim,
  readClient,
  readRejection,
  readServer,
} from '@pkgs/room-sim';
import { defineSystem } from '@pkgs/sim';

const denyEveApp: RoomApp = {
  ...authzApp,
  authorize: async (identity) => {
    if (identity === 'eve') {
      return { ok: false, reason: 'banned' };
    }
    return { ok: true };
  },
};

const denyEveSystem = defineSystem<RoomSim, RoomArgs>({
  name: 'room.authz-deny-eve',
  args: ROOM_ARGS,
  sample: ROOM_DRAW,
  create: (session, args) => bootRoomSim(session, denyEveApp, args),
  runtimes: [ROOM_VIRTUAL_RUNTIME],
});

describe('room sim: authorize reject (E-D03)', () => {
  test('authorize hook denies without mutating', async () => {
    await using s = await denyEveSystem.run({ seed: 42 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'eve' });
    await expectInSync(s);

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
    expect(await s.read(logSeq)).toBe(1);
    expect(authzCount(await readServer(s))).toBe(0);
    expect(authzCount(await readClient(s, 'alice'))).toBe(0);
  });
});
