// @io-wall-ok
import { i18n } from '@apps/client/shell/i18n';
import { wallClock, wallTimers } from '@pkgs/clock/wall';
import { createGlobalHttpClient } from '@pkgs/http-client/global';
import { createStaticObjectStore } from '@pkgs/object-store/impl-static';
import { createBrowserObjectStore } from '@pkgs/object-store-opfs/wall-browser-fs';
import type { ConsoleEnv } from './root-app';

/** Wall services for the console, never for the actors' in-process HTTP. */
export function wallConsoleEnv(): ConsoleEnv {
  const http = createGlobalHttpClient();
  const reportsBase = import.meta.env.VITE_REPORTS_PUBLIC_BASE_URL?.trim();
  const publicBase = reportsBase || '/reports';
  const staticReports = !import.meta.env.DEV || Boolean(reportsBase);
  const snapshotStore = createBrowserObjectStore({
    baseDir: 'playground-snapshots',
  });
  return {
    i18n,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    ports: {
      clock: wallClock,
      timers: wallTimers,
      fetch: http.fetch,
      async bootPlayground(options) {
        const { bootPlaygroundSession } = await import(
          './playground/boot-playground'
        );
        return bootPlaygroundSession(
          { clock: wallClock, timers: wallTimers, snapshotStore },
          options
        );
      },
      ...(staticReports
        ? {
            reportsStore: createStaticObjectStore({
              baseUrl: publicBase,
              fetch: http.fetch,
            }),
            reportsPublicBaseUrl: publicBase,
          }
        : {}),
      notebookStore: createBrowserObjectStore({ baseDir: 'sql-notebooks' }),
    },
  };
}
