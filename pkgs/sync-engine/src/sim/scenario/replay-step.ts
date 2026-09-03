import { isStorageFullError } from '../../client/storage-full-error';
import { peerClientIdsSharingRawDb } from '../kit-lifecycle';
import type { DomainOp, LibraryAction, ServerOp, SyncAction } from './actions';
import type { SyncApp } from './app';
import type { SyncSurfaceBase } from './surface-types';

/** Clear partitions/holds/faults so restart and sync can complete. */
export function healNetworkForSettle(surface: SyncSurfaceBase): void {
  const network = surface.kit.network;
  network.releaseAll();
  network.healAll();
  network.clearNodeFaults();
}

async function ensureServerUp(surface: SyncSurfaceBase): Promise<void> {
  try {
    await surface.node('server').restart({ preserveLocalDb: true });
  } catch {
    // Server may already be running with HTTP bound.
  }
}

/** Injected sim faults that tear the client down mid-restart; heal retries. */
function isExpectedRestartFault(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('crash during epoch migrate') || msg === 'sim: fail next open'
  );
}

/** Remake a client; retry once when failNextOpen / epoch-migrate arms fire. */
export async function restartClientWithRetry(
  surface: SyncSurfaceBase,
  clientId: string,
  opts?: { readonly preserveLocalDb?: boolean }
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await surface.node(clientId).restart({
        preserveLocalDb: opts?.preserveLocalDb !== false,
      });
      return;
    } catch (error) {
      if (isExpectedRestartFault(error)) continue;
      throw error;
    }
  }
}

export async function restartClientForConverge(
  surface: SyncSurfaceBase,
  clientId: string,
  opts?: { readonly preserveLocalDb?: boolean }
): Promise<void> {
  // Drop unfired armCrashAt / HTTP arms so mid-replay heal restarts (e.g.
  // after tamperLocalStorage) are not crashed during waitForSessionSync when
  // pending uploads drain after partition heal.
  surface.clearBoundaryFaults();
  await ensureServerUp(surface);
  surface.node(clientId).auth('valid');
  await restartClientWithRetry(surface, clientId, opts);
}

export type ReplayRestartState = {
  readonly needsRestart: Set<string>;
  readonly needsFreshRestart: Set<string>;
};

export function createReplayRestartState(): ReplayRestartState {
  return { needsRestart: new Set(), needsFreshRestart: new Set() };
}

/** Shared {@link SyncRuntime} replay bags must reset on each surface open. */
export function resetReplayRestartState(state: ReplayRestartState): void {
  state.needsRestart.clear();
  state.needsFreshRestart.clear();
}

export async function prepareReplayAction(
  surface: SyncSurfaceBase,
  action: SyncAction,
  state: ReplayRestartState
): Promise<void> {
  if (action.kind === 'restart' || action.kind === 'restartWithSchema') {
    // Unfired armCrashAt (e.g. afterNextMutationsPostAccepted) must not
    // crash the remade engine during waitForSessionSync when pending
    // uploads drain after auth heal / protocolCut restore.
    surface.clearBoundaryFaults();
    healNetworkForSettle(surface);
    await ensureServerUp(surface);
  }
  if (action.kind === 'serverRestart') {
    healNetworkForSettle(surface);
    for (const id of surface.clients.keys()) {
      if (state.needsRestart.has(id)) continue;
      await surface.clients.get(id)?.connect();
    }
  }
  if (action.kind === 'brokerRestart') {
    healNetworkForSettle(surface);
  }
}

export function trackRemovedClients(
  aliveBefore: ReadonlySet<string>,
  surface: SyncSurfaceBase,
  state: ReplayRestartState
): void {
  for (const id of aliveBefore) {
    if (!surface.clients.has(id)) {
      state.needsRestart.add(id);
    }
  }
}

export function trackRestartFromAction(
  action: SyncAction,
  state: ReplayRestartState,
  surface?: SyncSurfaceBase
): void {
  if (action.kind === 'auth' && action.status === 'revoked') {
    state.needsRestart.add(action.clientId);
    state.needsFreshRestart.add(action.clientId);
    if (surface !== undefined) {
      for (const peerId of peerClientIdsSharingRawDb(
        surface.clients,
        action.clientId
      )) {
        state.needsRestart.add(peerId);
        state.needsFreshRestart.add(peerId);
      }
    }
  }
  if (action.kind === 'crash' || action.kind === 'tamperLocalStorage') {
    state.needsRestart.add(action.clientId);
  }
  // Preserve pending mutations; settle remakes the engine after the cut.
  if (action.kind === 'protocolCut') {
    state.needsRestart.add(action.clientId);
  }
}

/** `upgrade_required` / expired: restore so queued mutations can drain. */
export function restoreSettleAuth(
  surface: SyncSurfaceBase,
  skip: ReadonlySet<string> = new Set()
): void {
  for (const id of surface.clients.keys()) {
    if (skip.has(id)) continue;
    surface.node(id).auth('valid');
  }
}

export async function finishReplayStep(
  surface: SyncSurfaceBase,
  action: SyncAction,
  state: ReplayRestartState,
  assertStep: (surface: SyncSurfaceBase) => Promise<void>
): Promise<void> {
  if (action.kind === 'connect' && state.needsRestart.has(action.clientId)) {
    surface.clearBoundaryFaults();
    healNetworkForSettle(surface);
    await restartClientForConverge(surface, action.clientId, {
      preserveLocalDb: !state.needsFreshRestart.has(action.clientId),
    });
    state.needsRestart.delete(action.clientId);
    state.needsFreshRestart.delete(action.clientId);
    await assertStep(surface);
    return;
  }
  if (action.kind === 'restart' || action.kind === 'restartWithSchema') {
    if (surface.clients.has(action.clientId)) {
      state.needsRestart.delete(action.clientId);
      state.needsFreshRestart.delete(action.clientId);
    }
    await assertStep(surface);
    return;
  }
  if (action.kind === 'tamperLocalStorage') {
    // Disarm before heal so a pending upload cannot crash the live
    // engine in the gap before restartClientForConverge clears arms.
    surface.clearBoundaryFaults();
    healNetworkForSettle(surface);
    await restartClientForConverge(surface, action.clientId);
    state.needsRestart.delete(action.clientId);
    await assertStep(surface);
    return;
  }
  await assertStep(surface);
}

export async function dispatchReplayAction(
  surface: SyncSurfaceBase,
  app: SyncApp,
  action: SyncAction
): Promise<void> {
  await applyTaggedSyncAction(surface, app, action);
}

const SUBS_KEY = Symbol('pbtSubs');

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

/** Apply one tagged SyncAction (library / domain / server) onto the surface. */
async function applyTaggedSyncAction(
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
