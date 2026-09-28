/** @jsxImportSource solid-js */
/**
 * In-process host: the harness mounts into happy-dom through
 * `@pkgs/ui-testing-solid-dom`, on a virtual clock the driver pumps.
 */

import { createHarnessClock } from '@pkgs/clock/harness-clock';
import {
  createSolidDomDriver,
  type SolidDomDriver,
} from '@pkgs/ui-testing-solid-dom';

import { ChessBoardHarnessApp } from '../harness/harness-app';
import type { HarnessConfig } from '../harness/harness-config';
import type { ChessBoardHost } from '../suite/board-host';

/** Let queued microtasks (sound `play()` after `await seekTo`) run. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

export function createDomHost(): ChessBoardHost {
  let driver: SolidDomDriver | undefined;
  let harness: ReturnType<typeof createHarnessClock> | undefined;
  return {
    name: 'happy-dom',
    async open(config: HarnessConfig) {
      await driver?.close();
      const clock = createHarnessClock();
      harness = clock;
      driver = createSolidDomDriver({
        clock: clock.clock,
        pump: async () => {
          clock.clock.advance(1);
          await flushMicrotasks();
        },
        harness: {
          createRoot: () => () => (
            <ChessBoardHarnessApp
              config={config}
              clock={clock.clock}
              timers={clock.timers}
            />
          ),
        },
      });
      await driver.launch();
      return driver;
    },
    async settle(ms: number) {
      await flushMicrotasks();
      harness?.clock.advance(ms);
      await flushMicrotasks();
    },
    async close() {
      await driver?.close();
      driver = undefined;
      harness = undefined;
    },
  };
}
