/**
 * `specs/room/ownership.qnt` against the example game room: Alice, Bob and
 * Eve each on their phone, claiming the room, turning each other away and
 * adding to the tally; the model's state read back from the room.
 */

import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { expectInSync } from '@pkgs/room-harness/expect-in-sync';
import {
  AddOne,
  ClaimRoom,
  readOwner,
  readTally,
  readTurnedAway,
  TurnAway,
} from '@pkgs/room-harness/game-room';
import { readServer } from '@pkgs/room-harness/read-state';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
} from '@pkgs/room-harness/room-actions';
import { exampleSystem } from '@pkgs/room-harness/system';
import type { RoomTraceWorld } from './world';
import { roomFingerprint, traceRoom } from './world';

const PEOPLE = ['alice', 'bob', 'eve'] as const;

function pick(picks: Picks, name: string): string {
  return String(picks[name]);
}

bindQuintModel<RoomTraceWorld>({
  model: 'ownership',
  traces: 64,
  maxSteps: 24,
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
    _loseConnection: (w, picks) =>
      traceRoom(w).apply(disconnect, pick(picks, 'person')),
    _connectionReturns: async (w) => {
      for (const person of PEOPLE) await traceRoom(w).apply(connect, person);
    },
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
