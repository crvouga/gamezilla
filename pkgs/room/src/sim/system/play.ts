import type { RoomSystemWorldSurface } from './world-surface';

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
