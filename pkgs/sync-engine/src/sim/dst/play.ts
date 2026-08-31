import type { DstAction } from './actions';
import type { DstApp } from './app';
import { dispatchDstAction } from './dispatch';
import {
  createReplayRestartState,
  dispatchReplayAction,
  finishReplayStep,
  healNetworkForSettle,
  prepareReplayAction,
  type ReplayRestartState,
  restartClientForConverge,
  restoreSettleAuth,
  trackRemovedClients,
  trackRestartFromAction,
} from './replay-step';
import type { DstWorldSurface } from './world-surface';

export type { ReplayRestartState };
export { createReplayRestartState };

/** Skew arms are fire-and-forget in replay — zero before settle. */
export function resetClockSkews(world: DstWorldSurface): void {
  world.node('server').skewClock(0);
  for (const id of world.clients.keys()) {
    world.node(id).skewClock(0);
  }
}

/** Revoked/crashed/protocol-cut clients — restore auth, restart before settle. */
export async function prepareClientsForConverge(
  app: DstApp,
  world: DstWorldSurface,
  clientIds: Iterable<string>,
  freshRestart: ReadonlySet<string> = new Set()
): Promise<void> {
  const ids = [...clientIds];
  // Unfired armCrashAt (e.g. onNextEngineOpenAfterCacheWipe) must not hit
  // revoke/fresh-DB migrate during heal — chaos ends before converge prep.
  world.clearBoundaryFaults();
  restoreSettleAuth(world, freshRestart);
  if (ids.length === 0) return;
  await dispatchDstAction(world, app, { kind: 'heal' });
  healNetworkForSettle(world);
  resetClockSkews(world);
  for (const id of ids) {
    await restartClientForConverge(world, id, {
      preserveLocalDb: !freshRestart.has(id),
    });
  }
  if (world.clients.size > 0) {
    await world.runFor(50);
  }
}

/** Framework play loop owns invariants + idle after each step. */
const NO_STEP_ASSERT = async (): Promise<void> => undefined;

/**
 * One replay step: pre-heal for restart-shaped actions, dispatch, then track
 * which clients owe a restart before converge.
 */
export async function replayStep(args: {
  readonly world: DstWorldSurface;
  readonly app: DstApp;
  readonly action: DstAction;
  readonly state: ReplayRestartState;
}): Promise<void> {
  const { world, app, action, state } = args;
  const aliveBefore = new Set(world.clients.keys());
  await prepareReplayAction(world, action, state);
  await dispatchReplayAction(world, app, action);
  trackRemovedClients(aliveBefore, world, state);
  trackRestartFromAction(action, state);
  await finishReplayStep(world, action, state, NO_STEP_ASSERT);
}
