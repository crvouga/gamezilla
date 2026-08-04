import type { AppHarness } from '../bootstrap/app-harness';
import type { RenderAdapter } from '../bootstrap/render-adapter';
import {
  DetoxDriver,
  type DetoxDriverOptions,
} from '../drivers/detox/detox-driver';
import {
  InProcessDriver,
  type InProcessDriverOptions,
} from '../drivers/in-process/in-process-driver';
import {
  PlaywrightDriver,
  type PlaywrightDriverOptions,
} from '../drivers/playwright/playwright-driver';
import type { Driver } from './driver';

export type InProcessDriverConfig<TContext = void> = {
  kind: 'in-process';
  harness: AppHarness<TContext>;
  renderer?: RenderAdapter;
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
  | InProcessDriverConfig<TContext>
  | PlaywrightDriverConfig
  | DetoxDriverConfig;

/** Create a {@link Driver} from a discriminated config. */
export function createDriver<TContext = void>(
  config: DriverConfig<TContext>
): Driver {
  switch (config.kind) {
    case 'in-process':
      return new InProcessDriver(
        config as InProcessDriverOptions<TContext>
      );
    case 'playwright':
      return new PlaywrightDriver(config);
    case 'detox':
      return new DetoxDriver(config);
  }
}
