import type { RoomKit } from '../kit-api';

/** Restart crashed clients / server so settle is meaningful. */
export async function prepareClientsForConverge(kit: RoomKit): Promise<void> {
  kit.clearBoundaryFaults();
  if (kit.isServerCrashed()) {
    await kit.serverRestart();
  }
  for (const [id, client] of kit.clients) {
    if (client.isCrashed()) {
      await kit.node(id).restart();
    }
  }
  for (const id of kit.clients.keys()) {
    kit.net(id).set('ok');
  }
  if (kit.clients.size > 0) {
    await kit.runFor(50);
  }
}
