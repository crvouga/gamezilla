/**
 * UI ops as data — the replayable, describable form of a driver call used by
 * explore walks and recordings. `performUiOp` is the single interpreter.
 */

import type { JsonValue } from '@pkgs/sim';

import type { DriverKey } from '../core/keys';
import type {
  Driver,
  DriverNode,
  GestureOptions,
  ScrollDirection,
} from '../driver/driver';
import { formatTestIdPath } from '../selector/format';

export type UiOp = {
  readonly actorId: string;
  readonly op: string;
  readonly path: readonly string[];
  readonly extra: Readonly<Record<string, JsonValue>>;
};

function keyOf(op: UiOp): DriverKey {
  const key = op.extra['key'];
  return typeof key === 'string' ? (key as DriverKey) : 'enter';
}

function textOf(op: UiOp): string {
  const text = op.extra['text'];
  return typeof text === 'string' ? text : '';
}

function gestureOf(op: UiOp): GestureOptions {
  return op.extra['button'] === 'secondary' ? { button: 'secondary' } : {};
}

function num(op: UiOp, key: string): number {
  return Number(op.extra[key] ?? 0);
}

/** Report step title: `tap testId("x") >> testId("y")` / `key enter`. */
export function describeUiOp(op: UiOp): string {
  const target = op.path.length > 0 ? ` ${formatTestIdPath(op.path)}` : '';
  switch (op.op) {
    case 'input':
      return `input ${JSON.stringify(textOf(op))}${target}`;
    case 'key':
      return `key ${keyOf(op)}${target}`;
    case 'scroll':
      return `scroll ${String(op.extra['direction'] ?? '')}${target}`;
    default:
      return `${op.op}${target}`;
  }
}

/** Resolve `op.path` against `driver` (root `get` then nested `get`s). */
export function nodeAtPath(
  driver: Driver,
  path: readonly string[]
): DriverNode | null {
  const [head, ...rest] = path;
  if (head === undefined) return null;
  let node = driver.get(head);
  for (const segment of rest) node = node.get(segment);
  return node;
}

async function runNodeOp(
  node: DriverNode,
  op: UiOp,
  opts: { readonly timeoutMs: number } | undefined
): Promise<void> {
  switch (op.op) {
    case 'tap':
      await node.tap(opts);
      return;
    case 'input':
      await node.input(textOf(op), opts);
      return;
    case 'clear':
      await node.clear();
      return;
    case 'key':
      await node.key(keyOf(op));
      return;
    case 'scroll':
      await node.scroll(op.extra['direction'] as ScrollDirection);
      return;
    case 'tapAt':
      await node.tapAt(
        { xRatio: num(op, 'xRatio'), yRatio: num(op, 'yRatio') },
        gestureOf(op)
      );
      return;
    case 'drag':
      await node.drag(
        { xRatio: num(op, 'fromX'), yRatio: num(op, 'fromY') },
        { xRatio: num(op, 'toX'), yRatio: num(op, 'toY') },
        gestureOf(op)
      );
      return;
    default:
      return;
  }
}

/** Apply one op to a driver. Unknown ops and empty paths are no-ops. */
export async function performUiOp(driver: Driver, op: UiOp): Promise<void> {
  const timeoutMs = op.extra['timeoutMs'];
  const opts = typeof timeoutMs === 'number' ? { timeoutMs } : undefined;
  if (op.op === 'key' && op.path.length === 0) {
    await driver.key(keyOf(op));
    return;
  }
  const node = nodeAtPath(driver, op.path);
  if (node === null) return;
  await runNodeOp(node, op, opts);
}
