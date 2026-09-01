import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import { dispatchSyncAction } from './dispatch';
import type { SystemWorldSurface } from './world-surface';

/** Clear partitions/holds/faults so restart and sync can complete. */
export function healNetworkForSettle(world: SystemWorldSurface): void {
  world.network.releaseAll();
  world.network.healAll();
  world.network.clearNodeFaults();
}

async function ensureServerUp(world: SystemWorldSurface): Promise<void> {
  try {
    await world.node('server').restart({ preserveLocalDb: true });
  } catch {
    // Server may already be running with HTTP bound.
  }
}

export async function restartClientForConverge(
  world: SystemWorldSurface,
  clientId: string,
  opts?: { readonly preserveLocalDb?: boolean }
): Promise<void> {
  // Drop unfired armCrashAt / HTTP arms so mid-replay heal restarts (e.g.
  // after tamperLocalStorage) are not crashed during waitForSessionSync when
  // pending uploads drain after partition heal.
  world.clearBoundaryFaults();
  await ensureServerUp(world);
  world.node(clientId).auth('valid');
  await world.node(clientId).restart({
    preserveLocalDb: opts?.preserveLocalDb !== false,
  });
}

export type ReplayRestartState = {
  readonly needsRestart: Set<string>;
  readonly needsFreshRestart: Set<string>;
};

export function createReplayRestartState(): ReplayRestartState {
  return { needsRestart: new Set(), needsFreshRestart: new Set() };
}

export async function prepareReplayAction(
  world: SystemWorldSurface,
  action: SyncAction,
  state: ReplayRestartState
): Promise<void> {
  if (action.kind === 'restart' || action.kind === 'restartWithSchema') {
    // Unfired armCrashAt (e.g. afterNextMutationsPostAccepted) must not
    // crash the remade engine during waitForSessionSync when pending
    // uploads drain after auth heal / protocolCut restore.
    world.clearBoundaryFaults();
    healNetworkForSettle(world);
    await ensureServerUp(world);
  }
  if (action.kind === 'serverRestart') {
    healNetworkForSettle(world);
    for (const id of world.clients.keys()) {
      if (state.needsRestart.has(id)) continue;
      await world.clients.get(id)?.connect();
    }
  }
  if (action.kind === 'brokerRestart') {
    healNetworkForSettle(world);
  }
}

export function trackRemovedClients(
  aliveBefore: ReadonlySet<string>,
  world: SystemWorldSurface,
  state: ReplayRestartState
): void {
  for (const id of aliveBefore) {
    if (!world.clients.has(id)) {
      state.needsRestart.add(id);
    }
  }
}

export function trackRestartFromAction(
  action: SyncAction,
  state: ReplayRestartState
): void {
  if (action.kind === 'auth' && action.status === 'revoked') {
    state.needsRestart.add(action.clientId);
    state.needsFreshRestart.add(action.clientId);
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
  world: SystemWorldSurface,
  skip: ReadonlySet<string> = new Set()
): void {
  for (const id of world.clients.keys()) {
    if (skip.has(id)) continue;
    world.node(id).auth('valid');
  }
}

export async function finishReplayStep(
  world: SystemWorldSurface,
  action: SyncAction,
  state: ReplayRestartState,
  assertStep: (world: SystemWorldSurface) => Promise<void>
): Promise<void> {
  if (action.kind === 'connect' && state.needsRestart.has(action.clientId)) {
    world.clearBoundaryFaults();
    healNetworkForSettle(world);
    await restartClientForConverge(world, action.clientId, {
      preserveLocalDb: !state.needsFreshRestart.has(action.clientId),
    });
    state.needsRestart.delete(action.clientId);
    state.needsFreshRestart.delete(action.clientId);
    await assertStep(world);
    return;
  }
  if (action.kind === 'restart' || action.kind === 'restartWithSchema') {
    if (world.clients.has(action.clientId)) {
      state.needsRestart.delete(action.clientId);
      state.needsFreshRestart.delete(action.clientId);
    }
    await assertStep(world);
    return;
  }
  if (action.kind === 'tamperLocalStorage') {
    // Disarm before heal so a pending upload cannot crash the live
    // engine in the gap before restartClientForConverge clears arms.
    world.clearBoundaryFaults();
    healNetworkForSettle(world);
    await restartClientForConverge(world, action.clientId);
    state.needsRestart.delete(action.clientId);
    await assertStep(world);
    return;
  }
  await assertStep(world);
}

export async function dispatchReplayAction(
  world: SystemWorldSurface,
  app: SyncApp,
  action: SyncAction
): Promise<void> {
  await dispatchSyncAction(world, app, action);
}
