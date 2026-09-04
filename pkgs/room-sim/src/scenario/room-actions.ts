import { type Action, defineAction } from '@pkgs/sim';
import { gen } from '@pkgs/sim/fast-check';
import fc from 'fast-check';
import type { RoomCrashEvent } from '../edge-faults';
import { SIM_PBT_CRASH_EVENTS } from '../edge-faults';
import type { RoomFaultProfile, RoomNetSetArg } from '../network';
import { ROOM_SERVER_ENDPOINT, roomClientEndpoint } from '../network';
import type { DomainOp } from './actions';
import type { RoomApp } from './app';
import { NET_FAULT_PROFILES } from './faults';
import type { MalformedMessageInjectKind } from './malformed-messages';
import {
  buildMalformedMessageRaw,
  MALFORMED_MESSAGE_INJECT_KINDS,
} from './malformed-messages';
import {
  caps,
  clientIds,
  clock,
  connected,
  crashedIds,
  downClients,
  heldClients,
  linkUpClients,
  partitioned,
  releasableClients,
  serverCrashed,
} from './observations';
import { prepareClientsForInSync } from './play';
import type { RoomSim } from './sim';

type AddClientSpec = {
  readonly id: string;
  readonly identity?: string;
  readonly clientId?: string;
};

type ArmCrashAtSpec = {
  readonly clientId: string;
  readonly event: RoomCrashEvent;
};

type SetFaultsSpec = {
  readonly clientId: string;
  readonly faults: RoomFaultProfile;
};

type MalformedMessageSpec = {
  readonly clientId: string;
  readonly kind: MalformedMessageInjectKind;
};

function arbClientId(ids: readonly string[]) {
  return fc.constantFrom(...(ids as [string, ...string[]]));
}

function pickClientId(ids: readonly string[]) {
  return gen(arbClientId(ids));
}

export const addClient = defineAction<RoomSim, [AddClientSpec]>({
  name: 'addClient',
  pool: false,
  act: async (s, spec) => {
    if (s.kit.clients.has(spec.id)) return;
    await s.kit.addClient(spec);
  },
});

export const dispatch = defineAction<
  RoomSim,
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
export const domain = defineAction<RoomSim, [DomainOp]>({
  name: 'domain',
  pool: false,
  act: (s, op) => {
    const c = s.kit.clients.get(op.clientId);
    if (c === undefined) return;
    c.dispatch(s.app.toPayload(op));
  },
});

/** Random pool domain action — draws from the app's domainOpArbs. */
export function domainAction(app: RoomApp): Action<RoomSim, [DomainOp]> {
  return defineAction<RoomSim, [DomainOp]>({
    name: 'domain',
    enabled: (s) => {
      const ids = connected(s);
      return ids.length > 0 && app.domainOpArbs({ clientIds: ids }).length > 0;
    },
    weight: 3,
    sample: (s) => {
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

export const pauseNetwork = defineAction<RoomSim, [string]>({
  name: 'pauseNetwork',
  enabled: (s) => clientIds(s).length > 0,
  weight: (s) => (linkUpClients(s).length > 0 ? 1 : 0),
  sample: (s) => pickClientId(linkUpClients(s)),
  act: (s, id) => {
    s.kit.net(id).set('hold');
  },
});

/**
 * Restore a link to `ok`. Walks only release held / lossy links: the loopback
 * transport has no heartbeat, so a `down` link resyncs only through `restoreNetwork`
 * (recoverAll) — scripted pins that release a down link reconnect explicitly.
 */
export const resumeNetwork = defineAction<RoomSim, [string]>({
  name: 'resumeNetwork',
  enabled: (s) => clientIds(s).length > 0,
  weight: (s) => (releasableClients(s).length > 0 ? 1 : 0),
  sample: (s) => pickClientId(releasableClients(s)),
  act: (s, id) => {
    s.kit.net(id).set('ok');
  },
});

export const down = defineAction<RoomSim, [string]>({
  name: 'down',
  enabled: (s) => clientIds(s).length > 0,
  sample: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.kit.net(id).set('down');
  },
});

export const disconnect = defineAction<RoomSim, [string]>({
  name: 'disconnect',
  enabled: (s) => clientIds(s).length > 0,
  sample: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.clients.get(id)?.disconnect();
  },
});

export const connect = defineAction<RoomSim, [string]>({
  name: 'connect',
  enabled: (s) => clientIds(s).length > 0,
  sample: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.clients.get(id)?.connect();
  },
});

export const takeOver = defineAction<RoomSim, [string]>({
  name: 'takeOver',
  enabled: (s) => clientIds(s).length > 0,
  sample: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.node(id).takeOver();
  },
});

export const crash = defineAction<RoomSim, [string]>({
  name: 'crash',
  enabled: (s) => {
    const crashed = new Set(crashedIds(s));
    return clientIds(s).some((id) => !crashed.has(id));
  },
  sample: (s) => {
    const crashed = new Set(crashedIds(s));
    return pickClientId(clientIds(s).filter((id) => !crashed.has(id)));
  },
  act: async (s, id) => {
    await s.kit.node(id).crash();
  },
});

export const restart = defineAction<RoomSim, [string]>({
  name: 'restart',
  enabled: (s) => clientIds(s).length > 0,
  sample: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    const c = s.kit.clients.get(id);
    if (c !== undefined && !c.isCrashed()) await s.kit.node(id).crash();
    await s.kit.node(id).restart();
  },
});

export const clearLocalData = defineAction<RoomSim, [string]>({
  name: 'clearLocalData',
  enabled: (s) => clientIds(s).length > 0,
  sample: (s) => pickClientId(clientIds(s)),
  act: async (s, id) => {
    await s.kit.node(id).clearLocalData();
  },
});

/** Mild lossy / reordering / duplicating link on one client. */
export const setFaults = defineAction<RoomSim, [SetFaultsSpec]>({
  name: 'setFaults',
  enabled: (s) => clientIds(s).length > 0,
  weight: (s) => (linkUpClients(s).length > 0 ? 1 : 0),
  sample: (s) =>
    gen(
      fc.record({
        clientId: arbClientId(linkUpClients(s)),
        faults: fc.constantFrom(...NET_FAULT_PROFILES),
      })
    ),
  act: (s, spec) => {
    s.kit.net(spec.clientId).set(spec.faults);
  },
});

export const asymmetricLink = defineAction<RoomSim, [string]>({
  name: 'asymmetricLink',
  enabled: (s) => clientIds(s).length > 0,
  weight: (s) => (linkUpClients(s).length > 0 ? 1 : 0),
  sample: (s) => pickClientId(linkUpClients(s)),
  act: (s, id) => {
    s.kit.net(id).set({ toClient: 'hold', toServer: 'ok' });
  },
});

export const serverCrash = defineAction<RoomSim>({
  name: 'serverCrash',
  enabled: (s) => !serverCrashed(s),
  act: async (s) => {
    await s.kit.serverCrash();
  },
});

export const serverRestart = defineAction<RoomSim>({
  name: 'serverRestart',
  enabled: (s) => serverCrashed(s),
  act: async (s) => {
    await s.kit.serverRestart();
  },
});

export const partition = defineAction<RoomSim, [string]>({
  name: 'partition',
  enabled: (s) => caps(s).includes('partition') && clientIds(s).length > 0,
  weight: (s) => (partitioned(s).length === 0 ? 2 : 1),
  sample: (s) => pickClientId(clientIds(s)),
  act: (s, id) => {
    s.session.network.partition(ROOM_SERVER_ENDPOINT, roomClientEndpoint(id));
  },
});

export const restoreNetwork = defineAction<RoomSim>({
  name: 'restoreNetwork',
  weight: (s) =>
    Math.max(
      1,
      partitioned(s).length + heldClients(s).length + downClients(s).length
    ),
  act: async (s) => {
    if (caps(s).includes('partition')) s.session.network.healAll();
    await prepareClientsForInSync(s.kit);
    await s.kit.recoverAll();
  },
});

export const recoverAll = defineAction<RoomSim>({
  name: 'recoverAll',
  pool: false,
  act: async (s) => {
    await prepareClientsForInSync(s.kit);
    await s.kit.recoverAll();
  },
});

export const clearFaults = defineAction<RoomSim>({
  name: 'clearFaults',
  pool: false,
  act: (s) => {
    s.kit.clearEdgeFaults();
  },
});

/** Arm a boundary crash on a live client; `restart` / `restoreNetwork` bring it back. */
export const armCrashAt = defineAction<RoomSim, [ArmCrashAtSpec]>({
  name: 'armCrashAt',
  enabled: (s) => connected(s).length > 0,
  weight: 1,
  sample: (s) =>
    gen(
      fc.record({
        clientId: arbClientId(connected(s)),
        event: fc.constantFrom(...SIM_PBT_CRASH_EVENTS),
      })
    ),
  act: (s, spec) => {
    s.kit.armCrashAt(spec.clientId, spec.event);
  },
});

/** Inject one catalogued hostile / malformed frame on a client's link. */
export const malformedMessages = defineAction<RoomSim, [MalformedMessageSpec]>({
  name: 'malformedMessages',
  enabled: (s) => connected(s).length > 0,
  weight: 1,
  sample: (s) =>
    gen(
      fc.record({
        clientId: arbClientId(connected(s)),
        kind: fc.constantFrom(...MALFORMED_MESSAGE_INJECT_KINDS),
      })
    ),
  act: (s, spec) => {
    const c = s.kit.clients.get(spec.clientId);
    if (c === undefined) return;
    const built = buildMalformedMessageRaw(spec.kind, clock(s));
    if (built.direction === 'toServer') {
      c.injectToServer(built.raw, { direct: true });
      return;
    }
    c.injectFromServer(built.raw);
  },
});

export const injectToServer = defineAction<
  RoomSim,
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
  RoomSim,
  [{ readonly clientId: string; readonly raw: unknown }]
>({
  name: 'injectFromServer',
  pool: false,
  act: (s, spec) => {
    s.kit.clients.get(spec.clientId)?.injectFromServer(spec.raw);
  },
});

export const setNet = defineAction<
  RoomSim,
  [{ readonly clientId: string; readonly next: RoomNetSetArg }]
>({
  name: 'setNet',
  pool: false,
  act: (s, spec) => {
    s.kit.net(spec.clientId).set(spec.next);
  },
});

export const addSpectator = defineAction<RoomSim>({
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

/** RandomActionsReport / explore pool — one entry per randomly sampled library fault. */
export const LIBRARY_ACTIONS = [
  pauseNetwork,
  resumeNetwork,
  down,
  restoreNetwork,
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
  armCrashAt,
  malformedMessages,
] as const;

/**
 * Out-of-pool actions — they need careful sequencing, so scripted tests drive
 * them via `s.apply`. Registered so `replay` can still dispatch by name.
 */
export const SCRIPTED_ACTIONS = [
  addClient,
  dispatch,
  injectToServer,
  injectFromServer,
  setNet,
  clearFaults,
  recoverAll,
] as const;
