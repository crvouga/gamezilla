import type { SimWorld } from '../../sim/world-api';
import { acmeRestartOptsForVariant } from '../apps/acme/schema-variants';
import type { DomainOp, DstAction, LibraryAction, ServerOp } from './actions';
import type { DstApp } from './app';

const SUBS_KEY = Symbol('pbtSubs');

function subs(world: SimWorld): Set<Disposable> {
  const bag = (world as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY];
  if (bag !== undefined) return bag;
  const next = new Set<Disposable>();
  (world as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY] = next;
  return next;
}

function disposeSubs(world: SimWorld): void {
  for (const d of subs(world)) d[Symbol.dispose]();
  subs(world).clear();
}

async function dispatchDomainOp(
  world: SimWorld,
  app: DstApp,
  op: DomainOp
): Promise<void> {
  const client = world.clients.get(op.clientId);
  if (client === undefined) return;
  const mutation = app.pack.mutationRegistry[op.mutation];
  if (mutation === undefined) {
    throw new Error(`unknown mutation: ${op.mutation}`);
  }
  await client.mutate(mutation, op.args);
}

async function dispatchServerOp(
  world: SimWorld,
  app: DstApp,
  op: ServerOp
): Promise<void> {
  const handler = app.serverOps?.[op.name];
  if (handler === undefined) {
    throw new Error(`unknown server op: ${op.name}`);
  }
  await handler(world, op.args);
}

const LIBRARY_HANDLERS: {
  readonly [K in LibraryAction['kind']]: (
    world: SimWorld,
    action: Extract<LibraryAction, { kind: K }>
  ) => Promise<void>;
} = {
  offline: async (world, action) => {
    world.clients.get(action.clientId)?.online(false);
  },
  online: async (world, action) => {
    world.clients.get(action.clientId)?.online(true);
  },
  disconnect: async (world, action) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    await client.disconnect();
  },
  connect: async (world, action) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    await client.connect();
  },
  background: async (world, action) => {
    world.clients.get(action.clientId)?.foreground(false);
  },
  foreground: async (world, action) => {
    world.clients.get(action.clientId)?.foreground(true);
  },
  partition: async (world, action) => {
    world.net(action.nodeId, action.traffic).set('down');
  },
  heal: async (world) => {
    disposeSubs(world);
    for (const id of world.clients.keys()) {
      world.net(id, 'all').set('ok');
    }
    try {
      await world.node('server').restart({ preserveLocalDb: true });
    } catch {
      // Server may already be running.
    }
    await world.brokerRestart();
  },
  idle: async (world, action) => {
    await world.runFor(action.ms);
  },
  skew: async (world, action) => {
    world.node(action.nodeId).skewClock(action.skewMs);
  },
  crash: async (world, action) => {
    if (!world.clients.has(action.clientId)) return;
    await world.node(action.clientId).crash();
  },
  restart: async (world, action) => {
    try {
      await world.node(action.clientId).restart();
    } catch {
      // No meta yet (should not happen for boot clients).
    }
  },
  hold: async (world, action) => {
    world.net(action.nodeId, action.traffic).set('hold');
  },
  release: async (world, action) => {
    world.net(action.nodeId, action.traffic).set('ok');
  },
  setFaults: async (world, action) => {
    world.net(action.nodeId, action.traffic).set(action.faults);
  },
  armHttpFault: async (world, action) => {
    world.node(action.clientId).httpFault(action.fault);
  },
  armCrashAt: async (world, action) => {
    world.node(action.clientId).crash({ at: action.event });
  },
  publishFault: async (world, action) => {
    world.node('server').publishFault(action.count);
  },
  armPubsubFault: async (world, action) => {
    world.node('server').pubsubFault(action.fault);
  },
  brokerCrash: async (world) => {
    world.brokerCrash();
  },
  brokerRestart: async (world) => {
    await world.brokerRestart();
  },
  tamperLocalStorage: async (world, action) => {
    await world.tamperLocalStorage(action.clientId, action.tamper);
  },
  restartWithSchema: async (world, action) => {
    const opts = acmeRestartOptsForVariant(action.variant);
    await world.node(action.clientId).restart(opts);
  },
  protocolCut: async (world, action) => {
    world.node(action.clientId).auth('upgrade_required');
  },
  serverCrash: async (world) => {
    await world.node('server').crash();
  },
  serverRestart: async (world) => {
    await world.node('server').restart({ preserveLocalDb: true });
  },
  auth: async (world, action) => {
    world.node(action.clientId).auth(action.status);
  },
  clearLocalData: async (world, action) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    await client.clearLocalData(action.reason);
  },
  subscribe: async (world, action) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    const sub = client.subscribe(action.queryName, action.params);
    subs(world).add(sub);
  },
};

async function dispatchLibraryAction(
  world: SimWorld,
  action: LibraryAction
): Promise<void> {
  switch (action.kind) {
    case 'offline':
      return LIBRARY_HANDLERS.offline(world, action);
    case 'online':
      return LIBRARY_HANDLERS.online(world, action);
    case 'disconnect':
      return LIBRARY_HANDLERS.disconnect(world, action);
    case 'connect':
      return LIBRARY_HANDLERS.connect(world, action);
    case 'background':
      return LIBRARY_HANDLERS.background(world, action);
    case 'foreground':
      return LIBRARY_HANDLERS.foreground(world, action);
    case 'partition':
      return LIBRARY_HANDLERS.partition(world, action);
    case 'heal':
      return LIBRARY_HANDLERS.heal(world, action);
    case 'idle':
      return LIBRARY_HANDLERS.idle(world, action);
    case 'skew':
      return LIBRARY_HANDLERS.skew(world, action);
    case 'crash':
      return LIBRARY_HANDLERS.crash(world, action);
    case 'restart':
      return LIBRARY_HANDLERS.restart(world, action);
    case 'hold':
      return LIBRARY_HANDLERS.hold(world, action);
    case 'release':
      return LIBRARY_HANDLERS.release(world, action);
    case 'setFaults':
      return LIBRARY_HANDLERS.setFaults(world, action);
    case 'armHttpFault':
      return LIBRARY_HANDLERS.armHttpFault(world, action);
    case 'armCrashAt':
      return LIBRARY_HANDLERS.armCrashAt(world, action);
    case 'publishFault':
      return LIBRARY_HANDLERS.publishFault(world, action);
    case 'armPubsubFault':
      return LIBRARY_HANDLERS.armPubsubFault(world, action);
    case 'brokerCrash':
      return LIBRARY_HANDLERS.brokerCrash(world, action);
    case 'brokerRestart':
      return LIBRARY_HANDLERS.brokerRestart(world, action);
    case 'tamperLocalStorage':
      return LIBRARY_HANDLERS.tamperLocalStorage(world, action);
    case 'restartWithSchema':
      return LIBRARY_HANDLERS.restartWithSchema(world, action);
    case 'protocolCut':
      return LIBRARY_HANDLERS.protocolCut(world, action);
    case 'serverCrash':
      return LIBRARY_HANDLERS.serverCrash(world, action);
    case 'serverRestart':
      return LIBRARY_HANDLERS.serverRestart(world, action);
    case 'auth':
      return LIBRARY_HANDLERS.auth(world, action);
    case 'clearLocalData':
      return LIBRARY_HANDLERS.clearLocalData(world, action);
    case 'subscribe':
      return LIBRARY_HANDLERS.subscribe(world, action);
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
    }
  }
}

/** Dispatch one DST action (library, domain mutation, or server op). */
export async function dispatchDstAction(
  world: SimWorld,
  app: DstApp,
  action: DstAction
): Promise<void> {
  if (action.kind === 'domain') {
    return dispatchDomainOp(world, app, action);
  }
  if (action.kind === 'server') {
    return dispatchServerOp(world, app, action);
  }
  return dispatchLibraryAction(world, action);
}
