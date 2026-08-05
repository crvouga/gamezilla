/**
 * @pkgs/ui-testing — application-agnostic cross-platform UI testing framework.
 *
 * Primary surface:
 * - {@link Driver} / {@link createDriver}
 * - {@link by} selectors
 * - {@link expectVisible} / {@link expectHidden} / {@link expectText}
 * - {@link AppHarness} bootstrap port
 *
 * Drivers live under `@pkgs/ui-testing/drivers/...` for direct construction
 * when the factory is too coarse.
 */

export type {
  Driver,
  ScrollDirection,
  TapPosition,
  WaitState,
} from './driver/driver';
export {
  createDriver,
  type DetoxDriverConfig,
  type DriverConfig,
  type InProcessDriverConfig,
  type PlaywrightDriverConfig,
} from './driver/create-driver';

export {
  by,
  first,
  nth,
  type Selector,
  type SelectorRole,
} from './selector/selector';
export { formatSelector } from './selector/format';

export {
  expectHidden,
  expectText,
  expectVisible,
  type AssertionOptions,
} from './assertions/assertions';

export type { AppHarness } from './bootstrap/app-harness';
export type {
  RenderAdapter,
  RenderedApp,
} from './bootstrap/render-adapter';

export {
  ElementNotFoundError,
  NotImplementedError,
  TimeoutError,
  UiTestError,
} from './core/errors';
export { waitUntil, type WaitOptions } from './core/wait';
export { DRIVER_KEY_TO_DOM, type DriverKey } from './core/keys';

export {
  InProcessDriver,
  type InProcessDriverOptions,
} from './drivers/in-process/in-process-driver';
export { createDomRenderAdapter } from './drivers/in-process/renderer-dom';
export {
  PlaywrightDriver,
  type PlaywrightDriverOptions,
} from './drivers/playwright/playwright-driver';
export {
  DetoxDriver,
  type DetoxDriverOptions,
  type DetoxLike,
} from './drivers/detox/detox-driver';
