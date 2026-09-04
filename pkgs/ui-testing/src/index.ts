/**
 * @pkgs/ui-testing — application-agnostic cross-platform UI testing core.
 *
 * Primary surface:
 * - {@link Driver} / {@link DriverNode} (`tap`, `wait`, nested `expect.*`)
 * - {@link AppHarness} bootstrap port
 * - selector / explore / wait primitives
 *
 * Drivers ship as their own packages (`@pkgs/ui-testing-rntl`,
 * `@pkgs/ui-testing-bun-webview`, `@pkgs/ui-testing-detox`) so a suite only
 * loads the platform it drives. Suites run under `bun:test`.
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
export { formatTestId, formatTestIdPath } from './selector/format';
export {
  type TestIdSelector,
  testIdSelector,
} from './selector/selector';
