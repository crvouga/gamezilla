import fc from 'fast-check';

import type { SimWorld } from '../../../sim/world-api';
import type { DstAction } from '../actions';
import type { DstApp } from '../app';
import { dispatchDstAction } from '../dispatch';
import { initialWorldModel, type WorldModel, type WorldReal } from '../model';
import { buildWorldCommandPool } from './command-arbs';
import type { WorldCmd } from './index-types';
import {
  createReplayRestartState,
  dispatchReplayAction,
  finishReplayStep,
  healNetworkForSettle,
  prepareReplayAction,
  restartClientForConverge,
  trackRemovedClients,
  trackRestartFromAction,
} from './replay-step';

/** Skew arms are fire-and-forget in replay — zero before settle. */
export function resetClockSkews(world: SimWorld): void {
  world.node('server').skewClock(0);
  for (const id of world.clients.keys()) {
    world.node(id).skewClock(0);
  }
}

/** Weighted command generator for shrinking DST over SimWorld. */
export function worldCommands(
  app: DstApp,
  clientIds: readonly string[],
  maxCommands = 14
): fc.Arbitrary<Iterable<WorldCmd>> {
  return fc.commands(buildWorldCommandPool(app, clientIds), {
    maxCommands,
    size: 'small',
  });
}

export function initialWorldState(
  app: DstApp,
  clientIds: readonly string[]
): {
  model: WorldModel;
  real: WorldReal;
} {
  return {
    model: initialWorldModel(app, clientIds),
    real: { clientIds, actions: [] },
  };
}

/** Run recorded actions against a live world with per-step invariant checks. */
export async function replayActionsOnWorld(
  app: DstApp,
  world: SimWorld,
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

async function assertStepInvariants(world: SimWorld): Promise<void> {
  const inv = await world.checkInvariants();
  if (inv !== null) {
    throw new Error(
      `${inv.invariant} seed=${world.seed.toString(16)}: ${inv.detail}`
    );
  }
  await world.runFor(10);
}

/** Revoked/crashed clients may hold a closed DB — restart before settle. */
export async function prepareClientsForConverge(
  app: DstApp,
  world: SimWorld,
  clientIds: Iterable<string>,
  freshRestart: ReadonlySet<string> = new Set()
): Promise<void> {
  const ids = [...clientIds];
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

export {
  AUTH_STATUSES,
  applyActionToModel,
  CLIENT_IDS,
  CORRUPTION_VARIANTS,
  CRASH_EVENTS,
  clientLive,
  HOLD_TRAFFIC,
  HTTP_FAULTS,
  initialWorldModel,
  modelAllowsAction,
  PUBSUB_FAULTS,
  SCHEMA_VARIANTS,
  STORAGE_TAMPERS,
} from '../model';
export type { WorldCmd, WorldModel, WorldReal };
