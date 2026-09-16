/**
 * @pkgs/ui-testing — application-agnostic cross-platform UI testing core.
 *
 * Primary surface:
 * - {@link Driver} / {@link DriverNode} (`tap`, `wait`, nested `expect.*`)
 * - {@link RenderedApp} mounted-tree port
 * - reporting: {@link recordingDriver} (ops → report steps), {@link UiOp}
 * - selector / explore / wait primitives
 *
 * Drivers ship as their own packages (`@pkgs/ui-testing-solid-dom`,
 * `@pkgs/ui-testing-bun-webview`) so a suite only loads the platform it drives.
 */

export type {
  HostNode,
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
export {
  describeUiOp,
  NO_RECORDER,
  nodeAtPath,
  performUiOp,
  type RecordingDriverOptions,
  recordingDriver,
  type StepRecorder,
  type UiOp,
} from './report';
export { formatTestId, formatTestIdPath } from './selector/format';
export {
  type TestIdSelector,
  testIdSelector,
} from './selector/selector';
