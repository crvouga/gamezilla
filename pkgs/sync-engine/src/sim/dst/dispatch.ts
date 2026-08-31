import type { DomainOp, DstAction, LibraryAction, ServerOp } from './actions';
import type { DstApp } from './app';
import type { DstWorldSurface } from './world-surface';

const SUBS_KEY = Symbol('pbtSubs');

/** Sim fault: epoch migrate throws after CACHE wipe; client is already torn down. */
function isEpochMigrateCrash(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('crash during epoch migrate');
}

function subs(world: DstWorldSurface): Set<Disposable> {
  const bag = (world as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY];
  if (bag !== undefined) return bag;
  const next = new Set<Disposable>();
  (world as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY] = next;
  return next;
}

function disposeSubs(world: DstWorldSurface): void {
  for (const d of subs(world)) d[Symbol.dispose]();
  subs(world).clear();
}

async function dispatchDomainOp(
  world: DstWorldSurface,
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
  world: DstWorldSurface,
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
    world: DstWorldSurface,
    action: Extract<LibraryAction, { kind: K }>,
    app: DstApp
  ) => Promise<void>;
} = {
  offline: async (world, action, _app) => {
    world.clients.get(action.clientId)?.online(false);
  },
  online: async (world, action, _app) => {
    world.clients.get(action.clientId)?.online(true);
  },
  disconnect: async (world, action, _app) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    await client.disconnect();
  },
  connect: async (world, action, _app) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    await client.connect();
  },
  background: async (world, action, _app) => {
    world.clients.get(action.clientId)?.foreground(false);
  },
  foreground: async (world, action, _app) => {
    world.clients.get(action.clientId)?.foreground(true);
  },
  partition: async (world, action, _app) => {
    world.net(action.nodeId, action.traffic).set('down');
  },
  heal: async (world, _action, _app) => {
    disposeSubs(world);
    for (const id of world.clients.keys()) {
      world.net(id, 'all').set('ok');
    }
    await world.brokerRestart();
    try {
      await world.node('server').restart({ preserveLocalDb: true });
    } catch {
      // Server may already be running.
    }
  },
  idle: async (world, action, _app) => {
    await world.runFor(action.ms);
  },
  skew: async (world, action, _app) => {
    world.node(action.nodeId).skewClock(action.skewMs);
  },
  crash: async (world, action, _app) => {
    if (!world.clients.has(action.clientId)) return;
    await world.node(action.clientId).crash();
  },
  restart: async (world, action, _app) => {
    try {
      await world.node(action.clientId).restart();
    } catch {
      // No meta yet (should not happen for boot clients).
    }
  },
  hold: async (world, action, _app) => {
    world.net(action.nodeId, action.traffic).set('hold');
  },
  release: async (world, action, _app) => {
    world.net(action.nodeId, action.traffic).set('ok');
  },
  setFaults: async (world, action, _app) => {
    world.net(action.nodeId, action.traffic).set(action.faults);
  },
  armHttpFault: async (world, action, _app) => {
    world.node(action.clientId).httpFault(action.fault);
  },
  armCrashAt: async (world, action, _app) => {
    world.node(action.clientId).crash({ at: action.event });
  },
  publishFault: async (world, action, _app) => {
    world.node('server').publishFault(action.count);
  },
  armPubsubFault: async (world, action, _app) => {
    world.node('server').pubsubFault(action.fault);
  },
  brokerCrash: async (world, _action, _app) => {
    world.brokerCrash();
  },
  brokerRestart: async (world, _action, _app) => {
    await world.brokerRestart();
  },
  tamperLocalStorage: async (world, action, _app) => {
    await world.tamperLocalStorage(action.clientId, action.tamper);
  },
  restartWithSchema: async (world, action, app) => {
    const opts = app.restartOptsForVariant?.(action.variant) ?? {
      preserveLocalDb: true,
    };
    try {
      await world.node(action.clientId).restart(opts);
    } catch (error) {
      if (!isEpochMigrateCrash(error)) throw error;
      // Client removed mid-restart; replay tracks needsRestart and heals at settle.
    }
  },
  protocolCut: async (world, action, _app) => {
    world.node(action.clientId).auth('upgrade_required');
  },
  serverCrash: async (world, _action, _app) => {
    await world.node('server').crash();
  },
  serverRestart: async (world, _action, _app) => {
    await world.node('server').restart({ preserveLocalDb: true });
  },
  auth: async (world, action, _app) => {
    world.node(action.clientId).auth(action.status);
  },
  clearLocalData: async (world, action, _app) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    await client.clearLocalData(action.reason);
  },
  subscribe: async (world, action, _app) => {
    const client = world.clients.get(action.clientId);
    if (client === undefined) return;
    const sub = client.subscribe(action.queryName, action.params);
    subs(world).add(sub);
  },
};

async function dispatchLibraryAction(
  world: DstWorldSurface,
  app: DstApp,
  action: LibraryAction
): Promise<void> {
  switch (action.kind) {
    case 'offline':
      return LIBRARY_HANDLERS.offline(world, action, app);
    case 'online':
      return LIBRARY_HANDLERS.online(world, action, app);
    case 'disconnect':
      return LIBRARY_HANDLERS.disconnect(world, action, app);
    case 'connect':
      return LIBRARY_HANDLERS.connect(world, action, app);
    case 'background':
      return LIBRARY_HANDLERS.background(world, action, app);
    case 'foreground':
      return LIBRARY_HANDLERS.foreground(world, action, app);
    case 'partition':
      return LIBRARY_HANDLERS.partition(world, action, app);
    case 'heal':
      return LIBRARY_HANDLERS.heal(world, action, app);
    case 'idle':
      return LIBRARY_HANDLERS.idle(world, action, app);
    case 'skew':
      return LIBRARY_HANDLERS.skew(world, action, app);
    case 'crash':
      return LIBRARY_HANDLERS.crash(world, action, app);
    case 'restart':
      return LIBRARY_HANDLERS.restart(world, action, app);
    case 'hold':
      return LIBRARY_HANDLERS.hold(world, action, app);
    case 'release':
      return LIBRARY_HANDLERS.release(world, action, app);
    case 'setFaults':
      return LIBRARY_HANDLERS.setFaults(world, action, app);
    case 'armHttpFault':
      return LIBRARY_HANDLERS.armHttpFault(world, action, app);
    case 'armCrashAt':
      return LIBRARY_HANDLERS.armCrashAt(world, action, app);
    case 'publishFault':
      return LIBRARY_HANDLERS.publishFault(world, action, app);
    case 'armPubsubFault':
      return LIBRARY_HANDLERS.armPubsubFault(world, action, app);
    case 'brokerCrash':
      return LIBRARY_HANDLERS.brokerCrash(world, action, app);
    case 'brokerRestart':
      return LIBRARY_HANDLERS.brokerRestart(world, action, app);
    case 'tamperLocalStorage':
      return LIBRARY_HANDLERS.tamperLocalStorage(world, action, app);
    case 'restartWithSchema':
      return LIBRARY_HANDLERS.restartWithSchema(world, action, app);
    case 'protocolCut':
      return LIBRARY_HANDLERS.protocolCut(world, action, app);
    case 'serverCrash':
      return LIBRARY_HANDLERS.serverCrash(world, action, app);
    case 'serverRestart':
      return LIBRARY_HANDLERS.serverRestart(world, action, app);
    case 'auth':
      return LIBRARY_HANDLERS.auth(world, action, app);
    case 'clearLocalData':
      return LIBRARY_HANDLERS.clearLocalData(world, action, app);
    case 'subscribe':
      return LIBRARY_HANDLERS.subscribe(world, action, app);
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
    }
  }
}

/** Dispatch one DST action (library, domain mutation, or server op). */
export async function dispatchDstAction(
  world: DstWorldSurface,
  app: DstApp,
  action: DstAction
): Promise<void> {
  if (action.kind === 'domain') {
    return dispatchDomainOp(world, app, action);
  }
  if (action.kind === 'server') {
    return dispatchServerOp(world, app, action);
  }
  return dispatchLibraryAction(world, app, action);
}
