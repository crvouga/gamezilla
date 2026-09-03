import { type Action, defineSurface } from '@pkgs/dst';
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

type ArmCrashAtSpec = {
  readonly clientId: string;
  readonly event: RoomCrashEvent;
};

function pickClientId(ids: readonly string[]) {
  return gen(fc.constantFrom(...(ids as [string, ...string[]])));
}

export const addClient = defineAction({
  name: 'addClient',
  act: async (s, spec: AddClientSpec) => {
    if (s.kit.clients.has(spec.id)) return;
    await s.kit.addClient(spec);
  },
});

export const dispatch = defineAction({
  name: 'dispatch',
  act: (s, spec: { readonly clientId: string; readonly payload: unknown }) => {
    const c = s.kit.clients.get(spec.clientId);
    if (c === undefined || spec.payload == null) return;
    c.dispatch(spec.payload as never);
  },
});

/** Scripted domain op — `run.apply(domain, { kind: 'domain', clientId, … })`. */
export const domain = defineAction({
  name: 'domain',
  act: (s, op: DomainOp) => {
    const c = s.kit.clients.get(op.clientId);
    if (c === undefined) return;
    c.dispatch(s.app.toPayload(op));
  },
});

/** Random pool domain action — draws from the app's domainOpArbs. */
export function domainAction(app: RoomApp): Action<RoomSurface, [DomainOp]> {
  return defineAction({
    name: 'domain',
    enabled: (s) => {
      const ids = connected(s);
      return ids.length > 0 && app.domainOpArbs({ clientIds: ids }).length > 0;
    },
    weight: 3,
    args: (s) => {
      const ids = connected(s);
      const arbs = app.domainOpArbs({ clientIds: ids });
      return gen(fc.oneof(...arbs));
    },
    act: (s, op: DomainOp) => {
      const c = s.kit.clients.get(op.clientId);
      if (c === undefined) return;
      c.dispatch(s.app.toPayload(op));
    },
  });
}

export const hold = defineAction({
  name: 'hold',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: (s, id: string) => {
    s.kit.net(id).set('hold');
  },
});

export const release = defineAction({
  name: 'release',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: (s, id: string) => {
    s.kit.net(id).set('ok');
  },
});

export const down = defineAction({
  name: 'down',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: (s, id: string) => {
    s.kit.net(id).set('down');
  },
});

export const disconnect = defineAction({
  name: 'disconnect',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: async (s, id: string) => {
    await s.kit.clients.get(id)?.disconnect();
  },
});

export const connect = defineAction({
  name: 'connect',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: async (s, id: string) => {
    await s.kit.clients.get(id)?.connect();
  },
});

export const takeOver = defineAction({
  name: 'takeOver',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: async (s, id: string) => {
    await s.kit.node(id).takeOver();
  },
});

export const crash = defineAction({
  name: 'crash',
  enabled: (s) => {
    const crashed = new Set(crashedIds(s));
    return clientIds(s).some((id) => !crashed.has(id));
  },
  args: (s) => {
    const crashed = new Set(crashedIds(s));
    return pickClientId(clientIds(s).filter((id) => !crashed.has(id)));
  },
  act: async (s, id: string) => {
    await s.kit.node(id).crash();
  },
});

export const restart = defineAction({
  name: 'restart',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: async (s, id: string) => {
    const c = s.kit.clients.get(id);
    if (c !== undefined && !c.isCrashed()) await s.kit.node(id).crash();
    await s.kit.node(id).restart();
  },
});

export const clearLocalData = defineAction({
  name: 'clearLocalData',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: async (s, id: string) => {
    await s.kit.node(id).clearLocalData();
  },
});

export const setFaults = defineAction({
  name: 'setFaults',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: (s, id: string) => {
    s.kit.net(id).set(MILD_NET_FAULTS);
  },
});

export const asymmetricLink = defineAction({
  name: 'asymmetricLink',
  enabled: (s) => clientIds(s).length > 0,
  args: (s) => pickClientId(clientIds(s)),
  act: (s, id: string) => {
    s.kit.net(id).set({ toClient: 'hold', toServer: 'ok' });
  },
});

export const serverCrash = defineAction({
  name: 'serverCrash',
  enabled: (s) => !serverCrashed(s),
  act: async (s) => {
    await s.kit.serverCrash();
  },
});

export const serverRestart = defineAction({
  name: 'serverRestart',
  enabled: (s) => serverCrashed(s),
  act: async (s) => {
    await s.kit.serverRestart();
  },
});

export const partition = defineAction({
  name: 'partition',
  enabled: (s) => caps(s).includes('partition') && clientIds(s).length > 0,
  weight: (s) => (partitioned(s).length === 0 ? 2 : 1),
  args: (s) => pickClientId(clientIds(s)),
  act: (s, id: string) => {
    s.session.network.partition(ROOM_SERVER_ENDPOINT, roomClientEndpoint(id));
  },
});

export const heal = defineAction({
  name: 'heal',
  weight: (s) =>
    Math.max(
      1,
      partitioned(s).length + heldClients(s).length + downClients(s).length
    ),
  act: (s) => {
    if (caps(s).includes('partition')) s.session.network.healAll();
    for (const id of s.kit.clients.keys()) s.kit.net(id).set('ok');
  },
});

export const revive = defineAction({
  name: 'revive',
  act: async (s) => {
    await prepareClientsForConverge(s.kit);
    await s.kit.revive();
  },
});

export const clearFaults = defineAction({
  name: 'clearFaults',
  act: (s) => {
    s.kit.clearBoundaryFaults();
  },
});

export const armCrashAt = defineAction({
  name: 'armCrashAt',
  act: (s, spec: ArmCrashAtSpec) => {
    s.kit.armCrashAt(spec.clientId, spec.event);
  },
});

export const injectToServer = defineAction({
  name: 'injectToServer',
  act: async (
    s,
    spec: {
      readonly clientId: string;
      readonly raw: unknown;
      readonly direct?: boolean;
    }
  ) => {
    s.kit.clients.get(spec.clientId)?.injectToServer(spec.raw, {
      ...(spec.direct === true ? { direct: true } : {}),
    });
  },
});

export const injectFromServer = defineAction({
  name: 'injectFromServer',
  act: (s, spec: { readonly clientId: string; readonly raw: unknown }) => {
    s.kit.clients.get(spec.clientId)?.injectFromServer(spec.raw);
  },
});

export const setNet = defineAction({
  name: 'setNet',
  act: (
    s,
    spec: { readonly clientId: string; readonly next: RoomNetSetArg }
  ) => {
    s.kit.net(spec.clientId).set(spec.next);
  },
});

export const addSpectator = defineAction({
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

/** Walk / explore pool — scripted variants take explicit args via `run.apply`. */
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

export function roomActions(app: RoomApp) {
  return [domainAction(app), ...LIBRARY_ACTIONS];
}

export const ROOM_ACTIONS = LIBRARY_ACTIONS;
