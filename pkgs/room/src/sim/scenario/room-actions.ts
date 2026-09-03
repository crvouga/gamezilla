import { type Action, defineSurface, draw, observe } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import fc from 'fast-check';
import type { RoomCrashEvent } from '../boundary-faults';
import type { RoomNetSetArg } from '../network';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { DomainOp } from './actions';
import type { RoomApp } from './app';
import { MILD_NET_FAULTS } from './library-arbs';
import {
  caps,
  clientIds,
  connected,
  crashedIds,
  downClients,
  heldClients,
  partitioned,
  serverCrashed,
} from './observations';
import { prepareClientsForConverge } from './play';
import type { RoomSurface } from './surface';

const { defineAction } = defineSurface<RoomSurface>();

type AddClientSpec = {
  readonly id: string;
  readonly identity?: string;
  readonly clientId?: string;
};

function pickId(ids: readonly string[]) {
  return draw(gen(fc.constantFrom(...(ids as [string, ...string[]]))));
}

async function drainAct(
  s: RoomSurface,
  fn: () => unknown | Promise<unknown>
): Promise<void> {
  await fn();
  await s.kit.drain();
}

/** Random pool member — picks a live client id then delegates. */
function randomClientAction(
  name: string,
  scripted: Action<RoomSurface, [string]>,
  idsObs: typeof clientIds | typeof connected | typeof crashedIds = clientIds
): Action<RoomSurface, []> {
  return defineAction({
    name,
    *generate() {
      const ids = yield* idsObs;
      if (ids.length === 0) return;
      const id = yield* pickId(ids);
      yield* scripted(id);
    },
  });
}

export const addClient = defineAction({
  name: 'addClient',
  generate(spec: AddClientSpec) {
    return async (s) => {
      if (s.kit.clients.has(spec.id)) return;
      await s.kit.addClient(spec);
      await s.kit.drain();
    };
  },
});

export const dispatch = defineAction({
  name: 'dispatch',
  generate(spec: { readonly clientId: string; readonly payload: unknown }) {
    return async (s) => {
      const c = s.kit.clients.get(spec.clientId);
      if (c === undefined || spec.payload == null) return;
      c.dispatch(spec.payload as never);
      await s.kit.drain();
    };
  },
});

/** Scripted domain op — `run.apply(domain, { kind: 'domain', clientId, … })`. */
export const domain = defineAction({
  name: 'domain',
  generate(op: DomainOp) {
    return async (s) => {
      const c = s.kit.clients.get(op.clientId);
      if (c === undefined) return;
      c.dispatch(s.app.toPayload(op));
      await s.kit.drain();
    };
  },
});

/** Random pool domain action — draws from the app's domainOpArbs. */
export function domainAction(app: RoomApp): Action<RoomSurface, []> {
  return defineAction({
    name: 'domain',
    *generate() {
      const ids = yield* connected;
      if (ids.length === 0) return;
      const arbs = app.domainOpArbs({ clientIds: ids });
      if (arbs.length === 0) return;
      const op = yield* draw(gen(fc.oneof(...arbs)));
      yield* domain(op);
    },
  });
}

export const hold = defineAction({
  name: 'hold',
  generate(id: string) {
    return (s) => drainAct(s, () => s.kit.net(id).set('hold'));
  },
});

export const release = defineAction({
  name: 'release',
  generate(id: string) {
    return (s) => drainAct(s, () => s.kit.net(id).set('ok'));
  },
});

export const down = defineAction({
  name: 'down',
  generate(id: string) {
    return (s) => drainAct(s, () => s.kit.net(id).set('down'));
  },
});

export const disconnect = defineAction({
  name: 'disconnect',
  generate(id: string) {
    return async (s) => {
      await s.kit.clients.get(id)?.disconnect();
      await s.kit.drain();
    };
  },
});

export const connect = defineAction({
  name: 'connect',
  generate(id: string) {
    return async (s) => {
      await s.kit.clients.get(id)?.connect();
      await s.kit.drain();
    };
  },
});

export const takeOver = defineAction({
  name: 'takeOver',
  generate(id: string) {
    return async (s) => {
      await s.kit.node(id).takeOver();
      await s.kit.drain();
    };
  },
});

export const crash = defineAction({
  name: 'crash',
  generate(id: string) {
    return (s) => drainAct(s, () => s.kit.node(id).crash());
  },
});

export const restart = defineAction({
  name: 'restart',
  generate(id: string) {
    return async (s) => {
      const c = s.kit.clients.get(id);
      if (c !== undefined && !c.isCrashed()) await s.kit.node(id).crash();
      await s.kit.node(id).restart();
      await s.kit.drain();
    };
  },
});

export const clearLocalData = defineAction({
  name: 'clearLocalData',
  generate(id: string) {
    return async (s) => {
      await s.kit.node(id).clearLocalData();
      await s.kit.drain();
    };
  },
});

export const setFaults = defineAction({
  name: 'setFaults',
  generate(id: string) {
    return (s) => drainAct(s, () => s.kit.net(id).set(MILD_NET_FAULTS));
  },
});

export const asymmetricLink = defineAction({
  name: 'asymmetricLink',
  generate(id: string) {
    return (s) =>
      drainAct(s, () => s.kit.net(id).set({ toClient: 'hold', toServer: 'ok' }));
  },
});

export const randomHold = randomClientAction('hold', hold);
export const randomRelease = randomClientAction('release', release);
export const randomDown = randomClientAction('down', down);
export const randomDisconnect = randomClientAction('disconnect', disconnect);
export const randomConnect = randomClientAction('connect', connect);
export const randomTakeOver = randomClientAction('takeOver', takeOver);
export const randomRestart = randomClientAction('restart', restart);
export const randomClearLocalData = randomClientAction(
  'clearLocalData',
  clearLocalData
);
export const randomSetFaults = randomClientAction('setFaults', setFaults);
export const randomAsymmetricLink = randomClientAction(
  'asymmetricLink',
  asymmetricLink
);

export const randomCrash = defineAction({
  name: 'crash',
  *generate() {
    const crashed = new Set(yield* crashedIds);
    const ids = (yield* clientIds).filter((id) => !crashed.has(id));
    if (ids.length === 0) return;
    const id = yield* pickId(ids);
    yield* crash(id);
  },
});

export const serverCrash = defineAction({
  name: 'serverCrash',
  *generate() {
    if (yield* serverCrashed) return;
    yield { weight: 1, act: (s: RoomSurface) => s.kit.serverCrash() };
  },
});

export const serverRestart = defineAction({
  name: 'serverRestart',
  *generate() {
    if (!(yield* serverCrashed)) return;
    yield {
      weight: 1,
      act: (s: RoomSurface) => drainAct(s, () => s.kit.serverRestart()),
    };
  },
});

export const partition = defineAction({
  name: 'partition',
  generate(id: string) {
    return (s) => {
      s.session.network.partition(
        ROOM_SERVER_ENDPOINT,
        roomClientEndpoint(id)
      );
    };
  },
});

export const randomPartition = defineAction({
  name: 'partition',
  *generate() {
    const o = yield* observe({ caps, clientIds, cut: partitioned });
    if (!o.caps.includes('partition') || o.clientIds.length === 0) return;
    const id = yield* pickId(o.clientIds);
    yield {
      weight: o.cut.length === 0 ? 2 : 1,
      act: (s: RoomSurface) => {
        s.session.network.partition(
          ROOM_SERVER_ENDPOINT,
          roomClientEndpoint(id)
        );
      },
    };
  },
});

export const heal = defineAction({
  name: 'heal',
  *generate() {
    const o = yield* observe({
      caps,
      cut: partitioned,
      held: heldClients,
      down: downClients,
    });
    const n = o.cut.length + o.held.length + o.down.length;
    yield {
      weight: Math.max(1, n),
      act: async (s: RoomSurface) => {
        if (o.caps.includes('partition')) s.session.network.healAll();
        for (const id of s.kit.clients.keys()) s.kit.net(id).set('ok');
      },
    };
  },
});

/** Scripted — `run.apply(passTime, 500)`. */
export const passTime = defineAction({
  name: 'passTime',
  generate(ms: number) {
    return (s) => s.kit.runFor(ms);
  },
});

/** Random pool member — draws ms then delegates to typed {@link passTime}. */
export const randomPassTime = defineAction({
  name: 'passTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => 1 + Math.floor(rng.next() * 40));
    yield* passTime(ms);
  },
});

export const revive = defineAction({
  name: 'revive',
  generate() {
    return async (s) => {
      await prepareClientsForConverge(s.kit);
      await s.kit.revive();
    };
  },
});

export const clearFaults = defineAction({
  name: 'clearFaults',
  generate() {
    return (s) => s.kit.clearBoundaryFaults();
  },
});

export const armCrashAt = defineAction({
  name: 'armCrashAt',
  generate(spec: {
    readonly clientId: string;
    readonly event: RoomCrashEvent;
  }) {
    return (s) => {
      s.kit.armCrashAt(spec.clientId, spec.event);
    };
  },
});

export const injectToServer = defineAction({
  name: 'injectToServer',
  generate(spec: {
    readonly clientId: string;
    readonly raw: unknown;
    readonly direct?: boolean;
  }) {
    return async (s) => {
      s.kit.clients.get(spec.clientId)?.injectToServer(spec.raw, {
        ...(spec.direct === true ? { direct: true } : {}),
      });
      await s.kit.drain();
    };
  },
});

export const injectFromServer = defineAction({
  name: 'injectFromServer',
  generate(spec: { readonly clientId: string; readonly raw: unknown }) {
    return async (s) => {
      s.kit.clients.get(spec.clientId)?.injectFromServer(spec.raw);
      await s.kit.drain();
    };
  },
});

export const setNet = defineAction({
  name: 'setNet',
  generate(spec: {
    readonly clientId: string;
    readonly next: RoomNetSetArg;
  }) {
    return (s) => {
      s.kit.net(spec.clientId).set(spec.next);
    };
  },
});

export const addSpectator = defineAction({
  name: 'addSpectator',
  generate() {
    return async (s) => {
      if (s.kit.clients.has('spec0')) return;
      await s.kit.addClient({
        id: 'spec0',
        identity: 'spectator',
        clientId: 'spec-tab',
      });
      await s.kit.drain();
    };
  },
});

/** Zero-arg walk / check pool — scripted variants live beside these. */
export const LIBRARY_ACTIONS: readonly Action<RoomSurface, []>[] = [
  randomHold,
  randomRelease,
  randomDown,
  heal,
  randomPassTime,
  randomPartition,
  randomCrash,
  randomRestart,
  randomDisconnect,
  randomConnect,
  randomTakeOver,
  serverCrash,
  serverRestart,
  randomSetFaults,
  randomAsymmetricLink,
  addSpectator,
  randomClearLocalData,
];

export function roomActions(app: RoomApp): Action<RoomSurface, []>[] {
  return [domainAction(app), ...LIBRARY_ACTIONS];
}

export const ROOM_ACTIONS = LIBRARY_ACTIONS;
