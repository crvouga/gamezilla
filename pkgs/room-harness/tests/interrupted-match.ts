import type { Run } from '@pkgs/harness-shared/run-types';
import {
  holdRoomChanges,
  pendingRoomChangeIds,
  stopAsRoomChangeCounts,
} from '@pkgs/room-harness/commit-recovery';
import type { RoomHarness } from '@pkgs/room-harness/harness';
import { dispatch } from '@pkgs/room-harness/room-actions';
import type { RoomCommandPayload } from '@pkgs/room-shared/types';

/** Queue the real choice, then stop after persistence and before confirmation. */
export async function interruptedMatchChoice(
  s: Run<RoomHarness>,
  person: string,
  payload: RoomCommandPayload
): Promise<void> {
  await s.apply(holdRoomChanges, ['white', 'black']);
  const before = new Set(await s.read(pendingRoomChangeIds, person));
  await s.apply(dispatch, { clientId: person, payload });
  const id = (await s.read(pendingRoomChangeIds, person)).find(
    (queued) => !before.has(queued)
  );
  if (id === undefined) throw new Error('The match choice did not queue');
  await s.apply(stopAsRoomChangeCounts, { person, id, payload });
}
