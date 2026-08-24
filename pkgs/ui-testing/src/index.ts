/**
 * @pkgs/ui-testing — application-agnostic cross-platform UI testing framework.
 *
 * Primary surface:
 * - {@link Driver} / {@link createDriver}
 * - Nested `driver.expect.visible` / `hidden` / `text` (testId strings)
 * - {@link AppHarness} bootstrap port
 *
 * Drivers live under `@pkgs/ui-testing/drivers/...` for direct construction
 * when the factory is too coarse.
 */

export type { AssertionOptions } from './assertions/driver-expect';
export type { AppHarness } from './bootstrap/app-harness';
export type {
  HostNode,
  RenderAdapter,
  RenderedApp,
} from './bootstrap/render-adapter';
export {
  ElementNotFoundError,
  NotImplementedError,
  TimeoutError,
  UiTestError,
} from './core/errors';
export { DRIVER_KEY_TO_DOM, type DriverKey } from './core/keys';
export {
  type WaitOptions,
  type WaitPollOptions,
  waitUntil,
} from './core/wait';
export {
  createDriver,
  type DetoxDriverConfig,
  type DriverConfig,
  type InProcessDriverConfig,
  type PlaywrightDriverConfig,
} from './driver/create-driver';
export type {
  Driver,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
} from './driver/driver';
export {
  DetoxDriver,
  type DetoxDriverOptions,
  type DetoxLike,
} from './drivers/detox/detox-driver';
export {
  InProcessDriver,
  type InProcessDriverOptions,
} from './drivers/in-process/in-process-driver';
export {
  createRenderedAppFromRntl,
  createRenderedAppFromQueryScope,
  createRntlRenderAdapter,
} from './drivers/in-process/renderer-rntl';
export {
  createMultiAppRntlSession,
  type MultiAppRntlSession,
  type MultiAppRntlSessionOptions,
} from './drivers/in-process/multi-app-rntl-session';
export {
  actorShellTestId,
  MULTI_APP_ACTOR_SHELL_PREFIX,
  MULTI_APP_HOST_TEST_ID,
  MultiAppHost,
} from './drivers/in-process/multi-app-rntl-host';
export {
  type SerializeHostTreeHtmlOptions,
  SNAPSHOT_SHELL_CSS,
  serializeHostTreeHtml,
} from './drivers/in-process/serialize-host-tree-html';
export {
  PlaywrightDriver,
  type PlaywrightDriverOptions,
} from './drivers/playwright/playwright-driver';
export { formatTestId } from './selector/format';
export {
  type TestIdSelector,
  testIdSelector,
} from './selector/selector';
