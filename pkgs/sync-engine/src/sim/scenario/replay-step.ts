import { peerClientIdsSharingRawDb } from '../kit-lifecycle';
import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import { dispatchSyncAction } from './dispatch';
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
  await dispatchSyncAction(surface, app, action);
}
