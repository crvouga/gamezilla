import { type Action, defineAction } from '@pkgs/dst';
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

type AddClientSpec = {
  readonly id: string;
  readonly identity?: string;
  readonly clientId?: string;
};

type ArmCrashAtSpec = {
  readonly clientId: string;
  readonly event: RoomCrashEvent;
};

function pickClientId(ids: readonly string[]) {
  return gen(fc.constantFrom(...(ids as [string, ...string[]])));
}

export const addClient = defineAction<RoomSurface, [AddClientSpec]>({
  name: 'addClient',
  pool: false,
  act: async (s, spec) => {
    if (s.kit.clients.has(spec.id)) return;
    await s.kit.addClient(spec);
  },
});

export const dispatch = defineAction<
  RoomSurface,
  [{ readonly clientId: string; readonly payload: unknown }]
>({
  name: 'dispatch',
  pool: false,
  act: (s, spec) => {
    const c = s.kit.clients.get(spec.clientId);
    if (c === undefined || spec.payload == null) return;
    c.dispatch(spec.payload as never);
  },
});

/** Scripted domain op — `s.apply(domain, { kind: 'domain', clientId, … })`. */
export const domain = defineAction<RoomSurface, [DomainOp]>({
  name: 'domain',
  pool: false,
  act: (s, op) => {
    const c = s.kit.clients.get(op.clientId);
    if (c === undefined) return;
    c.dispatch(s.app.toPayload(op));
  },
});

/** Random pool domain action — draws from the app's domainOpArbs. */
export function domainAction(app: RoomApp): Action<RoomSurface, [DomainOp]> {
  return defineAction<RoomSurface, [DomainOp]>({
    name: 'domain',
    enabled: (s) => {
      const ids = connected(s);
      return ids.length > 0 && app.domainOpArbs({ clientIds: ids }).length > 0;
    },
    weight: 3,
    draw: (s) => {
      const ids = connected(s);
      const arbs = app.domainOpArbs({ clientIds: ids });
      return gen(fc.oneof(...arbs));
    },
    act: (s, op) => {
      const c = s.kit.clients.get(op.clientId);
      if (c === undefined) return;
      c.dispatch(s.app.toPayload(op));
    },
  });
}

export const hold = defineAction<RoomSurface, [string]>({
  name: 'hold',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.kit.net(id).set('hold');
  },
});

export const release = defineAction<RoomSurface, [string]>({
  name: 'release',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.kit.net(id).set('ok');
  },
});

export const down = defineAction<RoomSurface, [string]>({
  name: 'down',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.kit.net(id).set('down');
  },
});

export const disconnect = defineAction<RoomSurface, [string]>({
  name: 'disconnect',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.clients.get(id)?.disconnect();
  },
});

export const connect = defineAction<RoomSurface, [string]>({
  name: 'connect',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.clients.get(id)?.connect();
  },
});

export const takeOver = defineAction<RoomSurface, [string]>({
  name: 'takeOver',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.node(id).takeOver();
  },
});

export const crash = defineAction<RoomSurface, [string]>({
  name: 'crash',
  enabled: (s) => {
    const crashed = new Set(crashedIds(s));
    return clientIds(s).some((id) => !crashed.has(id));
  },
  draw: (s) => {
    const crashed = new Set(crashedIds(s));
    return pickClientId(clientIds(s).filter((id) => !crashed.has(id)));
  },
  act: async (s, id) => {
    await s.kit.node(id).crash();
  },
});

export const restart = defineAction<RoomSurface, [string]>({
  name: 'restart',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    const c = s.kit.clients.get(id);
    if (c !== undefined && !c.isCrashed()) await s.kit.node(id).crash();
    await s.kit.node(id).restart();
  },
});

export const clearLocalData = defineAction<RoomSurface, [string]>({
  name: 'clearLocalData',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.node(id).clearLocalData();
  },
});

export const setFaults = defineAction<RoomSurface, [string]>({
  name: 'setFaults',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.kit.net(id).set(MILD_NET_FAULTS);
  },
});

export const asymmetricLink = defineAction<RoomSurface, [string]>({
  name: 'asymmetricLink',
  enabled: (s) => clientIds(s).length > 0,
  draw: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.kit.net(id).set({ toClient: 'hold', toServer: 'ok' });
  },
});

export const serverCrash = defineAction<RoomSurface>({
  name: 'serverCrash',
  enabled: (s) => !serverCrashed(s),
  act: async (s) => {
    await s.kit.serverCrash();
  },
});

export const serverRestart = defineAction<RoomSurface>({
  name: 'serverRestart',
  enabled: (s) => serverCrashed(s),
  act: async (s) => {
    await s.kit.serverRestart();
  },
});

export const partition = defineAction<RoomSurface, [string]>({
  name: 'partition',
  enabled: (s) => caps(s).includes('partition') && clientIds(s).length > 0,
  weight: (s) => (partitioned(s).length === 0 ? 2 : 1),
  draw: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.session.network.partition(ROOM_SERVER_ENDPOINT, roomClientEndpoint(id));
  },
});

export const heal = defineAction<RoomSurface>({
  name: 'heal',
  weight: (s) =>
    Math.max(
      1,
      partitioned(s).length + heldClients(s).length + downClients(s).length
    ),
  act: async (s) => {
    if (caps(s).includes('partition')) s.session.network.healAll();
    await prepareClientsForConverge(s.kit);
    await s.kit.revive();
  },
});

export const revive = defineAction<RoomSurface>({
  name: 'revive',
  pool: false,
  act: async (s) => {
    await prepareClientsForConverge(s.kit);
    await s.kit.revive();
  },
});

export const clearFaults = defineAction<RoomSurface>({
  name: 'clearFaults',
  pool: false,
  act: (s) => {
    s.kit.clearBoundaryFaults();
  },
});

export const armCrashAt = defineAction<RoomSurface, [ArmCrashAtSpec]>({
  name: 'armCrashAt',
  pool: false,
  act: (s, spec) => {
    s.kit.armCrashAt(spec.clientId, spec.event);
  },
});

export const injectToServer = defineAction<
  RoomSurface,
  [
    {
      readonly clientId: string;
      readonly raw: unknown;
      readonly direct?: boolean;
    },
  ]
>({
  name: 'injectToServer',
  pool: false,
  act: (s, spec) => {
    s.kit.clients.get(spec.clientId)?.injectToServer(spec.raw, {
      ...(spec.direct === true ? { direct: true } : {}),
    });
  },
});

export const injectFromServer = defineAction<
  RoomSurface,
  [{ readonly clientId: string; readonly raw: unknown }]
>({
  name: 'injectFromServer',
  pool: false,
  act: (s, spec) => {
    s.kit.clients.get(spec.clientId)?.injectFromServer(spec.raw);
  },
});

export const setNet = defineAction<
  RoomSurface,
  [{ readonly clientId: string; readonly next: RoomNetSetArg }]
>({
  name: 'setNet',
  pool: false,
  act: (s, spec) => {
    s.kit.net(spec.clientId).set(spec.next);
  },
});

export const addSpectator = defineAction<RoomSurface>({
  name: 'addSpectator',
  enabled: (s) => !s.kit.clients.has('spec0'),
  act: async (s) => {
    if (s.kit.clients.has('spec0')) return;
    await s.kit.addClient({
      id: 'spec0',
      identity: 'spectator',
      clientId: 'spec-tab',
    });
  },
});

/** Walk / explore pool — one entry per randomly sampled library fault. */
export const LIBRARY_ACTIONS = [
  hold,
  release,
  down,
  heal,
  partition,
  crash,
  restart,
  disconnect,
  connect,
  takeOver,
  serverCrash,
  serverRestart,
  setFaults,
  asymmetricLink,
  addSpectator,
  clearLocalData,
] as const;

/**
 * Out-of-pool actions — they need careful sequencing, so scripted tests drive
 * them via `s.apply`. Registered so `replay` can still dispatch by name.
 */
export const SCRIPTED_ACTIONS = [
  addClient,
  dispatch,
  armCrashAt,
  injectToServer,
  injectFromServer,
  setNet,
  clearFaults,
  revive,
] as const;
