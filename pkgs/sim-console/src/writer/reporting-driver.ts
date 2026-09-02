import type {
  AssertionOptions,
  Driver,
  DriverKey,
  DriverNode,
  DriverWaitOptions,
  ScrollDirection,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing';
import { formatTestIdPath } from '@pkgs/ui-testing';

import type { SimulationStepKind } from '../types';
import type { SimulationReporter } from './reporter';

type RecordMeta = {
  readonly testIdPath?: readonly string[];
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
 * Does not record `isVisible` / `text` (avoids poll flooding).
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
    get: (testId) => wrapNode(driver.get(testId), [testId], record),
    key: (key: DriverKey) =>
      record('pressKey', `pressKey ${key}`, () => driver.key(key), {
        detail: key,
      }),
    snapshotHtml: (options) => driver.snapshotHtml(options),
  };
}

function wrapNode(
  node: DriverNode,
  path: readonly string[],
  record: Recorder
): DriverNode {
  const selector = formatTestIdPath(path);
  return {
    get: (testId) => wrapNode(node.get(testId), [...path, testId], record),
    tap: (options?: UiWaitOptions) =>
      record('tap', `tap ${selector}`, () => node.tap(options), {
        testIdPath: path,
      }),
    tapAt: (position) =>
      record('tapAt', `tapAt ${selector}`, () => node.tapAt(position), {
        testIdPath: path,
        detail: `xRatio=${position.xRatio}, yRatio=${position.yRatio}`,
      }),
    drag: (from, to) =>
      record('drag', `drag ${selector}`, () => node.drag(from, to), {
        testIdPath: path,
        detail: `from=${from.xRatio},${from.yRatio} to=${to.xRatio},${to.yRatio}`,
      }),
    layout: () => node.layout(),
    input: (text, options?: UiWaitOptions) =>
      record(
        'typeText',
        `typeText ${selector}`,
        () => node.input(text, options),
        {
          testIdPath: path,
          detail: `text=${JSON.stringify(text)}`,
        }
      ),
    clear: () =>
      record('clearText', `clearText ${selector}`, () => node.clear(), {
        testIdPath: path,
      }),
    key: (key: DriverKey) =>
      record('pressKey', `pressKey ${key}`, () => node.key(key), {
        testIdPath: path,
        detail: key,
      }),
    scroll: (direction: ScrollDirection, amount?) =>
      recordScroll({ record, node, path, direction, amount }),
    wait: (
      state: WaitState | WaitTextCondition,
      options?: DriverWaitOptions
    ) => {
      if ((options?.timeoutMs ?? Number.POSITIVE_INFINITY) <= 150) {
        return node.wait(state, options);
      }
      return record(
        'waitFor',
        `waitFor ${waitDetail(state)} ${selector}`,
        () => node.wait(state, options),
        { testIdPath: path, detail: waitDetail(state), pollFrames: true }
      );
    },
    expect: createExpectRecorder(node, path, record),
    isVisible: () => node.isVisible(),
    text: () => node.text(),
  };
}

function createExpectRecorder(
  node: DriverNode,
  path: readonly string[],
  record: Recorder
): DriverNode['expect'] {
  const selector = formatTestIdPath(path);
  return {
    visible: (options?: AssertionOptions) =>
      record(
        'waitFor',
        `expect.visible ${selector}`,
        () => node.expect.visible(options),
        { testIdPath: path, detail: 'visible', pollFrames: true }
      ),
    hidden: (options?: AssertionOptions) =>
      record(
        'waitFor',
        `expect.hidden ${selector}`,
        () => node.expect.hidden(options),
        { testIdPath: path, detail: 'hidden', pollFrames: true }
      ),
    text: (expected, options?) =>
      record(
        'waitFor',
        `expect.text ${selector}`,
        () => node.expect.text(expected, options),
        {
          testIdPath: path,
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
      ...(meta?.testIdPath !== undefined
        ? { selector: formatTestIdPath(meta.testIdPath) }
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
  readonly node: DriverNode;
  readonly path: readonly string[];
  readonly direction: ScrollDirection;
  readonly amount: number | undefined;
}): Promise<void> {
  const { record, node, path, direction, amount } = args;
  const selector = formatTestIdPath(path);
  const detail =
    amount !== undefined
      ? `direction=${direction}, amount=${amount}`
      : `direction=${direction}`;
  return record(
    'scroll',
    `scroll ${selector} ${direction}`,
    () => node.scroll(direction, amount),
    { testIdPath: path, detail }
  );
}

function waitDetail(state: WaitState | WaitTextCondition): string {
  if (typeof state === 'string') return state;
  return `text=${JSON.stringify(state.text)}`;
}
