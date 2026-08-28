import type {
  AssertionOptions,
  Driver,
  DriverKey,
  DriverWaitOptions,
  ScrollDirection,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing';
import { formatTestId } from '@pkgs/ui-testing';

import type { SimulationStepKind } from '../types';
import type { SimulationReporter } from './reporter';

type RecordMeta = {
  readonly testId?: string;
  readonly detail?: string;
  readonly snapshotBefore?: boolean;
  readonly pollFrames?: boolean;
};

type Recorder = (
  kind: SimulationStepKind,
  title: string,
  run: () => Promise<void>,
  meta?: RecordMeta
) => Promise<void>;

/**
 * Proxy that records mutating / wait driver ops into a {@link SimulationReporter}.
 * Does not record `isVisible` / `getText` (avoids poll flooding).
 */
export function createReportingDriver(
  driver: Driver,
  args: {
    readonly actorId: string;
    readonly reporter: SimulationReporter;
  }
): Driver {
  const record = makeRecorder(driver, args.actorId, args.reporter);
  return {
    kind: driver.kind,
    launch: () => record('launch', 'launch', () => driver.launch()),
    close: () =>
      record('close', 'close', () => driver.close(), { snapshotBefore: true }),
    tap: (testId, options?: UiWaitOptions) =>
      record(
        'tap',
        `tap ${formatTestId(testId)}`,
        () => driver.tap(testId, options),
        { testId }
      ),
    tapAt: (testId, position) =>
      record(
        'tapAt',
        `tapAt ${formatTestId(testId)}`,
        () => driver.tapAt(testId, position),
        {
          testId,
          detail: `xRatio=${position.xRatio}, yRatio=${position.yRatio}`,
        }
      ),
    input: (testId, text, options?: UiWaitOptions) =>
      record(
        'typeText',
        `typeText ${formatTestId(testId)}`,
        () => driver.input(testId, text, options),
        {
          testId,
          detail: `text=${JSON.stringify(text)}`,
        }
      ),
    clear: (testId) =>
      record(
        'clearText',
        `clearText ${formatTestId(testId)}`,
        () => driver.clear(testId),
        { testId }
      ),
    key: (key: DriverKey) =>
      record('pressKey', `pressKey ${key}`, () => driver.key(key), {
        detail: key,
      }),
    scroll: (testId, direction: ScrollDirection, amount?) =>
      recordScroll({ record, driver, testId, direction, amount }),
    wait: (
      testId,
      state: WaitState | WaitTextCondition,
      options?: DriverWaitOptions
    ) => {
      // Short probe waits (search/space hit loops) are caught and retried by
      // product drivers. Recording each miss as a failed step marks the whole
      // report FAILED while Jest still passes — skip probes in the timeline.
      if ((options?.timeoutMs ?? Number.POSITIVE_INFINITY) <= 150) {
        return driver.wait(testId, state, options);
      }
      return record(
        'waitFor',
        `waitFor ${waitDetail(state)} ${formatTestId(testId)}`,
        () => driver.wait(testId, state, options),
        { testId, detail: waitDetail(state), pollFrames: true }
      );
    },
    expect: createExpectRecorder(driver, record),
    isVisible: (testId) => driver.isVisible(testId),
    getText: (testId) => driver.getText(testId),
    snapshotHtml: (options) => driver.snapshotHtml(options),
  };
}

function createExpectRecorder(
  driver: Driver,
  record: Recorder
): Driver['expect'] {
  return {
    visible: (testId, options?: AssertionOptions) =>
      record(
        'waitFor',
        `expect.visible ${formatTestId(testId)}`,
        () => driver.expect.visible(testId, options),
        { testId, detail: 'visible', pollFrames: true }
      ),
    hidden: (testId, options?: AssertionOptions) =>
      record(
        'waitFor',
        `expect.hidden ${formatTestId(testId)}`,
        () => driver.expect.hidden(testId, options),
        { testId, detail: 'hidden', pollFrames: true }
      ),
    text: (testId, expected, options?) =>
      record(
        'waitFor',
        `expect.text ${formatTestId(testId)}`,
        () => driver.expect.text(testId, expected, options),
        {
          testId,
          detail: `text=${JSON.stringify(expected)}`,
          pollFrames: true,
        }
      ),
  };
}

function makeRecorder(
  driver: Driver,
  actorId: string,
  reporter: SimulationReporter
): Recorder {
  return async (kind, title, run, meta) => {
    await reporter.record({
      actorId,
      kind,
      title,
      ...(meta?.testId !== undefined
        ? { selector: formatTestId(meta.testId) }
        : {}),
      ...(meta?.detail !== undefined ? { detail: meta.detail } : {}),
      ...(meta?.snapshotBefore === true ? { snapshotBefore: true } : {}),
      ...(meta?.pollFrames !== undefined
        ? { pollFrames: meta.pollFrames }
        : {}),
      run,
      snapshot: (options) => driver.snapshotHtml(options),
    });
  };
}

function recordScroll(args: {
  readonly record: Recorder;
  readonly driver: Driver;
  readonly testId: string;
  readonly direction: ScrollDirection;
  readonly amount: number | undefined;
}): Promise<void> {
  const { record, driver, testId, direction, amount } = args;
  const detail =
    amount !== undefined
      ? `direction=${direction}, amount=${amount}`
      : `direction=${direction}`;
  return record(
    'scroll',
    `scroll ${formatTestId(testId)} ${direction}`,
    () => driver.scroll(testId, direction, amount),
    { testId, detail }
  );
}

function waitDetail(state: WaitState | WaitTextCondition): string {
  if (typeof state === 'string') return state;
  return `text=${JSON.stringify(state.text)}`;
}
