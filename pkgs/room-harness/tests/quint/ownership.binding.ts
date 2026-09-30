/**
 * `specs/room/ownership.qnt` against the example game room: Alice, Bob and
 * Eve each on their phone, claiming the room, turning each other away and
 * adding to the tally; the model's state read back from the room.
 */

import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import {
  AddOne,
  ClaimRoom,
  readOwner,
  readTally,
  readTurnedAway,
  TurnAway,
} from '@pkgs/room/harness';
import {
  addClient,
  dispatch,
  exampleSystem,
  expectInSync,
  readServer,
} from '@pkgs/room-harness';
import { type RoomTraceWorld, roomFingerprint, traceRoom } from './world';

const PEOPLE = ['alice', 'bob', 'eve'] as const;

function pick(picks: Picks, name: string): string {
  return String(picks[name]);
}

bindQuintModel<RoomTraceWorld>({
  model: 'ownership',
  traces: 16,
  maxSteps: 10,
  actions: {
    init: async (w) => {
      w.patient = true;
      w.harness = await exampleSystem.run({ seed: w.ctx.testId });
      for (const id of PEOPLE) {
        await w.harness.apply(addClient, { id, identity: id });
      }
      await expectInSync(w.harness);
    },
    claim: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: pick(picks, 'person'),
        payload: ClaimRoom({}),
      });
    },
    turnAway: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: pick(picks, 'person'),
        payload: TurnAway({ person: pick(picks, 'other') }),
      });
    },
    addOne: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: pick(picks, 'person'),
        payload: AddOne({}),
      });
    },
    _loseConnection: () => Promise.resolve(),
    _connectionReturns: () => Promise.resolve(),
  },
  observe: async (w) => {
    const room = await readServer(traceRoom(w));
    return {
      owner: readOwner(room) ?? '',
      turnedAway: new Set(readTurnedAway(room)),
      tally: readTally(room),
    };
  },
  fingerprint: roomFingerprint,
});
