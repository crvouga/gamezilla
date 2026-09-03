import { isStorageFullError } from '../../client/storage-full-error';
import type { DomainOp, LibraryAction, ServerOp, SyncAction } from './actions';
import type { SyncApp } from './app';
import type { SyncSurfaceBase } from './surface-types';

const SUBS_KEY = Symbol('pbtSubs');

/** Injected sim faults that tear the client down mid-restart; settle remakes it. */
function isExpectedRestartFault(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('crash during epoch migrate') || msg === 'sim: fail next open'
  );
}

function subs(surface: SyncSurfaceBase): Set<Disposable> {
  const bag = (surface as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY];
  if (bag !== undefined) return bag;
  const next = new Set<Disposable>();
  (surface as unknown as Record<symbol, Set<Disposable>>)[SUBS_KEY] = next;
  return next;
}

function disposeSubs(surface: SyncSurfaceBase): void {
  for (const d of subs(surface)) d[Symbol.dispose]();
  subs(surface).clear();
}

async function dispatchDomainOp(
  surface: SyncSurfaceBase,
  app: SyncApp,
  op: DomainOp
): Promise<void> {
  const client = surface.clients.get(op.clientId);
  if (client === undefined) return;
  const mutation = app.pack.mutationRegistry[op.mutation];
  if (mutation === undefined) {
    throw new Error(`unknown mutation: ${op.mutation}`);
  }
  await client.mutate(mutation, op.args);
}

async function dispatchServerOp(
  surface: SyncSurfaceBase,
  app: SyncApp,
  op: ServerOp
): Promise<void> {
  const handler = app.serverOps?.[op.name];
  if (handler === undefined) {
    throw new Error(`unknown server op: ${op.name}`);
  }
  await handler(surface, op.args);
}

const LIBRARY_HANDLERS: {
  readonly [K in LibraryAction['kind']]: (
    surface: SyncSurfaceBase,
    action: Extract<LibraryAction, { kind: K }>,
    app: SyncApp
  ) => Promise<void>;
} = {
  offline: async (surface, action, _app) => {
    surface.clients.get(action.clientId)?.online(false);
  },
  online: async (surface, action, _app) => {
    surface.clients.get(action.clientId)?.online(true);
  },
  disconnect: async (surface, action, _app) => {
    const client = surface.clients.get(action.clientId);
    if (client === undefined) return;
    await client.disconnect();
  },
  connect: async (surface, action, _app) => {
    const client = surface.clients.get(action.clientId);
    if (client === undefined) return;
    await client.connect();
  },
  background: async (surface, action, _app) => {
    surface.clients.get(action.clientId)?.foreground(false);
  },
  foreground: async (surface, action, _app) => {
    surface.clients.get(action.clientId)?.foreground(true);
  },
  partition: async (surface, action, _app) => {
    surface.net(action.nodeId, action.traffic).set('down');
  },
  heal: async (surface, _action, _app) => {
    disposeSubs(surface);
    surface.clearStoragePressure();
    surface.clearFailNextOpen();
    for (const id of surface.clients.keys()) {
      surface.net(id, 'all').set('ok');
    }
    await surface.brokerRestart();
    try {
      await surface.node('server').restart({ preserveLocalDb: true });
    } catch {
      // Server may already be running.
    }
  },
  idle: async (surface, action, _app) => {
    await surface.advance(action.ms);
  },
  skew: async (surface, action, _app) => {
    surface.node(action.nodeId).skewClock(action.skewMs);
  },
  crash: async (surface, action, _app) => {
    if (!surface.clients.has(action.clientId)) return;
    await surface.node(action.clientId).crash();
  },
  restart: async (surface, action, _app) => {
    try {
      await surface.node(action.clientId).restart();
    } catch (error) {
      if (!isExpectedRestartFault(error)) throw error;
      // Client removed mid-restart; replay tracks needsRestart and heals at settle.
    }
  },
  hold: async (surface, action, _app) => {
    surface.net(action.nodeId, action.traffic).set('hold');
  },
  release: async (surface, action, _app) => {
    surface.net(action.nodeId, action.traffic).set('ok');
  },
  setFaults: async (surface, action, _app) => {
    surface.net(action.nodeId, action.traffic).set(action.faults);
  },
  armHttpFault: async (surface, action, _app) => {
    surface.node(action.clientId).httpFault(action.fault);
  },
  armCrashAt: async (surface, action, _app) => {
    surface.node(action.clientId).crash({ at: action.event });
  },
  publishFault: async (surface, action, _app) => {
    surface.node('server').publishFault(action.count);
  },
  armPubsubFault: async (surface, action, _app) => {
    surface.node('server').pubsubFault(action.fault);
  },
  brokerCrash: async (surface, _action, _app) => {
    surface.brokerCrash();
  },
  brokerRestart: async (surface, _action, _app) => {
    await surface.brokerRestart();
  },
  tamperLocalStorage: async (surface, action, _app) => {
    await surface.tamperLocalStorage(action.clientId, action.tamper);
  },
  restartWithSchema: async (surface, action, app) => {
    const opts = app.restartOptsForVariant?.(action.variant) ?? {
      preserveLocalDb: true,
    };
    try {
      await surface.node(action.clientId).restart(opts);
    } catch (error) {
      if (!isExpectedRestartFault(error)) throw error;
      // Client removed mid-restart; replay tracks needsRestart and heals at settle.
    }
  },
  protocolCut: async (surface, action, _app) => {
    surface.node(action.clientId).auth('upgrade_required');
  },
  serverCrash: async (surface, _action, _app) => {
    await surface.node('server').crash();
  },
  serverRestart: async (surface, _action, _app) => {
    await surface.node('server').restart({ preserveLocalDb: true });
  },
  auth: async (surface, action, _app) => {
    surface.node(action.clientId).auth(action.status);
    if (action.status === 'revoked') {
      const client = surface.clients.get(action.clientId);
      if (client !== undefined) {
        await client.disconnect();
      }
    }
  },
  clearLocalData: async (surface, action, _app) => {
    const client = surface.clients.get(action.clientId);
    if (client === undefined) return;
    await client.clearLocalData(action.reason);
  },
  subscribe: async (surface, action, _app) => {
    const client = surface.clients.get(action.clientId);
    if (client === undefined) return;
    const sub = client.subscribe(action.queryName, action.params);
    subs(surface).add(sub);
  },
  freeze: async (surface, action, _app) => {
    surface.net(action.clientId, 'sync').set('hold');
  },
  thaw: async (surface, action, _app) => {
    surface.net(action.clientId, 'sync').set('ok');
    surface.clients.get(action.clientId)?.nudge();
  },
  armStoragePressure: async (surface, action, _app) => {
    if (!surface.clients.has(action.clientId)) return;
    surface.armStoragePressure(
      action.clientId,
      action.pressure,
      action.afterStatements
    );
  },
  failNextOpen: async (surface, action, _app) => {
    if (!surface.clients.has(action.clientId)) return;
    surface.armFailNextOpen(action.clientId);
  },
  pruneServerArtifacts: async (surface, action, _app) => {
    await surface.server.pruneArtifacts(action.olderThanMs);
  },
  addPeerEngine: async (surface, action, _app) => {
    const donor = surface.clients.get(action.shareWithClientId);
    if (donor === undefined) return;
    if (surface.clients.has(action.clientId)) return;
    await surface.addClient({
      id: action.clientId,
      actorId: donor.actorId,
      existingDb: donor.dbBundle,
    });
  },
};

async function dispatchLibraryAction(
  surface: SyncSurfaceBase,
  app: SyncApp,
  action: LibraryAction
): Promise<void> {
  type Handler = (
    w: SyncSurfaceBase,
    a: LibraryAction,
    dstApp: SyncApp
  ) => Promise<void>;
  await (LIBRARY_HANDLERS[action.kind] as Handler)(surface, action, app);
}

/** Dispatch one DST action (library, domain mutation, or server op). */
export async function dispatchSyncAction(
  surface: SyncSurfaceBase,
  app: SyncApp,
  action: SyncAction
): Promise<void> {
  try {
    if (action.kind === 'domain') {
      await dispatchDomainOp(surface, app, action);
      return;
    }
    if (action.kind === 'server') {
      await dispatchServerOp(surface, app, action);
      return;
    }
    await dispatchLibraryAction(surface, app, action);
  } catch (error) {
    // SQLITE_FULL / torn txn: local write aborted; heal+converge later.
    if (isStorageFullError(error)) return;
    throw error;
  }
}
