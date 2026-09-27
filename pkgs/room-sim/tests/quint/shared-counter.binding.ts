/**
 * `specs/rooms/shared-counter.qnt` against the counter room: each model action through the
 * room sim actions on Alice's or Bob's device, and the model's state read
 * back from the room, each running device, and each device's link.
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
  type RoomSim,
  readServer,
  restart,
  resumeNetwork,
  serverCrash,
  serverRestart,
  takeOver,
} from '@pkgs/room-sim';
import { type RoomTraceWorld, traceRoom } from './world';

const PEOPLE = ['alice', 'bob'] as const;

function person(picks: Picks): string {
  return String(picks['person']);
}

function link(s: RoomSim, id: string): QuintValue {
  const device = s.kit.clients.get(id);
  if (device === undefined || device.isCrashed()) return variant('Crashed');
  if (s.kit.net(id).state() === 'hold') return variant('Paused');
  return variant(device.isConnected() ? 'Online' : 'Offline');
}

function observed(s: RoomSim): {
  readonly views: Map<string, number>;
  readonly links: Map<string, QuintValue>;
} {
  const views = new Map<string, number>();
  const links = new Map<string, QuintValue>();
  for (const id of PEOPLE) {
    links.set(id, link(s, id));
    const device = s.kit.clients.get(id);
    if (device !== undefined && !device.isCrashed()) {
      views.set(id, counterValue(device.snapshot() as RoomState));
    }
  }
  return { views, links };
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
      w.sim = await counterSystem.run({ seed: w.ctx.testId });
      for (const id of PEOPLE) {
        await w.sim.apply(addClient, { id, identity: id });
      }
      await expectInSync(w.sim);
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
    disconnect: async (w, picks) => {
      await traceRoom(w).apply(disconnect, person(picks));
    },
    connect: async (w, picks) => {
      await traceRoom(w).apply(connect, person(picks));
    },
    pauseNetwork: async (w, picks) => {
      await traceRoom(w).apply(pauseNetwork, person(picks));
    },
    resumeNetwork: async (w, picks) => {
      await traceRoom(w).apply(resumeNetwork, person(picks));
    },
    crash: async (w, picks) => {
      await traceRoom(w).apply(crash, person(picks));
    },
    restart: async (w, picks) => {
      await traceRoom(w).apply(restart, person(picks));
    },
    roomRestarts: async (w) => {
      await traceRoom(w).apply(serverCrash);
      await traceRoom(w).apply(serverRestart);
    },
    sendCommand: async (w, picks) => {
      const ts = await traceRoom(w).read(clock);
      await send(
        w,
        person(picks),
        commandWire({ id: String(picks['id']), ts, payload: Increment({}) })
      );
    },
    takeOver: async (w, picks) => {
      await traceRoom(w).apply(takeOver, person(picks));
    },
    sendUnknownCommand: async (w, picks) => {
      await traceRoom(w).apply(dispatch, {
        clientId: person(picks),
        payload: { type: asKeyword('space-counter-cmd/nope'), payload: {} },
      });
    },
    sendMalformedFrame: async (w, picks) => {
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
    const room = counterValue(await readServer(s));
    return { room, ...(await s.read(observed)) };
  },
});
