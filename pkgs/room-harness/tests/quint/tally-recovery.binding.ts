import { bindQuintModel } from '@pkgs/quint-shared/registry';
import type { Picks } from '@pkgs/quint-shared/registry';
import { AddOne, readTally, TakeOne } from '@pkgs/room-harness/game-room';
import { addClient, connect, disconnect, dispatch, serverCrash, serverRestart } from '@pkgs/room-harness/room-actions';
import { deliverQueuedRoomChange, hearRoomChangeCounted, holdRoomChanges, pendingRoomChangeIds, roomChangeReceipts, stopAsRoomChangeCounts } from '@pkgs/room-harness/commit-recovery';
import { exampleSystem } from '@pkgs/room-harness/system';
import { expectInSync } from '@pkgs/room-harness/expect-in-sync';
import type { QueuedRoomChange } from '@pkgs/room-harness/commit-recovery';
import { readServer } from '@pkgs/room-harness/read-state';
import { serverCrashed } from '@pkgs/room-harness/observations';
import type { RoomTraceWorld } from './world';
import { roomFingerprint, traceRoom } from './world';

const PEOPLE = ['alice', 'bob'] as const;
const requests = new WeakMap<RoomTraceWorld, Map<string, QueuedRoomChange>>();
const apart = new WeakMap<RoomTraceWorld, Set<string>>();

function request(w: RoomTraceWorld, picks: Picks): QueuedRoomChange {
  const change = requests.get(w)?.get(String(picks['change']));
  if (change === undefined) throw new Error('Missing actual queued change');
  return change;
}

async function queue(
  w: RoomTraceWorld,
  picks: Picks,
  by: 1 | -1
): Promise<void> {
  const s = traceRoom(w);
  const person = String(picks['person']);
  const before = new Set(await s.read(pendingRoomChangeIds, person));
  const payload = by === 1 ? AddOne({}) : TakeOne({});
  await s.apply(dispatch, { clientId: person, payload });
  const after = await s.read(pendingRoomChangeIds, person);
  const id = after.find((queuedId) => !before.has(queuedId));
  if (id === undefined) throw new Error('The chosen change did not queue');
  requests.get(w)!.set(String(picks['change']), { person, id, payload });
}

bindQuintModel<RoomTraceWorld>({
  model: 'tally-recovery',
  traces: 64,
  maxSteps: 32,
  actions: {
    init: async (w) => {
      w.patient = true;
      w.harness = await exampleSystem.run({ seed: w.ctx.testId });
      requests.set(w, new Map());
      apart.set(w, new Set());
      for (const person of PEOPLE)
        await traceRoom(w).apply(addClient, { id: person, identity: person });
      await expectInSync(traceRoom(w));
      await traceRoom(w).apply(holdRoomChanges, PEOPLE);
    },
    addOne: (w, picks) => queue(w, picks, 1),
    takeOne: (w, picks) => queue(w, picks, -1),
    _changeReachesRoom: (w, picks) =>
      traceRoom(w).apply(deliverQueuedRoomChange, request(w, picks)),
    _roomStopsAsChangeCounts: (w, picks) =>
      traceRoom(w).apply(stopAsRoomChangeCounts, request(w, picks)),
    _hearBack: (w, picks) =>
      traceRoom(w).apply(hearRoomChangeCounted, request(w, picks)),
    _roomStops: (w) => traceRoom(w).apply(serverCrash),
    _roomReturns: async (w) => {
      await traceRoom(w).apply(serverRestart);
      for (const person of apart.get(w)!)
        await traceRoom(w).apply(disconnect, person);
    },
    _loseConnection: async (w, picks) => {
      const person = String(picks['person']);
      apart.get(w)!.add(person);
      await traceRoom(w).apply(disconnect, person);
    },
    _connectionReturns: async (w, picks) => {
      const person = String(picks['person']);
      apart.get(w)!.delete(person);
      if (!(await traceRoom(w).read(serverCrashed)))
        await traceRoom(w).apply(connect, person);
    },
    _wait: (w) => traceRoom(w).advanceTime(1_000),
  },
  observe: async (w) => ({
    tally: readTally(await readServer(traceRoom(w))),
    ...(await traceRoom(w).read(
      roomChangeReceipts,
      Object.fromEntries(requests.get(w)!)
    )),
  }),
  fingerprint: roomFingerprint,
});
