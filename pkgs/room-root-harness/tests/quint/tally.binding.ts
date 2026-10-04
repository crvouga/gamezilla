/**
 * `specs/room/tally.qnt` against the example game room: each model action
 * through the room harness on Alice's or Bob's phone, and the model's state
 * read back from the room, each open app, and each phone. The model's
 * `_`-prefixed faults are the harness's fault injections.
 */

import { asKeyword } from '@pkgs/keyword-shared/keyword';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { expectInSync } from '@pkgs/room-root-harness/expect-in-sync';
import { AddOne, readTally, TakeOne } from '@pkgs/room-root-harness/game-room';
import type { RoomHarness } from '@pkgs/room-root-harness/harness';
import { clock } from '@pkgs/room-root-harness/observations';
import { readServer } from '@pkgs/room-root-harness/read-state';
import {
  addClient,
  armCrashAt,
  connect,
  crash,
  disconnect,
  dispatch,
  injectToServer,
  pauseNetwork,
  restart,
  resumeNetwork,
  serverCrash,
  serverRestart,
  takeOver,
} from '@pkgs/room-root-harness/room-actions';
import { exampleSystem } from '@pkgs/room-root-harness/system';
import { commandWire } from '@pkgs/room-root-harness/wire-helpers';
import type { RoomTraceWorld } from './world';
import { roomFingerprint, traceRoom } from './world';

const PEOPLE = ['alice', 'bob'] as const;

function person(picks: Picks): string {
  return String(picks['person']);
}

function phoneStateOf(s: RoomHarness, id: string): QuintValue {
  const phone = s.kit.clients.get(id);
  if (phone === undefined || phone.isCrashed()) return variant('AppClosed');
  return variant(phone.isConnected() ? 'Online' : 'Offline');
}

function observed(s: RoomHarness): {
  readonly shownTally: Map<string, number>;
  readonly phoneState: Map<string, QuintValue>;
} {
  const shownTally = new Map<string, number>();
  const phoneState = new Map<string, QuintValue>();
  for (const id of PEOPLE) {
    phoneState.set(id, phoneStateOf(s, id));
    const phone = s.kit.clients.get(id);
    if (phone !== undefined && !phone.isCrashed()) {
      shownTally.set(id, readTally(phone.snapshot()));
    }
  }
  return { shownTally, phoneState };
}

async function send(
  w: RoomTraceWorld,
  id: string,
  raw: unknown
): Promise<void> {
  await traceRoom(w).apply(injectToServer, { clientId: id, raw, direct: true });
}

bindQuintModel<RoomTraceWorld>({
  model: 'tally',
  traces: 24,
  maxSteps: 14,
  actions: {
    init: async (w) => {
      w.patient = true;
      w.harness = await exampleSystem.run({ seed: w.ctx.testId });
      for (const id of PEOPLE) {
        await w.harness.apply(addClient, { id, identity: id });
      }
      await expectInSync(w.harness);
    },
    addOne: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: person(picks),
        payload: AddOne({}),
      });
    },
    takeOne: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: person(picks),
        payload: TakeOne({}),
      });
    },
    goOffline: async (w, picks) => {
      await traceRoom(w).apply(disconnect, person(picks));
    },
    comeBackOnline: async (w, picks) => {
      await traceRoom(w).apply(connect, person(picks));
    },
    closeUnexpectedly: async (w, picks) => {
      await traceRoom(w).apply(crash, person(picks));
    },
    reopenApp: async (w, picks) => {
      await traceRoom(w).apply(restart, person(picks));
    },
    _networkStalls: async (w, picks) => {
      await traceRoom(w).apply(pauseNetwork, person(picks));
    },
    _networkRecovers: async (w, picks) => {
      await traceRoom(w).apply(resumeNetwork, person(picks));
    },
    _roomRestarts: async (w) => {
      await traceRoom(w).apply(serverCrash);
      await traceRoom(w).apply(serverRestart);
    },
    _resend: async (w, picks) => {
      const ts = await traceRoom(w).read(clock);
      await send(
        w,
        person(picks),
        commandWire({ id: String(picks['change']), ts, payload: AddOne({}) })
      );
    },
    _takeOver: async (w, picks) => {
      await traceRoom(w).apply(takeOver, person(picks));
    },
    _makeInvalidChange: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: person(picks),
        payload: { type: asKeyword('game-room-cmd/nope'), payload: {} },
      });
    },
    _sendGarbledChange: async (w, picks) => {
      const ts = await traceRoom(w).read(clock);
      await send(w, person(picks), {
        v: 1,
        kind: 'command',
        id: 'malformed',
        ts,
        payload: { not: 'a-message' },
      });
    },
    _appClosesAsChangeLands: async (w, picks) => {
      const id = person(picks);
      await traceRoom(w).apply(armCrashAt, {
        clientId: id,
        event: 'afterNextCommitted' as const,
      });
      await traceRoom(w).apply(dispatch, { clientId: id, payload: AddOne({}) });
    },
  },
  observe: async (w) => {
    const s = traceRoom(w);
    const tally = readTally(await readServer(s));
    return { tally, ...(await s.read(observed)) };
  },
  fingerprint: roomFingerprint,
});
