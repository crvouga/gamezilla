import { expect, test } from 'bun:test';
import {
  ROOM_ERROR_TYPE,
  ROOM_WIRE_KIND,
  type RoomCommandResult,
  WIRE_VERSION,
} from '@pkgs/room';
import { AddOne, TakeOne } from '@pkgs/room/harness';
import {
  committed,
  openClient,
  tallyEntry,
  welcome,
} from './helpers/client-rig';

// regression: room-overlapping-command-results
test('a refused choice and an overlapping accepted choice receive separate server results', async () => {
  const rig = await openClient();
  rig.transport.deliver(welcome([]));
  const results: RoomCommandResult[] = [];
  const unsubscribe = rig.room.subscribeCommandResult((result) =>
    results.push(result)
  );
  const refused = rig.room.dispatch(TakeOne({}));
  const accepted = rig.room.dispatch(AddOne({}));
  expect(refused).not.toBeNull();
  expect(accepted).not.toBeNull();
  if (refused === null || accepted === null)
    throw new Error('commands could not be dispatched');
  const error = {
    type: ROOM_ERROR_TYPE.unauthorized,
    reason: 'turned away',
  } as const;
  rig.transport.deliver({
    v: WIRE_VERSION,
    kind: ROOM_WIRE_KIND.rejected,
    commandId: refused,
    error,
  });
  rig.transport.deliver(
    committed([tallyEntry(1, 'alice', 1)], accepted ?? undefined)
  );
  expect(results).toEqual([
    { commandId: refused, ok: false, error },
    { commandId: accepted, ok: true },
  ]);
  unsubscribe();
  rig.transport.deliver(committed([], accepted ?? undefined));
  expect(results).toHaveLength(2);
  rig.room.destroy();
});
