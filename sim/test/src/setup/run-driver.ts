/**
 * A {@link Driver} whose every step is a {@link Run} step: mutations and waits
 * are `run.apply` checkpoints, reads are `run.observe` observations. Nothing
 * here touches the product surface — that is the scenario system's job.
 */

import type { Run } from '@pkgs/dst';
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

import { type UiOp, type UiWait, uiOp, uiWait } from '../scenario/actions';
import {
  actorHtml,
  nodeLayout,
  nodeText,
  visible,
} from '../scenario/observations';
import type { ProductSurface } from '../scenario/surface';

type Extra = UiOp['extra'];
type ProductRun = Run<ProductSurface>;

function extraOf(opts?: UiWaitOptions, more?: Extra): Extra {
  const timeoutMs = opts?.timeoutMs;
  return {
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...more,
  };
}

function waitPayload(
  base: Omit<UiWait, 'kind' | 'assert'>,
  kind: UiWait['kind'],
  assert: boolean,
  options?: DriverWaitOptions
): UiWait {
  return {
    ...base,
    kind,
    assert,
    ...(options?.timeoutMs !== undefined
      ? { timeoutMs: options.timeoutMs }
      : {}),
    ...(options?.description !== undefined
      ? { description: options.description }
      : {}),
  };
}

function nodeExpect(
  run: ProductRun,
  base: Omit<UiWait, 'kind' | 'assert'>
): DriverNode['expect'] {
  return {
    visible: (options?: AssertionOptions) =>
      run.apply(uiWait, waitPayload(base, 'visible', true, options)),
    hidden: (options?: AssertionOptions) =>
      run.apply(uiWait, waitPayload(base, 'hidden', true, options)),
    text: (
      expected: string,
      options?: AssertionOptions & { exact?: boolean }
    ) =>
      run.apply(uiWait, {
        ...waitPayload(base, 'text', true, options),
        text: expected,
        ...(options?.exact !== undefined ? { exact: options.exact } : {}),
      }),
  };
}

function runWait(
  run: ProductRun,
  base: Omit<UiWait, 'kind' | 'assert'>,
  state: WaitState | WaitTextCondition,
  options?: DriverWaitOptions
): Promise<void> {
  if (!isWaitTextCondition(state)) {
    return run.apply(uiWait, waitPayload(base, state, false, options));
  }
  return run.apply(uiWait, {
    ...waitPayload(base, 'text', false, options),
    text: state.text,
    ...(state.exact !== undefined ? { exact: state.exact } : {}),
  });
}

function wrapNode(
  run: ProductRun,
  actorId: string,
  path: readonly string[]
): DriverNode {
  const base = { actorId, path };
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
    wait: (state, options) => runWait(run, base, state, options),
    expect: nodeExpect(run, base),
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
