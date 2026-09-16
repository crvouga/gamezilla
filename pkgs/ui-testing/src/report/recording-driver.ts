/**
 * Report-aware {@link Driver}: every user-intent op (`tap`, `input`,
 * `expect.*`, …) becomes one report step with its selector, so a run's
 * timeline reads like the test script and each step carries a UI frame.
 */

import type { DriverKey } from '../core/keys';
import type {
  AssertionOptions,
  Driver,
  DriverNode,
  DriverWaitOptions,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '../driver/driver';
import { isWaitTextCondition } from '../driver/driver';
import { hasInventory } from '../explore/inventory';
import { formatTestIdPath } from '../selector/format';
import type { StepRecorder } from './step-recorder';

export type RecordingDriverOptions = {
  readonly recorder: StepRecorder;
  /** Actor label attached to every step (multi-actor sims). */
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
};

function step<T>(ctx: Ctx, info: StepInfo, fn: () => Promise<T>): Promise<T> {
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

function recordingNode(node: DriverNode, ctx: Ctx): DriverNode {
  return {
    get: (testId: string) =>
      recordingNode(node.get(testId), { ...ctx, path: [...ctx.path, testId] }),
    tap: (options?: UiWaitOptions) =>
      step(ctx, ui('tap'), () => node.tap(options)),
    tapAt: (position: TapPosition) =>
      step(ctx, ui('tapAt', ratio(position)), () => node.tapAt(position)),
    drag: (from: TapPosition, to: TapPosition) =>
      step(ctx, ui('drag', `${ratio(from)} → ${ratio(to)}`), () =>
        node.drag(from, to)
      ),
    layout: () => node.layout(),
    input: (text: string, options?: UiWaitOptions) =>
      step(ctx, ui(`input ${JSON.stringify(text)}`), () =>
        node.input(text, options)
      ),
    clear: () => step(ctx, ui('clear'), () => node.clear()),
    key: (key: DriverKey) => step(ctx, ui(`key ${key}`), () => node.key(key)),
    scroll: (direction: ScrollDirection, amount?: number) =>
      step(ctx, ui(`scroll ${direction}`), () =>
        node.scroll(direction, amount)
      ),
    wait: (state: WaitState | WaitTextCondition, options?: DriverWaitOptions) =>
      step(ctx, check(`wait ${describeWait(state)}`), () =>
        node.wait(state, options)
      ),
    expect: recordingExpect(node, ctx),
    isVisible: () => node.isVisible(),
    text: () => node.text(),
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
      step(rootCtx([]), ui(`key ${key}`), () => driver.key(key)),
    snapshotHtml: (snapshotOptions) => driver.snapshotHtml(snapshotOptions),
  };
  if (hasInventory(driver)) {
    return Object.assign(wrapped, { inventory: () => driver.inventory() });
  }
  return wrapped;
}
