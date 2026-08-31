import type { World } from '../world-api';

import type { RoomDstAction } from './actions';
import type { RoomDstApp } from './app';
import { dispatchRoomDstAction } from './dispatch';

async function prepareReplayAction(
  world: World,
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

async function finishReplayStep(world: World): Promise<void> {
  const inv = await world.checkInvariants();
  if (inv !== null) {
    throw new Error(
      `${inv.invariant} seed=${world.seed.toString(16)}: ${inv.detail}`
    );
  }
  await world.runFor(10);
}

/** Restart crashed clients / server so settle is meaningful. */
export async function prepareClientsForConverge(world: World): Promise<void> {
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

/** Run recorded actions against a live world with per-step invariant checks. */
export async function playActionsOnWorld(
  app: RoomDstApp,
  world: World,
  actions: readonly RoomDstAction[]
): Promise<void> {
  for (const action of actions) {
    await prepareReplayAction(world, action);
    await dispatchRoomDstAction(world, app, action);
    await finishReplayStep(world);
  }
  await prepareClientsForConverge(world);
}
