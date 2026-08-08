import type { ClientRoomStorage } from './storage';

/** Clears committed log + outbound queue so the next hydrate starts empty. */
export async function wipeLocalRoomCache(
  storage: ClientRoomStorage
): Promise<void> {
  await storage.saveCommitted(0, []);
  const queued = await storage.loadQueued();
  for (const cmd of queued) {
    await storage.removeQueued(cmd.id);
  }
}
