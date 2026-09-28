// @io-wall-ok
import { i18n } from '@libs/client-app/shell/i18n';
import { wallClock, wallTimers } from '@pkgs/clock/wall';
import { createGlobalHttpClient } from '@pkgs/http-client/global';
import { createBrowserObjectStore } from '@pkgs/object-store-opfs/wall-browser-fs';
import type { ConsoleEnv } from './root-app';

/** Wall services for the console, never for the actors' in-process HTTP. */
export function wallConsoleEnv(): ConsoleEnv {
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
        const { bootProductHarnessSession } = await import(
          './product-harness/boot-product-harness'
        );
        return bootProductHarnessSession(
          { clock: wallClock, timers: wallTimers, snapshotStore },
          options
        );
      },
      notebookStore: createBrowserObjectStore({ baseDir: 'sql-notebooks' }),
    },
  };
}
