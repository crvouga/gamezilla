/**
 * A {@link Driver} whose every step is a {@link Run} step: mutations are
 * `run.apply` checkpoints, waits are `untilObserved` + `passTime`, reads are
 * `run.observe`. Nothing here touches the product surface — that is the
 * scenario system's job.
 */

import { type Run, untilObserved } from '@pkgs/dst';
import type {
  AssertionOptions,
  Driver,
  DriverKey,
  DriverNode,
  DriverWaitOptions,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing';
import { isWaitTextCondition } from '@pkgs/ui-testing';

import { passTime, type UiOp, uiOp } from '../scenario/actions';
import {
  actorHtml,
  nodeLayout,
  nodeText,
  visible,
} from '../scenario/observations';
import type { ProductSurface } from '../scenario/surface';

type Extra = UiOp['extra'];
type ProductRun = Run<ProductSurface>;

const DEFAULT_UI_WAIT_MS = 5_000;
const UI_STEP_MS = 50;

function extraOf(opts?: UiWaitOptions, more?: Extra): Extra {
  const timeoutMs = opts?.timeoutMs;
  return {
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...more,
  };
}

function maxMsOf(options?: { readonly timeoutMs?: number }): number {
  return options?.timeoutMs ?? DEFAULT_UI_WAIT_MS;
}

async function waitVisible(
  run: ProductRun,
  actorId: string,
  path: readonly string[],
  options?: DriverWaitOptions
): Promise<void> {
  await untilObserved(run, visible(actorId, path), passTime, {
    stepMs: UI_STEP_MS,
    maxMs: maxMsOf(options),
  });
}

async function waitHidden(
  run: ProductRun,
  actorId: string,
  path: readonly string[],
  options?: DriverWaitOptions
): Promise<void> {
  await untilObserved(run, visible(actorId, path), passTime, {
    stepMs: UI_STEP_MS,
    maxMs: maxMsOf(options),
    pred: (v) => v === false,
  });
}

async function waitText(args: {
  readonly run: ProductRun;
  readonly actorId: string;
  readonly path: readonly string[];
  readonly expected: string;
  readonly exact: boolean;
  readonly options?: DriverWaitOptions;
}): Promise<void> {
  await untilObserved(args.run, nodeText(args.actorId, args.path), passTime, {
    stepMs: UI_STEP_MS,
    maxMs: maxMsOf(args.options),
    pred: (v) => {
      if (typeof v !== 'string') return false;
      return args.exact ? v === args.expected : v.includes(args.expected);
    },
  });
}

function nodeExpect(
  run: ProductRun,
  actorId: string,
  path: readonly string[]
): DriverNode['expect'] {
  return {
    visible: (options?: AssertionOptions) =>
      waitVisible(run, actorId, path, options),
    hidden: (options?: AssertionOptions) =>
      waitHidden(run, actorId, path, options),
    text: (
      expected: string,
      options?: AssertionOptions & { exact?: boolean }
    ) =>
      waitText({
        run,
        actorId,
        path,
        expected,
        exact: options?.exact ?? true,
        options,
      }),
  };
}

function runWait(args: {
  readonly run: ProductRun;
  readonly actorId: string;
  readonly path: readonly string[];
  readonly state: WaitState | WaitTextCondition;
  readonly options?: DriverWaitOptions;
}): Promise<void> {
  if (!isWaitTextCondition(args.state)) {
    if (args.state === 'visible') {
      return waitVisible(args.run, args.actorId, args.path, args.options);
    }
    return waitHidden(args.run, args.actorId, args.path, args.options);
  }
  return waitText({
    run: args.run,
    actorId: args.actorId,
    path: args.path,
    expected: args.state.text,
    exact: args.state.exact ?? true,
    options: args.options,
  });
}

function wrapNode(
  run: ProductRun,
  actorId: string,
  path: readonly string[]
): DriverNode {
  const op = (name: string, extra: Extra) =>
    run.apply(uiOp, { actorId, op: name, path, extra });
  return {
    get: (testId) => wrapNode(run, actorId, [...path, testId]),
    tap: (options) => op('tap', extraOf(options)),
    tapAt: (position: TapPosition) =>
      op('tapAt', { xRatio: position.xRatio, yRatio: position.yRatio }),
    drag: (from, to) =>
      op('drag', {
        fromX: from.xRatio,
        fromY: from.yRatio,
        toX: to.xRatio,
        toY: to.yRatio,
      }),
    layout: () => run.observe(nodeLayout(actorId, path)),
    input: (text, options) => op('input', extraOf(options, { text })),
    clear: () => op('clear', {}),
    key: (key: DriverKey) => op('key', { key }),
    scroll: (direction: ScrollDirection, amount) =>
      op(
        'scroll',
        extraOf(undefined, {
          direction,
          ...(amount !== undefined ? { amount } : {}),
        })
      ),
    wait: (state, options) => runWait({ run, actorId, path, state, options }),
    expect: nodeExpect(run, actorId, path),
    isVisible: () => run.observe(visible(actorId, path)),
    text: () => run.observe(nodeText(actorId, path)),
  };
}

/**
 * Build the actor-scoped driver. `launch` / `close` are no-ops: actor lifecycle
 * belongs to the `spawnActor` / `resetActor` actions.
 */
export function createRunDriver(run: ProductRun, actorId: string): Driver {
  return {
    kind: 'dst-run',
    launch: async () => undefined,
    close: async () => undefined,
    get: (testId) => wrapNode(run, actorId, [testId]),
    key: (key) =>
      run.apply(uiOp, { actorId, op: 'key', path: [], extra: { key } }),
    snapshotHtml: (options) =>
      run.observe(actorHtml(actorId, options?.stylesheetHref)),
  };
}
