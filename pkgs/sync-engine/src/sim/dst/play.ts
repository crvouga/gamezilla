import type { DstAction } from './actions';
import type { DstApp } from './app';
import { dispatchDstAction } from './dispatch';
import {
  createReplayRestartState,
  dispatchReplayAction,
  finishReplayStep,
  healNetworkForSettle,
  prepareReplayAction,
  restartClientForConverge,
  restoreSettleAuth,
  trackRemovedClients,
  trackRestartFromAction,
} from './replay-step';
import type { DstWorldSurface } from './world-surface';

/** Skew arms are fire-and-forget in replay — zero before settle. */
export function resetClockSkews(world: DstWorldSurface): void {
  world.node('server').skewClock(0);
  for (const id of world.clients.keys()) {
    world.node(id).skewClock(0);
  }
}

async function assertStepInvariants(world: DstWorldSurface): Promise<void> {
  const inv = await world.checkInvariants();
  if (inv !== null) {
    throw new Error(
      `${inv.invariant} seed=${world.seed.toString(16)}: ${inv.detail}`
    );
  }
  await world.runFor(10);
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

/** Run recorded actions against a live world with per-step invariant checks. */
export async function playActionsOnWorld(
  app: DstApp,
  world: DstWorldSurface,
  actions: readonly DstAction[]
): Promise<void> {
  const state = createReplayRestartState();
  for (const action of actions) {
    const aliveBefore = new Set(world.clients.keys());
    await prepareReplayAction(world, action, state);
    await dispatchReplayAction(world, app, action);
    trackRemovedClients(aliveBefore, world, state);
    trackRestartFromAction(action, state);
    await finishReplayStep(world, action, state, assertStepInvariants);
  }
  await prepareClientsForConverge(
    app,
    world,
    state.needsRestart,
    state.needsFreshRestart
  );
}

export async function runWithInvariants(
  world: DstWorldSurface,
  run: () => Promise<void>
): Promise<void> {
  await run();
  await assertStepInvariants(world);
}
