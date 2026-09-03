import type { BootedSimKernel } from '../kit-types';
import type { SyncAction } from './actions';
import type { SyncApp } from './app';
import { dispatchSyncAction } from './dispatch';
import {
  createReplayRestartState,
  dispatchReplayAction,
  finishReplayStep,
  healNetworkForSettle,
  prepareReplayAction,
  type ReplayRestartState,
  resetReplayRestartState,
  restartClientForConverge,
  restoreSettleAuth,
  trackRemovedClients,
  trackRestartFromAction,
} from './replay-step';
import type { SyncSurfaceBase } from './surface-types';

export type { ReplayRestartState };
export { createReplayRestartState, resetReplayRestartState };

function isKnownClient(surface: SyncSurfaceBase, id: string): boolean {
  if (surface.clients.has(id)) return true;
  const kernel = (
    surface as { readonly runtime?: { kernel?: BootedSimKernel | null } }
  ).runtime?.kernel;
  return kernel?.metas.has(id) ?? false;
}

/** Skew arms are fire-and-forget in replay — zero before settle. */
export function resetClockSkews(surface: SyncSurfaceBase): void {
  surface.node('server').skewClock(0);
  for (const id of surface.clients.keys()) {
    surface.node(id).skewClock(0);
  }
}

/** Revoked/crashed/protocol-cut clients — restore auth, restart before settle. */
export async function prepareClientsForConverge(
  app: SyncApp,
  surface: SyncSurfaceBase,
  restart: ReplayRestartState
): Promise<void> {
  const ids = [...restart.needsRestart].filter((id) =>
    isKnownClient(surface, id)
  );
  // Unfired armCrashAt (e.g. onNextEngineOpenAfterCacheWipe) must not hit
  // revoke/fresh-DB migrate during heal — chaos ends before converge prep.
  surface.clearBoundaryFaults();
  restoreSettleAuth(surface, restart.needsFreshRestart);
  if (ids.length === 0) {
    resetReplayRestartState(restart);
    return;
  }
  // Remake revoked/crashed clients before heal so a shared-db peer is not
  // wiped by revokeDatabase while heal nudges pending uploads.
  for (const id of ids) {
    await restartClientForConverge(surface, id, {
      preserveLocalDb: !restart.needsFreshRestart.has(id),
    });
  }
  resetReplayRestartState(restart);
  if (surface.clients.size > 0) {
    await surface.advance(50);
  }
  await dispatchSyncAction(surface, app, { kind: 'heal' });
  healNetworkForSettle(surface);
  resetClockSkews(surface);
}

/** Framework play loop owns invariants + idle after each step. */
const NO_STEP_ASSERT = async (): Promise<void> => undefined;

/**
 * One replay step: pre-heal for restart-shaped actions, dispatch, then track
 * which clients owe a restart before converge.
 */
export async function replayStep(args: {
  readonly surface: SyncSurfaceBase;
  readonly app: SyncApp;
  readonly action: SyncAction;
  readonly state: ReplayRestartState;
}): Promise<void> {
  const { surface, app, action, state } = args;
  const aliveBefore = new Set(surface.clients.keys());
  await prepareReplayAction(surface, action, state);
  await dispatchReplayAction(surface, app, action);
  trackRemovedClients(aliveBefore, surface, state);
  trackRestartFromAction(action, state, surface);
  await finishReplayStep(surface, action, state, NO_STEP_ASSERT);
}
