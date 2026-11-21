// @io-wall-ok
import { i18n } from '@libs/app-root-shared-ts/i18n';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import { createBrowserObjectStore } from '@pkgs/object-store-opfs-client-ts/wall-browser-fs';
import { bootProductHarnessSession } from './boot-product-harness';
import { openEmulatorGateway } from './emulator-gateway';
import type { HarnessSessions } from './harness-bug-reports';
import type { ConsoleEnv } from './root-app';
import { reopenReportedWorld } from './wall-bug-reports';

/**
 * Wall services for the console, never for the actors' in-process HTTP. The
 * session it boots is the one bug reports are about.
 */
export function wallConsoleEnv(sessions: HarnessSessions): ConsoleEnv {
  const http = createGlobalHttpClient();
  const snapshotStore = createBrowserObjectStore({
    baseDir: 'product-harness-snapshots',
  });
  return {
    i18n,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    ports: {
      clock: wallClock,
      timers: wallTimers,
      fetch: http.fetch,
      async bootProductHarness(options) {
        const session = await bootProductHarnessSession(
          {
            clock: wallClock,
            timers: wallTimers,
            snapshotStore,
            openEmulatorGateway,
            reportedWorld: reopenReportedWorld,
          },
          options
        );
        sessions.current = session;
        return session;
      },
      notebookStore: createBrowserObjectStore({ baseDir: 'sql-notebooks' }),
    },
  };
}
