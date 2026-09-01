import type { RoomSystemAction } from './actions';
import type { RoomSystemWorldSurface } from './world-surface';

/**
 * Make an action meaningful when the recorded/model state disagrees with the
 * live world: a `restart` only observes recovery if the node is down first.
 */
export async function prepareReplayAction(
  world: RoomSystemWorldSurface,
  action: RoomSystemAction
): Promise<void> {
  if (action.kind === 'restart') {
    const c = world.clients.get(action.clientId);
    if (c !== undefined && !c.isCrashed()) {
      await world.node(action.clientId).crash();
    }
  }
}

/** Restart crashed clients / server so settle is meaningful. */
export async function prepareClientsForConverge(
  world: RoomSystemWorldSurface
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
