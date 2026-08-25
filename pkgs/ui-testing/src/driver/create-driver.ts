import type { Timers } from '@pkgs/clock';
import type { AppHarness } from '../bootstrap/app-harness';
import type { RenderAdapter } from '../bootstrap/render-adapter';
import type { WaitPump } from '../core/wait';
import {
  DetoxDriver,
  type DetoxDriverOptions,
} from '../drivers/detox/detox-driver';
import {
  PlaywrightDriver,
  type PlaywrightDriverOptions,
} from '../drivers/playwright/playwright-driver';
import type { RntlDriverOptions } from '../drivers/rntl/rntl-driver';
import type { Driver } from './driver';

export type RntlDriverConfig<TContext = void> = {
  kind: 'rntl';
  harness: AppHarness<TContext>;
  renderer?: RenderAdapter;
  readonly now: () => number;
  readonly timers: Timers;
  readonly pump?: WaitPump;
};

export type PlaywrightDriverConfig = {
  kind: 'playwright';
} & PlaywrightDriverOptions;

export type DetoxDriverConfig = {
  kind: 'detox';
} & DetoxDriverOptions;

/**
 * Discriminated union of driver configs. Adding Maestro / Appium / Cypress
 * later means adding a member here + a factory branch — no other public API
 * change.
 */
export type DriverConfig<TContext = void> =
  | RntlDriverConfig<TContext>
  | PlaywrightDriverConfig
  | DetoxDriverConfig;

/** Create a {@link Driver} from a discriminated config. */
export function createDriver<TContext = void>(
  config: DriverConfig<TContext>
): Driver {
  switch (config.kind) {
    case 'rntl': {
      // Lazy: playwright/detox bun tests must not load react-native.
      const { RntlDriver } =
        require('../drivers/rntl/rntl-driver') as typeof import('../drivers/rntl/rntl-driver');
      return new RntlDriver(config as RntlDriverOptions<TContext>);
    }
    case 'playwright':
      return new PlaywrightDriver(config);
    case 'detox':
      return new DetoxDriver(config);
  }
}
