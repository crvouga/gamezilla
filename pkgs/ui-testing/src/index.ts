/**
 * @pkgs/ui-testing — application-agnostic cross-platform UI testing framework.
 *
 * Primary surface:
 * - {@link Driver} / {@link createDriver}
 * - {@link Driver.get} → {@link DriverNode} (`tap`, `wait`, nested `expect.*`)
 * - {@link AppHarness} bootstrap port
 *
 * Drivers live under `@pkgs/ui-testing/drivers/...` for direct construction
 * when the factory is too coarse.
 */

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
  type WaitPump,
  type WaitUntilOptions,
  waitUntil,
} from './core/wait';
export {
  createDriver,
  type DetoxDriverConfig,
  type DriverConfig,
  type PlaywrightDriverConfig,
  type RntlDriverConfig,
} from './driver/create-driver';
export type {
  AssertionOptions,
  Driver,
  DriverNode,
  DriverWaitOptions,
  ElementLayout,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from './driver/driver';
export { isWaitTextCondition } from './driver/driver';
export {
  DetoxDriver,
  type DetoxDriverOptions,
  type DetoxLike,
} from './drivers/detox/detox-driver';
export {
  PlaywrightDriver,
  type PlaywrightDriverOptions,
} from './drivers/playwright/playwright-driver';
export {
  actorShellTestId,
  MULTI_APP_ACTOR_FRAME,
  MULTI_APP_ACTOR_SHELL_PREFIX,
  MULTI_APP_HOST_TEST_ID,
  MultiAppHost,
} from './drivers/rntl/multi-app-rntl-host';
export {
  createMultiAppRntlSession,
  type FocusedRenderedApp,
  type MultiAppRntlSession,
  type MultiAppRntlSessionOptions,
  type SnapshotAllActorsOptions,
} from './drivers/rntl/multi-app-rntl-session';
export {
  createRenderedAppFromQueryScope,
  createRenderedAppFromRntl,
  createRntlRenderAdapter,
} from './drivers/rntl/renderer-rntl';
export {
  RntlDriver,
  type RntlDriverOptions,
} from './drivers/rntl/rntl-driver';
export {
  type SerializeHostTreeHtmlOptions,
  SNAPSHOT_SHELL_CSS,
  serializeHostTreeHtml,
} from './drivers/rntl/serialize-host-tree-html';
export { describe } from './runner/describe';
export {
  createDetoxUiTestRunner,
  installDetoxUiTestRunner,
} from './runner/detox';
export {
  getUiTestBrowser,
  getUiTestHostState,
  runWithUiTestHostState,
  runWithUiTestHostStateAsync,
  type UiTestHostState,
} from './runner/host-state';
export {
  getUiTestRunner,
  installUiTestRunner,
} from './runner/install';
export {
  createJestUiTestRunner,
  installJestUiTestRunner,
} from './runner/jest';
export {
  createPlaywrightUiTestRunner,
  installPlaywrightUiTestRunner,
} from './runner/playwright';
export type {
  UiDriverKind,
  UiTestCtx,
  UiTestFidelity,
  UiTestHostHooks,
  UiTestRunner,
  UiTestRunnerConfig,
} from './runner/types';
export { formatTestId, formatTestIdPath } from './selector/format';
export {
  type TestIdSelector,
  testIdSelector,
} from './selector/selector';
