/**
 * `specs/rooms/shared-counter.qnt` against the counter room: each model action through the
 * room harness actions on Alice's or Bob's device, and the model's state read
 * back from the room, each running device, and each device's state.
 */

import { asKeyword } from '@pkgs/keyword';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import type { RoomState } from '@pkgs/room';
import {
  addClient,
  clock,
  commandWire,
  connect,
  counterSystem,
  counterValue,
  crash,
  Decrement,
  disconnect,
  dispatch,
  expectInSync,
  Increment,
  injectToServer,
  pauseNetwork,
  type RoomHarness,
  readServer,
  restart,
  resumeNetwork,
  serverCrash,
  serverRestart,
  takeOver,
} from '@pkgs/room-harness';
import { type RoomTraceWorld, roomFingerprint, traceRoom } from './world';

const PEOPLE = ['alice', 'bob'] as const;

function person(picks: Picks): string {
  return String(picks['person']);
}

function deviceStateOf(s: RoomHarness, id: string): QuintValue {
  const device = s.kit.clients.get(id);
  if (device === undefined || device.isCrashed()) return variant('Crashed');
  if (s.kit.net(id).state() === 'hold') return variant('Stalled');
  return variant(device.isConnected() ? 'Online' : 'Offline');
}

function observed(s: RoomHarness): {
  readonly shownCount: Map<string, number>;
  readonly deviceState: Map<string, QuintValue>;
} {
  const shownCount = new Map<string, number>();
  const deviceState = new Map<string, QuintValue>();
  for (const id of PEOPLE) {
    deviceState.set(id, deviceStateOf(s, id));
    const device = s.kit.clients.get(id);
    if (device !== undefined && !device.isCrashed()) {
      shownCount.set(id, counterValue(device.snapshot() as RoomState));
    }
  }
  return { shownCount, deviceState };
}

async function send(
  w: RoomTraceWorld,
  id: string,
  raw: unknown
): Promise<void> {
  await traceRoom(w).apply(injectToServer, { clientId: id, raw, direct: true });
}

bindQuintModel<RoomTraceWorld>({
  model: 'shared-counter',
  traces: 24,
  maxSteps: 14,
  actions: {
    init: async (w) => {
      w.patient = true;
      w.harness = await counterSystem.run({ seed: w.ctx.testId });
      for (const id of PEOPLE) {
        await w.harness.apply(addClient, { id, identity: id });
      }
      await expectInSync(w.harness);
    },
    increment: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: person(picks),
        payload: Increment({}),
      });
    },
    decrement: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: person(picks),
        payload: Decrement({}),
      });
    },
    goOffline: async (w, picks) => {
      await traceRoom(w).apply(disconnect, person(picks));
    },
    reconnect: async (w, picks) => {
      await traceRoom(w).apply(connect, person(picks));
    },
    networkStalls: async (w, picks) => {
      await traceRoom(w).apply(pauseNetwork, person(picks));
    },
    networkRecovers: async (w, picks) => {
      await traceRoom(w).apply(resumeNetwork, person(picks));
    },
    appCrashes: async (w, picks) => {
      await traceRoom(w).apply(crash, person(picks));
    },
    appRestarts: async (w, picks) => {
      await traceRoom(w).apply(restart, person(picks));
    },
    roomRestarts: async (w) => {
      await traceRoom(w).apply(serverCrash);
      await traceRoom(w).apply(serverRestart);
    },
    resend: async (w, picks) => {
      const ts = await traceRoom(w).read(clock);
      await send(
        w,
        person(picks),
        commandWire({ id: String(picks['change']), ts, payload: Increment({}) })
      );
    },
    takeOver: async (w, picks) => {
      await traceRoom(w).apply(takeOver, person(picks));
    },
    makeInvalidChange: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: person(picks),
        payload: { type: asKeyword('space-counter-cmd/nope'), payload: {} },
      });
    },
    sendGarbledChange: async (w, picks) => {
      const ts = await traceRoom(w).read(clock);
      await send(w, person(picks), {
        v: 1,
        kind: 'command',
        id: 'malformed',
        ts,
        payload: { not: 'a-message' },
      });
    },
  },
  observe: async (w) => {
    const s = traceRoom(w);
    const roomCount = counterValue(await readServer(s));
    return { roomCount, ...(await s.read(observed)) };
  },
  fingerprint: roomFingerprint,
});
