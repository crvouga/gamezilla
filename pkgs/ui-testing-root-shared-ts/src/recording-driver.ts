/**
 * A {@link Driver} that hands every user-intent op (`tap`, `input`,
 * `expect.*`, …) to a {@link StepRecorder} with its title and selector, so
 * the recorder can log, time or veto what the driver was asked to do.
 */

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
import type { StepMeta, StepRecorder } from './step-recorder';

export type RecordingDriverOptions = {
  readonly recorder: StepRecorder;
};

type Ctx = RecordingDriverOptions & { readonly path: readonly string[] };

function describeWait(
  state: WaitState | WaitTextCondition,
  options?: DriverWaitOptions
): string {
  if (isWaitTextCondition(state)) {
    return `${state.exact === false ? 'contains' : 'text'} ${JSON.stringify(state.text)}`;
  }
  if (state !== 'enabled' && options?.visibleOr !== undefined)
    return `${state} or visible ${JSON.stringify(options.visibleOr)}`;
  return state;
}

function ratio(p: TapPosition): string {
  return `${p.xRatio.toFixed(2)},${p.yRatio.toFixed(2)}`;
}

type StepInfo = Omit<StepMeta, 'selector'>;

function step<T>(ctx: Ctx, info: StepInfo, fn: () => Promise<T>): Promise<T> {
  return ctx.recorder.record(
    { ...info, selector: formatTestIdPath(ctx.path) },
    fn
  );
}

const ui = (title: string, detail?: string): StepInfo => ({
  kind: 'ui',
  title,
  ...(detail !== undefined ? { detail } : {}),
});
const check = (title: string, detail?: string): StepInfo => ({
  kind: 'expect',
  title,
  ...(detail !== undefined ? { detail } : {}),
});

function recordingExpect(node: DriverNode, ctx: Ctx): DriverNode['expect'] {
  return {
    visible: (options?: AssertionOptions) =>
      step(ctx, check('expect visible'), () => node.expect.visible(options)),
    hidden: (options?: AssertionOptions) =>
      step(ctx, check('expect hidden'), () => node.expect.hidden(options)),
    text: (
      expected: string,
      options?: AssertionOptions & { exact?: boolean }
    ) =>
      step(
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
      step(ctx, ui('tap'), () => node.tap(options)),
    tapAt: (position: TapPosition, options?: GestureOptions) =>
      step(ctx, ui(gestureTitle('tapAt', options), ratio(position)), () =>
        node.tapAt(position, options)
      ),
    drag: (from: TapPosition, to: TapPosition, options?: GestureOptions) =>
      step(
        ctx,
        ui(gestureTitle('drag', options), `${ratio(from)} → ${ratio(to)}`),
        () => node.drag(from, to, options)
      ),
    layout: () => node.layout(),
    input: (text: string, options?: UiWaitOptions) =>
      step(ctx, ui(`input ${JSON.stringify(text)}`), () =>
        node.input(text, options)
      ),
    clear: () => step(ctx, ui('clear'), () => node.clear()),
    selectFile: (file) =>
      step(ctx, ui(`select file ${file.name}`), () => node.selectFile(file)),
    key: (key, phase) =>
      step(ctx, ui(`${phase ?? 'key'} ${key}`), () => node.key(key, phase)),
    scroll: (direction: ScrollDirection, amount?: number) =>
      step(ctx, ui(`scroll ${direction}`), () =>
        node.scroll(direction, amount)
      ),
    wait: (state: WaitState | WaitTextCondition, options?: DriverWaitOptions) =>
      step(ctx, check(`wait ${describeWait(state, options)}`), () =>
        node.wait(state, options)
      ),
    expect: recordingExpect(node, ctx),
    isVisible: () => node.isVisible(),
    text: () => node.text(),
    attribute: (name) => node.attribute(name),
  };
}

/**
 * Wrap a driver so its ops go through the recorder. Reads (`isVisible`, `text`,
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
      step(rootCtx([]), ui(`key ${key}`), () => driver.key(key)),
    snapshotHtml: (snapshotOptions) => driver.snapshotHtml(snapshotOptions),
  };
  if (hasInventory(driver)) {
    return Object.assign(wrapped, { inventory: () => driver.inventory() });
  }
  return wrapped;
}
