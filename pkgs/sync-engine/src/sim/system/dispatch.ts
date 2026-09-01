import { isStorageFullError } from '../../client/storage-full-error';
import type { DomainOp, LibraryAction, ServerOp, SyncAction } from './actions';
import type { SyncApp } from './app';
import type { SystemWorldSurface } from './world-surface';

const SUBS_KEY = Symbol('pbtSubs');

/** Injected sim faults that tear the client down mid-restart; settle remakes it. */
function isExpectedRestartFault(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('crash during epoch migrate') || msg === 'sim: fail next open'
  );
}

function subs(world: SystemWorldSurface): Set<Disposable> {
  const bag = (world as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY];
  if (bag !== undefined) return bag;
  const next = new Set<Disposable>();
  (world as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY] = next;
  return next;
}

function disposeSubs(world: SystemWorldSurface): void {
  for (const d of subs(world)) d[Symbol.dispose]();
  subs(world).clear();
}

async function dispatchDomainOp(
  world: SystemWorldSurface,
  app: SyncApp,
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
  world: SystemWorldSurface,
  app: SyncApp,
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
    world: SystemWorldSurface,
    action: Extract<LibraryAction, { kind: K }>,
    app: SyncApp
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
    world.clearStoragePressure();
    world.clearFailNextOpen();
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
    } catch (error) {
      if (!isExpectedRestartFault(error)) throw error;
      // Client removed mid-restart; replay tracks needsRestart and heals at settle.
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
      if (!isExpectedRestartFault(error)) throw error;
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
    if (action.status === 'revoked') {
      const client = world.clients.get(action.clientId);
      if (client !== undefined) {
        await client.disconnect();
      }
    }
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
  freeze: async (world, action, _app) => {
    world.net(action.clientId, 'sync').set('hold');
  },
  thaw: async (world, action, _app) => {
    world.net(action.clientId, 'sync').set('ok');
    world.clients.get(action.clientId)?.nudge();
  },
  armStoragePressure: async (world, action, _app) => {
    if (!world.clients.has(action.clientId)) return;
    world.armStoragePressure(
      action.clientId,
      action.pressure,
      action.afterStatements
    );
  },
  failNextOpen: async (world, action, _app) => {
    if (!world.clients.has(action.clientId)) return;
    world.armFailNextOpen(action.clientId);
  },
  pruneServerArtifacts: async (world, action, _app) => {
    await world.server.pruneArtifacts(action.olderThanMs);
  },
  addPeerEngine: async (world, action, _app) => {
    const donor = world.clients.get(action.shareWithClientId);
    if (donor === undefined) return;
    if (world.clients.has(action.clientId)) return;
    await world.addClient({
      id: action.clientId,
      actorId: donor.actorId,
      existingDb: donor.dbBundle,
    });
  },
};

async function dispatchLibraryAction(
  world: SystemWorldSurface,
  app: SyncApp,
  action: LibraryAction
): Promise<void> {
  type Handler = (
    w: SystemWorldSurface,
    a: LibraryAction,
    dstApp: SyncApp
  ) => Promise<void>;
  await (LIBRARY_HANDLERS[action.kind] as Handler)(world, action, app);
}

/** Dispatch one DST action (library, domain mutation, or server op). */
export async function dispatchSyncAction(
  world: SystemWorldSurface,
  app: SyncApp,
  action: SyncAction
): Promise<void> {
  try {
    if (action.kind === 'domain') {
      await dispatchDomainOp(world, app, action);
      return;
    }
    if (action.kind === 'server') {
      await dispatchServerOp(world, app, action);
      return;
    }
    await dispatchLibraryAction(world, app, action);
  } catch (error) {
    // SQLITE_FULL / torn txn: local write aborted; heal+converge later.
    if (isStorageFullError(error)) return;
    throw error;
  }
}
