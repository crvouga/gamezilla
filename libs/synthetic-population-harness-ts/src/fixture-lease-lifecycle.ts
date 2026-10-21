import type { ProductHarness } from '@libs/harness-ts/harness';
import type { Lease } from '@libs/synthetic-population-server-ts/records';
import { SyntheticPopulationSession } from '@libs/synthetic-population-server-ts/synthetic-population-session';

/** Keep the fixture's ordinary owner alive while its real application runs. */
export function maintainFixtureLease(s: ProductHarness, lease: Lease) {
  const timers = s.harness.server.timers;
  const sessions = new SyntheticPopulationSession(
    s.harness.serverSql.sqlClient,
    {
      clock: s.harness.clock,
      createId: s.session.ports.createId,
      notify: async () => undefined,
    }
  );
  let renewing = false;
  const heartbeat = timers.setInterval(() => {
    if (renewing) return;
    renewing = true;
    void sessions
      .renew(lease)
      .then((renewal) => {
        if (renewal === null) timers.clearInterval(heartbeat);
      })
      .catch(() => timers.clearInterval(heartbeat))
      .finally(() => {
        renewing = false;
      });
  }, 5000);
  const dispose = s.runtime.disposeResources.bind(s.runtime);
  s.runtime.disposeResources = async () => {
    timers.clearInterval(heartbeat);
    await dispose();
  };
}
