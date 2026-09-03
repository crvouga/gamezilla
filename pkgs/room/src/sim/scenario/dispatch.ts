import type { RoomKit } from '../kit-api';
import type { DomainOp, LibraryAction, RoomSystemAction } from './actions';
import type { RoomApp } from './app';

async function dispatchDomainOp(
  kit: RoomKit,
  app: RoomApp,
  op: DomainOp
): Promise<void> {
  const client = kit.clients.get(op.clientId);
  if (client === undefined) return;
  client.dispatch(app.toPayload(op));
}

const LIBRARY_HANDLERS: {
  readonly [K in LibraryAction['kind']]: (
    kit: RoomKit,
    action: Extract<LibraryAction, { kind: K }>
  ) => Promise<void>;
} = {
  disconnect: async (kit, action) => {
    const c = kit.clients.get(action.clientId);
    if (c === undefined) return;
    await c.disconnect();
  },
  connect: async (kit, action) => {
    const c = kit.clients.get(action.clientId);
    if (c === undefined) return;
    await c.connect();
  },
  hold: async (kit, action) => {
    kit.net(action.clientId).set('hold');
  },
  release: async (kit, action) => {
    kit.net(action.clientId).set('ok');
  },
  down: async (kit, action) => {
    kit.net(action.clientId).set('down');
  },
  heal: async (kit) => {
    for (const id of kit.clients.keys()) {
      kit.net(id).set('ok');
    }
  },
  idle: async (kit, action) => {
    await kit.runFor(action.ms);
  },
  takeOver: async (kit, action) => {
    await kit.node(action.clientId).takeOver();
  },
  crash: async (kit, action) => {
    await kit.node(action.clientId).crash();
  },
  restart: async (kit, action) => {
    const c = kit.clients.get(action.clientId);
    if (c !== undefined && !c.isCrashed()) {
      await kit.node(action.clientId).crash();
    }
    await kit.node(action.clientId).restart();
  },
  serverCrash: async (kit) => {
    await kit.serverCrash();
  },
  serverRestart: async (kit) => {
    await kit.serverRestart();
  },
  clearLocalData: async (kit, action) => {
    await kit.node(action.clientId).clearLocalData();
  },
  setFaults: async (kit, action) => {
    kit.net(action.clientId).set({
      latencyMeanMs: action.faults.latencyMeanMs ?? 5,
      latencyJitterMs: action.faults.latencyJitterMs ?? 5,
      dropProbability: action.faults.dropProbability ?? 0.05,
      ...(action.faults.reorderProbability !== undefined
        ? { reorderProbability: action.faults.reorderProbability }
        : {}),
      ...(action.faults.duplicateProbability !== undefined
        ? { duplicateProbability: action.faults.duplicateProbability }
        : {}),
    });
  },
  asymmetricLink: async (kit, action) => {
    kit.net(action.clientId).set(action.link);
  },
  armCrashAt: async (kit, action) => {
    kit.armCrashAt(action.clientId, action.event);
  },
  injectToServer: async (kit, action) => {
    const c = kit.clients.get(action.clientId);
    if (c === undefined) return;
    c.injectToServer(action.raw, {
      ...(action.direct === true ? { direct: true } : {}),
    });
  },
  injectFromServer: async (kit, action) => {
    const c = kit.clients.get(action.clientId);
    if (c === undefined) return;
    c.injectFromServer(action.raw);
  },
  addSpectator: async (kit, action) => {
    if (kit.clients.has(action.id)) return;
    await kit.addClient({
      id: action.id,
      ...(action.identity !== undefined ? { identity: action.identity } : {}),
      ...(action.clientId !== undefined ? { clientId: action.clientId } : {}),
    });
  },
  setLink: async (kit, action) => {
    kit.net(action.clientId).set(action.link);
  },
};

export async function dispatchRoomSystemAction(
  kit: RoomKit,
  app: RoomApp,
  action: RoomSystemAction
): Promise<void> {
  if (action.kind === 'domain') {
    await dispatchDomainOp(kit, app, action);
    return;
  }
  const handler = LIBRARY_HANDLERS[action.kind] as (
    kit: RoomKit,
    action: LibraryAction
  ) => Promise<void>;
  await handler(kit, action);
}
