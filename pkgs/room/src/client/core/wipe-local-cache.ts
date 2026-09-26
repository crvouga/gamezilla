import type { ClientRoomStorage } from './storage';

/** Clears committed log + outbound queue so the next hydrate starts empty. */
export async function wipeLocalRoomCache(
  storage: ClientRoomStorage
): Promise<void> {
  await storage.resetCommitted();
  await storage.saveQueued([]);
}
