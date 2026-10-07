import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';

/**
 * The server's scheduled sweep (the cron trigger in production): delivers
 * every outbox event that fell due, such as a multiplayer game's deadline.
 */
export async function runScheduledSweep(s: ProductHarness): Promise<void> {
  await drainAndNotifyOutbox({
    db: s.harness.serverSql.sqlClient,
    clock: s.harness.clock,
    createId: s.session.ports.createId,
    pubsub: s.harness.server.events,
    objectStore: s.harness.server.blob,
    consumerRegistry: s.harness.outboxConsumers(),
  });
  await s.session.waitForIdle();
}

/**
 * Seconds pass for everyone — devices and server — whoever is online; the
 * scheduled sweep then runs, so a deadline that fell due is applied even
 * with nobody watching.
 */
export const passMultiplayerTime = scenarioAction({
  name: 'passMultiplayerTime',
  act: async (s, ms: number) => {
    await s.session.advanceTime(ms);
    await s.session.waitForIdle();
    await runScheduledSweep(s);
  },
});
