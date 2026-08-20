import { describe, expect, test } from 'bun:test';
import { assertRoomModuleName, type RoomCommand } from '@pkgs/room';
import { createSimAdapters } from '@pkgs/uuid';

import type { GameDefinition } from './game';
import { SelectGame } from './games';
import {
  JoinSpaceSeat,
  spaceSeatMemberIds,
} from './space-members/space-members-messages';
import { createSpaceModule } from './space-module';
import { SPACE_ROOM_MODULE_NAME } from './space-room-module-name';

const chessStub: GameDefinition = {
  id: 'chess',
  commandRouters: [],
  eventRouters: [],
};

function runOnce(seed: number): { hash: string; seats: readonly string[] } {
  const adapters = createSimAdapters({ seed, startMs: 10_000 });
  const module = createSpaceModule(
    assertRoomModuleName(SPACE_ROOM_MODULE_NAME),
    [chessStub],
    adapters.clock.now
  );
  let state = module.initialState();

  const join = (memberId: string) => {
    const res = module.handle(
      state,
      {
        id: adapters.createId(),
        ts: adapters.clock.now(),
        payload: JoinSpaceSeat({ memberId }),
      } satisfies RoomCommand,
      memberId
    );
    if (!res.ok) throw new Error(JSON.stringify(res.error));
    for (const ev of res.events) {
      state = module.reduce(state, ev as never);
    }
  };

  join('member-b');
  join('member-a');

  const select = module.handle(
    state,
    {
      id: adapters.createId(),
      ts: adapters.clock.now(),
      payload: SelectGame({ game: 'chess' }),
    } satisfies RoomCommand,
    'member-a'
  );
  if (!select.ok) throw new Error(JSON.stringify(select.error));
  for (const ev of select.events) {
    state = module.reduce(state, ev as never);
  }

  return {
    hash: module.hash(state),
    seats: spaceSeatMemberIds(state),
  };
}

describe('space module sim determinism', () => {
  test('same seed yields identical state hash twice', () => {
    const seed = Number(process.env['SIM_SEED'] ?? '42');
    const a = runOnce(seed);
    const b = runOnce(seed);
    expect(a.hash).toBe(b.hash);
    expect(a.seats).toEqual(['member-a', 'member-b']);
    expect(b.seats).toEqual(['member-a', 'member-b']);
  });
});
