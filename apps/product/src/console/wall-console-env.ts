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
  const productTestsBase =
    import.meta.env.VITE_PRODUCT_TESTS_PUBLIC_BASE_URL?.trim();
  const publicBase = productTestsBase || '/product-tests';
  const staticProductTests = !import.meta.env.DEV || Boolean(productTestsBase);
  const snapshotStore = createBrowserObjectStore({
    baseDir: 'product-simulator-snapshots',
  });
  return {
    i18n,
    createId: () => crypto.randomUUID(),
    random: () => Math.random(),
    ports: {
      clock: wallClock,
      timers: wallTimers,
      fetch: http.fetch,
      async bootProductSimulator(options) {
        const { bootProductSimulatorSession } = await import(
          './product-simulator/boot-product-simulator'
        );
        return bootProductSimulatorSession(
          { clock: wallClock, timers: wallTimers, snapshotStore },
          options
        );
      },
      ...(staticProductTests
        ? {
            productTestsStore: createStaticObjectStore({
              baseUrl: publicBase,
              fetch: http.fetch,
            }),
            productTestsPublicBaseUrl: publicBase,
          }
        : {}),
      notebookStore: createBrowserObjectStore({ baseDir: 'sql-notebooks' }),
    },
  };
}
