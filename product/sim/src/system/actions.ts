import { defineAction, type JsonValue, type Rng } from '@pkgs/sim';
import type { DriverKey, DriverNode, ScrollDirection } from '@pkgs/ui-testing';

import { ensureActor } from './actor-ui';
import { caps, clientIds, partitioned } from './observations';
import type { ProductSim } from './sim';
import { nodeAt } from './ui-nodes';

export const spawnActor = defineAction({
  name: 'spawnActor',
  act: async (s: ProductSim, id: string) => {
    await ensureActor(s, id);
  },
});

export const resetActor = defineAction({
  name: 'resetActor',
  act: async (s: ProductSim, id: string) => {
    await s.runtime.resetActor(id);
  },
});

export const partition = defineAction({
  name: 'partition',
  enabled: (s: ProductSim) =>
    caps(s).includes('partition') && clientIds(s).length > 0,
  weight: (s: ProductSim) => (partitioned(s).length === 0 ? 2 : 1),
  sample: (s: ProductSim) => {
    const ids = clientIds(s);
    return (rng: Rng) => ids[Math.floor(rng.next() * ids.length)]!;
  },
  act: (s: ProductSim, id: string) => {
    s.session.network.partition('server', id);
  },
});

export const restoreNetwork = defineAction({
  name: 'restoreNetwork',
  enabled: (s: ProductSim) => caps(s).includes('partition'),
  weight: (s: ProductSim) => Math.max(partitioned(s).length, 0),
  act: (s: ProductSim) => {
    s.session.network.healAll();
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
  act: async (s: ProductSim, op: UiOp) => {
    await performUiOp(s, op);
  },
});

async function performUiOp(s: ProductSim, op: UiOp): Promise<void> {
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
