import { expect, test } from 'bun:test';
import {
  NoteActivity,
  SpaceActivityAttr,
  spaceActivityCommandRouter,
} from '@libs/spaces-shared-ts/space-activity';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';

test('resending activity preserves its original time instead of waking a quiet device', () => {
  // regression: space-activity-resend-wakes-idle-device
  const answer = spaceActivityCommandRouter.dispatch(
    {},
    {
      identity: 'alice',
      ts: 120000,
      commandId: 'activity',
      random: () => 0.5,
      authority: true,
    },
    NoteActivity({ clientId: 'alice-phone', at: 1000 }),
    () => ({
      ok: false,
      error: { type: ROOM_ERROR_TYPE.invalidCommand, reason: 'unhandled' },
    })
  );
  expect(answer).toMatchObject({
    ok: true,
    events: [{ payload: { clientId: 'alice-phone', at: 1000 } }],
  });
  const old = SpaceActivityAttr.activity({ 'alice-phone': 2000 });
  const stale = spaceActivityCommandRouter.dispatch(
    old,
    {
      identity: 'alice',
      ts: 120000,
      commandId: 'older',
      random: () => 0.5,
      authority: true,
    },
    NoteActivity({ clientId: 'alice-phone', at: 1000 }),
    () => ({
      ok: false,
      error: { type: ROOM_ERROR_TYPE.invalidCommand, reason: 'unhandled' },
    })
  );
  expect(stale).toMatchObject({
    ok: false,
    error: { reason: 'activity unchanged' },
  });
});
