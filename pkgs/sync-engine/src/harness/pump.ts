import type { SyncHarnessBase } from './scenario/harness-types';

/** One settle pump: wake + drain scheduler (stimulus only; no reconcile). */
export async function pumpInSync(surface: SyncHarnessBase): Promise<void> {
  for (const client of surface.clients.values()) {
    client.engine.wakeUploads();
    void client.engine.refreshQueries().catch(() => undefined);
  }
  for (let i = 0; i < 8; i += 1) {
    if (surface.isSchedulerQuiescent()) break;
    await surface.advance(250);
  }
}
