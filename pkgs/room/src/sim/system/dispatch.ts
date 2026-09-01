import type { DomainOp, LibraryAction, RoomSystemAction } from './actions';
import type { RoomApp } from './app';
import type { RoomSystemWorldSurface } from './world-surface';

async function dispatchDomainOp(
  world: RoomSystemWorldSurface,
  app: RoomApp,
  op: DomainOp
): Promise<void> {
  const client = world.clients.get(op.clientId);
  if (client === undefined) return;
  client.dispatch(app.toPayload(op));
}

const LIBRARY_HANDLERS: {
  readonly [K in LibraryAction['kind']]: (
    world: RoomSystemWorldSurface,
    action: Extract<LibraryAction, { kind: K }>
  ) => Promise<void>;
} = {
  disconnect: async (world, action) => {
    const c = world.clients.get(action.clientId);
    if (c === undefined) return;
    await c.disconnect();
  },
  connect: async (world, action) => {
    const c = world.clients.get(action.clientId);
    if (c === undefined) return;
    await c.connect();
  },
  hold: async (world, action) => {
    world.net(action.clientId).set('hold');
  },
  release: async (world, action) => {
    world.net(action.clientId).set('ok');
  },
  down: async (world, action) => {
    world.net(action.clientId).set('down');
  },
  heal: async (world) => {
    for (const id of world.clients.keys()) {
      world.net(id).set('ok');
    }
  },
  idle: async (world, action) => {
    await world.runFor(action.ms);
  },
  takeOver: async (world, action) => {
    await world.node(action.clientId).takeOver();
  },
  crash: async (world, action) => {
    await world.node(action.clientId).crash();
  },
  restart: async (world, action) => {
    // A replayed `restart` only observes recovery if the node is down first
    // (recorded/model state may disagree with the live world).
    const c = world.clients.get(action.clientId);
    if (c !== undefined && !c.isCrashed()) {
      await world.node(action.clientId).crash();
    }
    await world.node(action.clientId).restart();
  },
  serverCrash: async (world) => {
    await world.serverCrash();
  },
  serverRestart: async (world) => {
    await world.serverRestart();
  },
  clearLocalData: async (world, action) => {
    await world.node(action.clientId).clearLocalData();
  },
  setFaults: async (world, action) => {
    world.net(action.clientId).set({
      oneWayDelayMeanMs: action.faults.oneWayDelayMeanMs ?? 5,
      oneWayDelayJitterMs: action.faults.oneWayDelayJitterMs ?? 5,
      packetLossProbability: action.faults.packetLossProbability ?? 0.05,
      ...(action.faults.reorderProbability !== undefined
        ? { reorderProbability: action.faults.reorderProbability }
        : {}),
      ...(action.faults.duplicateProbability !== undefined
        ? { duplicateProbability: action.faults.duplicateProbability }
        : {}),
    });
  },
  asymmetricLink: async (world, action) => {
    world.net(action.clientId).set(action.link);
  },
  armCrashAt: async (world, action) => {
    world.armCrashAt(action.clientId, action.event);
  },
  injectToServer: async (world, action) => {
    const c = world.clients.get(action.clientId);
    if (c === undefined) return;
    c.injectToServer(action.raw, {
      ...(action.direct === true ? { direct: true } : {}),
    });
  },
  injectFromServer: async (world, action) => {
    const c = world.clients.get(action.clientId);
    if (c === undefined) return;
    c.injectFromServer(action.raw);
  },
  addSpectator: async (world, action) => {
    if (world.clients.has(action.id)) return;
    await world.addClient({
      id: action.id,
      ...(action.identity !== undefined ? { identity: action.identity } : {}),
      ...(action.clientId !== undefined ? { clientId: action.clientId } : {}),
    });
  },
  setLink: async (world, action) => {
    world.net(action.clientId).set(action.link);
  },
};

export async function dispatchRoomSystemAction(
  world: RoomSystemWorldSurface,
  app: RoomApp,
  action: RoomSystemAction
): Promise<void> {
  if (action.kind === 'domain') {
    await dispatchDomainOp(world, app, action);
    return;
  }
  const handler = LIBRARY_HANDLERS[action.kind] as (
    world: RoomSystemWorldSurface,
    action: LibraryAction
  ) => Promise<void>;
  await handler(world, action);
}
