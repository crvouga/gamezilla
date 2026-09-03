import { draw, type JsonValue, observe } from '@pkgs/dst';
import type { DriverKey, DriverNode, ScrollDirection } from '@pkgs/ui-testing';

import { caps, clientIds } from './observations';
import { type ProductSurface, productExtra } from './surface';
import { defineAction } from './system';
import { nodeAt } from './ui-nodes';

export const spawnActor = defineAction({
  name: 'spawnActor',
  generate(id: string) {
    return async (s) => {
      if (s.actors.has(id)) return;
      const handle = await s.runtime.launchActor(id);
      s.actors.set(id, handle);
    };
  },
});

export const resetActor = defineAction({
  name: 'resetActor',
  generate(id: string) {
    return async (s) => {
      await s.runtime.resetActor(id);
    };
  },
});

/**
 * Advance the run. RNTL goes through the host's serialized `runFor` (the
 * same drain the UI wait pump uses); other hosts advance the scheduler.
 */
export const passTime = defineAction({
  name: 'passTime',
  generate(ms: number) {
    return async (s) => {
      const { ui } = productExtra(s);
      if (ui.kind === 'rntl') {
        await ui.runFor(ms);
        return;
      }
      await s.session.scheduler.advance(ms);
    };
  },
});

export const partition = defineAction({
  name: 'partition',
  *generate(id: string) {
    if (!(yield* caps).includes('partition')) return;
    yield (s: ProductSurface) => {
      s.session.network.partition('server', id);
    };
  },
});

/** Random pool member — draws a client then delegates to typed {@link partition}. */
export const randomPartition = defineAction({
  name: 'randomPartition',
  *generate() {
    const o = yield* observe({ caps, clientIds });
    if (!o.caps.includes('partition') || o.clientIds.length === 0) return;
    const id = yield* draw(
      (rng) => o.clientIds[Math.floor(rng.next() * o.clientIds.length)]!
    );
    yield* partition(id);
  },
});

export const heal = defineAction({
  name: 'heal',
  *generate() {
    if (!(yield* caps).includes('partition')) return;
    yield (s: ProductSurface) => {
      s.session.network.healAll();
    };
  },
});

export type UiOp = {
  readonly actorId: string;
  readonly op: string;
  readonly path: readonly string[];
  readonly extra: { readonly [k: string]: JsonValue };
};

export const uiOp = defineAction({
  name: 'uiOp',
  generate(op: UiOp) {
    return async (s) => {
      await performUiOp(s, op);
    };
  },
});

async function performUiOp(s: ProductSurface, op: UiOp): Promise<void> {
  const handle = s.actors.get(op.actorId);
  if (handle === undefined) return;
  const timeoutMs =
    typeof op.extra['timeoutMs'] === 'number'
      ? op.extra['timeoutMs']
      : undefined;
  const opts = timeoutMs !== undefined ? { timeoutMs } : undefined;
  if (op.op === 'key' && op.path.length === 0) {
    await handle.ui.key((op.extra['key'] as DriverKey) ?? 'enter');
    return;
  }
  const node = nodeAt(s, op.actorId, op.path);
  if (node === null) return;
  await runNodeOp(node, op, opts);
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
      await node.input(String(op.extra['text'] ?? ''), opts);
      return;
    case 'clear':
      await node.clear();
      return;
    case 'key':
      await node.key((op.extra['key'] as DriverKey) ?? 'enter');
      return;
    case 'scroll':
      await node.scroll(op.extra['direction'] as ScrollDirection);
      return;
    case 'tapAt':
      await node.tapAt({
        xRatio: Number(op.extra['xRatio'] ?? 0),
        yRatio: Number(op.extra['yRatio'] ?? 0),
      });
      return;
    case 'drag':
      await node.drag(
        {
          xRatio: Number(op.extra['fromX'] ?? 0),
          yRatio: Number(op.extra['fromY'] ?? 0),
        },
        {
          xRatio: Number(op.extra['toX'] ?? 0),
          yRatio: Number(op.extra['toY'] ?? 0),
        }
      );
      return;
    default:
      return;
  }
}
