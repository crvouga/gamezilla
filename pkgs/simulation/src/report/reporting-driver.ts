import type {
  SimulationReporter,
  SimulationStepKind,
} from '@pkgs/simulation-report';
import type {
  Driver,
  DriverKey,
  ScrollDirection,
  Selector,
  WaitPollOptions,
  WaitState,
} from '@pkgs/ui-testing';
import { formatSelector } from '@pkgs/ui-testing';

type RecordMeta = {
  readonly selector?: Selector;
  readonly detail?: string;
  readonly snapshotBefore?: boolean;
  /** Skip HTML snapshot (typing floods reports and is slow under load). */
  readonly skipSnapshot?: boolean;
  readonly pollFrames?: boolean;
};

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
    tap: (target) =>
      record('tap', `tap ${formatSelector(target)}`, () => driver.tap(target), {
        selector: target,
      }),
    tapAt: (target, position) =>
      record(
        'tapAt',
        `tapAt ${formatSelector(target)}`,
        () => driver.tapAt(target, position),
        {
          selector: target,
          detail: `xRatio=${position.xRatio}, yRatio=${position.yRatio}`,
        }
      ),
    typeText: (target, text) =>
      record(
        'typeText',
        `typeText ${formatSelector(target)}`,
        () => driver.typeText(target, text),
        {
          selector: target,
          detail: `text=${JSON.stringify(text)}`,
          skipSnapshot: true,
        }
      ),
    clearText: (target) =>
      record(
        'clearText',
        `clearText ${formatSelector(target)}`,
        () => driver.clearText(target),
        { selector: target, skipSnapshot: true }
      ),
    pressKey: (key: DriverKey) =>
      record('pressKey', `pressKey ${key}`, () => driver.pressKey(key), {
        detail: key,
      }),
    scroll: (target, direction: ScrollDirection, amount?) =>
      recordScroll({ record, driver, target, direction, amount }),
    navigateBack: () =>
      record('navigateBack', 'navigateBack', () => driver.navigateBack()),
    waitFor: (target, state: WaitState, options?: WaitPollOptions) =>
      record(
        'waitFor',
        `waitFor ${state} ${formatSelector(target)}`,
        () => driver.waitFor(target, state, options),
        { selector: target, detail: state, pollFrames: true }
      ),
    isVisible: (target) => driver.isVisible(target),
    getText: (target) => driver.getText(target),
    snapshotHtml: (options) => driver.snapshotHtml(options),
  };
}

type Recorder = (
  kind: SimulationStepKind,
  title: string,
  run: () => Promise<void>,
  meta?: RecordMeta
) => Promise<void>;

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
      ...(meta?.selector !== undefined
        ? { selector: formatSelector(meta.selector) }
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

function recordScroll(args: {
  readonly record: Recorder;
  readonly driver: Driver;
  readonly target: Selector;
  readonly direction: ScrollDirection;
  readonly amount: number | undefined;
}): Promise<void> {
  const { record, driver, target, direction, amount } = args;
  const detail =
    amount !== undefined
      ? `direction=${direction}, amount=${amount}`
      : `direction=${direction}`;
  return record(
    'scroll',
    `scroll ${formatSelector(target)} ${direction}`,
    () => driver.scroll(target, direction, amount),
    { selector: target, detail }
  );
}

export async function recordNavOpen(
  reporter: SimulationReporter,
  args: {
    readonly actorId: string;
    readonly path: string;
    readonly open: () => Promise<void>;
    readonly snapshot: (options?: {
      readonly stylesheetHref?: string;
    }) => Promise<string | null>;
  }
): Promise<void> {
  await reporter.record({
    actorId: args.actorId,
    kind: 'nav.open',
    title: `open ${args.path}`,
    detail: args.path,
    run: args.open,
    snapshot: args.snapshot,
  });
}
