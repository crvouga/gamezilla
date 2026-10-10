/**
 * Report-aware {@link Driver}: every user-intent op (`tap`, `input`,
 * `expect.*`, …) becomes one report step with its selector + press hit, so a
 * run's timeline reads like the test script and each UI step carries a frame
 * with the gesture target encoded for the HTML viewer.
 */

import type { ReportStepHit } from '@crvouga/atlas-reports/report-types';
import type {
  AssertionOptions,
  Driver,
  DriverNode,
  DriverWaitOptions,
  GestureOptions,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from './driver';
import { isWaitTextCondition } from './driver';
import { formatTestIdPath } from './format';
import { hasInventory } from './inventory';
import type { DriverKey } from './keys';
import type { StepRecorder } from './step-recorder';

export type RecordingDriverOptions = {
  readonly recorder: StepRecorder;
  /** Actor label attached to every step (multi-actor harnesses). */
  readonly actorId?: string;
};

type Ctx = RecordingDriverOptions & { readonly path: readonly string[] };

function describeWait(state: WaitState | WaitTextCondition): string {
  if (isWaitTextCondition(state)) {
    return `${state.exact === false ? 'contains' : 'text'} ${JSON.stringify(state.text)}`;
  }
  return state;
}

function ratio(p: TapPosition): string {
  return `${p.xRatio.toFixed(2)},${p.yRatio.toFixed(2)}`;
}

type StepInfo = {
  readonly kind: 'ui' | 'expect';
  readonly title: string;
  readonly detail?: string;
  readonly point?: TapPosition;
};

function hitFrom(path: readonly string[], point?: TapPosition): ReportStepHit {
  return {
    path: [...path],
    ...(point !== undefined
      ? { point: { xRatio: point.xRatio, yRatio: point.yRatio } }
      : {}),
  };
}

function stepWithHit<T>(
  ctx: Ctx,
  info: StepInfo,
  fn: () => Promise<T>
): Promise<T> {
  const hit = hitFrom(ctx.path, info.point);
  return ctx.recorder.record(
    {
      kind: info.kind,
      title: info.title,
      selector: formatTestIdPath(ctx.path),
      hit,
      // Capture while the target is still mounted (before tap navigates).
      ...(info.kind === 'ui' ? { snapshotBefore: true } : {}),
      ...(ctx.actorId !== undefined ? { actorId: ctx.actorId } : {}),
      ...(info.detail !== undefined ? { detail: info.detail } : {}),
    },
    fn
  );
}

function stepExpect<T>(
  ctx: Ctx,
  info: StepInfo,
  fn: () => Promise<T>
): Promise<T> {
  return ctx.recorder.record(
    {
      kind: info.kind,
      title: info.title,
      selector: formatTestIdPath(ctx.path),
      ...(ctx.actorId !== undefined ? { actorId: ctx.actorId } : {}),
      ...(info.detail !== undefined ? { detail: info.detail } : {}),
    },
    fn
  );
}

const ui = (title: string, detail?: string, point?: TapPosition): StepInfo => ({
  kind: 'ui',
  title,
  ...(detail !== undefined ? { detail } : {}),
  ...(point !== undefined ? { point } : {}),
});
const check = (title: string, detail?: string): StepInfo => ({
  kind: 'expect',
  title,
  ...(detail !== undefined ? { detail } : {}),
});

function recordingExpect(node: DriverNode, ctx: Ctx): DriverNode['expect'] {
  return {
    visible: (options?: AssertionOptions) =>
      stepExpect(ctx, check('expect visible'), () =>
        node.expect.visible(options)
      ),
    hidden: (options?: AssertionOptions) =>
      stepExpect(ctx, check('expect hidden'), () =>
        node.expect.hidden(options)
      ),
    text: (
      expected: string,
      options?: AssertionOptions & { exact?: boolean }
    ) =>
      stepExpect(
        ctx,
        check(
          `expect text ${JSON.stringify(expected)}`,
          options?.exact === false ? 'contains' : undefined
        ),
        () => node.expect.text(expected, options)
      ),
  };
}

function gestureTitle(op: string, options: GestureOptions | undefined): string {
  return options?.button === 'secondary' ? `${op} secondary` : op;
}

function recordingNode(node: DriverNode, ctx: Ctx): DriverNode {
  return {
    get: (testId: string) =>
      recordingNode(node.get(testId), { ...ctx, path: [...ctx.path, testId] }),
    tap: (options?: UiWaitOptions) =>
      stepWithHit(ctx, ui('tap'), () => node.tap(options)),
    tapAt: (position: TapPosition, options?: GestureOptions) =>
      stepWithHit(
        ctx,
        ui(gestureTitle('tapAt', options), ratio(position), position),
        () => node.tapAt(position, options)
      ),
    drag: (from: TapPosition, to: TapPosition, options?: GestureOptions) =>
      stepWithHit(
        ctx,
        ui(
          gestureTitle('drag', options),
          `${ratio(from)} → ${ratio(to)}`,
          from
        ),
        () => node.drag(from, to, options)
      ),
    layout: () => node.layout(),
    input: (text: string, options?: UiWaitOptions) =>
      stepWithHit(ctx, ui(`input ${JSON.stringify(text)}`), () =>
        node.input(text, options)
      ),
    clear: () => stepWithHit(ctx, ui('clear'), () => node.clear()),
    key: (key: DriverKey) =>
      stepWithHit(ctx, ui(`key ${key}`), () => node.key(key)),
    scroll: (direction: ScrollDirection, amount?: number) =>
      stepWithHit(ctx, ui(`scroll ${direction}`), () =>
        node.scroll(direction, amount)
      ),
    wait: (state: WaitState | WaitTextCondition, options?: DriverWaitOptions) =>
      stepExpect(ctx, check(`wait ${describeWait(state)}`), () =>
        node.wait(state, options)
      ),
    expect: recordingExpect(node, ctx),
    isVisible: () => node.isVisible(),
    text: () => node.text(),
    attribute: (name) => node.attribute(name),
  };
}

/**
 * Wrap a driver so its ops record report steps. Reads (`isVisible`, `text`,
 * `layout`, `snapshotHtml`) pass through unrecorded; explore `inventory`
 * is forwarded when the underlying driver supports it.
 */
export function recordingDriver(
  driver: Driver,
  options: RecordingDriverOptions
): Driver {
  const rootCtx = (path: readonly string[]): Ctx => ({ ...options, path });
  const wrapped: Driver = {
    kind: driver.kind,
    launch: () => driver.launch(),
    close: () => driver.close(),
    get: (testId: string) =>
      recordingNode(driver.get(testId), rootCtx([testId])),
    key: (key: DriverKey) =>
      stepExpect(rootCtx([]), ui(`key ${key}`), () => driver.key(key)),
    snapshotHtml: (snapshotOptions) => driver.snapshotHtml(snapshotOptions),
  };
  if (hasInventory(driver)) {
    return Object.assign(wrapped, { inventory: () => driver.inventory() });
  }
  return wrapped;
}
