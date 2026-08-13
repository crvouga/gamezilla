import type {
  SimulationReporter,
  SimulationStepKind,
} from '@pkgs/simulation-report';
import type {
  AssertionOptions,
  Driver,
  DriverKey,
  ScrollDirection,
  UiWaitOptions,
  WaitPollOptions,
  WaitState,
} from '@pkgs/ui-testing';
import { formatTestId } from '@pkgs/ui-testing';

import type { EventLog, SimulationEventKind } from '../events';

type RecordMeta = {
  readonly testId?: string;
  readonly detail?: string;
  readonly snapshotBefore?: boolean;
  /** Skip HTML snapshot (typing floods reports and is slow under load). */
  readonly skipSnapshot?: boolean;
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
    readonly events?: EventLog;
  }
): Driver {
  const record = makeRecorder(driver, args.actorId, args.reporter, args.events);
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
          skipSnapshot: true,
        }
      ),
    clear: (testId) =>
      record(
        'clearText',
        `clearText ${formatTestId(testId)}`,
        () => driver.clear(testId),
        { testId, skipSnapshot: true }
      ),
    key: (key: DriverKey) =>
      record('pressKey', `pressKey ${key}`, () => driver.key(key), {
        detail: key,
      }),
    scroll: (testId, direction: ScrollDirection, amount?) =>
      recordScroll({ record, driver, testId, direction, amount }),
    wait: (testId, state: WaitState, options?: WaitPollOptions) =>
      record(
        'waitFor',
        `waitFor ${state} ${formatTestId(testId)}`,
        () => driver.wait(testId, state, options),
        { testId, detail: state, pollFrames: true }
      ),
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
  reporter: SimulationReporter,
  events?: EventLog
): Recorder {
  return async (kind, title, run, meta) => {
    events?.append({
      kind: stepKindToEvent(kind),
      nodeId: actorId,
      title,
      ...(meta?.detail !== undefined ? { detail: meta.detail } : {}),
    });
    await reporter.record({
      actorId,
      kind,
      title,
      ...(meta?.testId !== undefined
        ? { selector: formatTestId(meta.testId) }
        : {}),
      ...(meta?.detail !== undefined ? { detail: meta.detail } : {}),
      ...(meta?.snapshotBefore === true ? { snapshotBefore: true } : {}),
      ...(meta?.skipSnapshot === true ? { skipSnapshot: true } : {}),
      ...(meta?.pollFrames !== undefined
        ? { pollFrames: meta.pollFrames }
        : {}),
      run,
      snapshot: (options) => driver.snapshotHtml(options),
    });
  };
}

function stepKindToEvent(kind: SimulationStepKind): SimulationEventKind {
  switch (kind) {
    case 'tap':
      return 'ui.tap';
    case 'tapAt':
      return 'ui.tapAt';
    case 'typeText':
      return 'ui.typeText';
    case 'clearText':
      return 'ui.clearText';
    case 'pressKey':
      return 'ui.pressKey';
    case 'scroll':
      return 'ui.scroll';
    case 'waitFor':
      return 'ui.waitFor';
    case 'launch':
      return 'ui.launch';
    case 'close':
      return 'ui.close';
    case 'step':
      return 'ui.step';
    case 'navigateBack':
      return 'ui.navigateBack';
    case 'nav.open':
      return 'ui.nav.open';
    default:
      return 'ui.step';
  }
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
