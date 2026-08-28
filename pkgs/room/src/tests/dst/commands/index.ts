import fc from 'fast-check';

import type { RoomSimWorld } from '../../../sim/world-api';
import type { RoomDstAction } from '../actions';
import type { RoomDstApp } from '../app';
import { dispatchRoomDstAction } from '../dispatch';
import { initialWorldModel, type WorldModel, type WorldReal } from '../model';
import { buildWorldCommandPool } from './command-arbs';
import type { WorldCmd } from './index-types';

/** Weighted command generator for shrinking DST over RoomSimWorld. */
export function worldCommands(
  app: RoomDstApp,
  clientIds: readonly string[],
  maxCommands = 14
): fc.Arbitrary<Iterable<WorldCmd>> {
  return fc.commands(buildWorldCommandPool(app, clientIds), {
    maxCommands,
    size: 'small',
  });
}

export function initialWorldState(
  app: RoomDstApp,
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
  app: RoomDstApp,
  world: RoomSimWorld,
  actions: readonly RoomDstAction[]
): Promise<void> {
  for (const action of actions) {
    await prepareReplayAction(world, action);
    await dispatchRoomDstAction(world, app, action);
    await finishReplayStep(world);
  }
  await prepareClientsForConverge(world);
}

async function prepareReplayAction(
  world: RoomSimWorld,
  action: RoomDstAction
): Promise<void> {
  if (action.kind === 'serverRestart' && world.isServerCrashed()) {
    return;
  }
  if (action.kind === 'restart') {
    const c = world.clients.get(action.clientId);
    if (c !== undefined && !c.isCrashed()) {
      await world.node(action.clientId).crash();
    }
  }
}

async function finishReplayStep(world: RoomSimWorld): Promise<void> {
  const inv = await world.checkInvariants();
  if (inv !== null) {
    throw new Error(
      `${inv.invariant} seed=${world.seed.toString(16)}: ${inv.detail}`
    );
  }
  await world.runFor(10);
}

/** Restart crashed clients / server so settle is meaningful. */
export async function prepareClientsForConverge(
  world: RoomSimWorld
): Promise<void> {
  world.clearBoundaryFaults();
  if (world.isServerCrashed()) {
    await world.serverRestart();
  }
  for (const [id, client] of world.clients) {
    if (client.isCrashed()) {
      await world.node(id).restart();
    }
  }
  for (const id of world.clients.keys()) {
    world.net(id).set('ok');
  }
  if (world.clients.size > 0) {
    await world.runFor(50);
  }
}

export {
  applyActionToModel,
  BYZANTINE_INJECT_KINDS,
  buildByzantineRaw,
  CLIENT_IDS,
  clientLive,
  initialWorldModel,
  modelAllowsAction,
  NET_FAULT_PROFILES,
  WORLD_PBT_CRASH_EVENTS,
} from '../model';
export type { WorldCmd, WorldModel, WorldReal };
