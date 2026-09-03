import type { JsonValue, Run } from '@pkgs/dst';
import type {
  Driver,
  DriverKey,
  DriverNode,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
} from '@pkgs/ui-testing';
import { hasInventory } from '@pkgs/ui-testing/explore';

import { type UiOp, uiOp } from '../scenario/actions';
import type { ProductSurface } from '../scenario/surface';

type Extra = { readonly [k: string]: JsonValue };

function extraOf(opts?: UiWaitOptions, more?: Extra): Extra {
  const timeoutMs = opts?.timeoutMs;
  return {
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...more,
  };
}

function applyOp(run: Run<ProductSurface>, payload: UiOp): Promise<void> {
  return run.apply(uiOp, payload);
}

function wrapNode(
  run: Run<ProductSurface>,
  actorId: string,
  node: DriverNode,
  path: readonly string[]
): DriverNode {
  const op = (name: string, extra: Extra) =>
    applyOp(run, { actorId, op: name, path, extra });
  return {
    get: (testId) =>
      wrapNode(run, actorId, node.get(testId), [...path, testId]),
    tap: (options) => op('tap', extraOf(options)),
    tapAt: (position: TapPosition) =>
      op('tapAt', {
        xRatio: position.xRatio,
        yRatio: position.yRatio,
      }),
    drag: (from, to) =>
      op('drag', {
        fromX: from.xRatio,
        fromY: from.yRatio,
        toX: to.xRatio,
        toY: to.yRatio,
      }),
    layout: () => node.layout(),
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
    wait: (state, options) => node.wait(state, options),
    expect: node.expect,
    isVisible: () => node.isVisible(),
    text: () => node.text(),
  };
}

/** Driver whose mutating ops are {@link Run.apply} checkpoints. */
export function createCheckpointDriver(
  run: Run<ProductSurface>,
  actorId: string,
  inner: Driver
): Driver {
  return {
    kind: inner.kind,
    launch: () => inner.launch(),
    close: () => inner.close(),
    get: (testId) => wrapNode(run, actorId, inner.get(testId), [testId]),
    key: (key) =>
      applyOp(run, { actorId, op: 'key', path: [], extra: { key } }),
    snapshotHtml: (options) => inner.snapshotHtml(options),
    ...(hasInventory(inner) ? { inventory: () => inner.inventory() } : {}),
  };
}
