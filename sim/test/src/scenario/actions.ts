import { draw, type JsonValue, observe } from '@pkgs/dst';
import type { DriverKey, DriverNode, ScrollDirection } from '@pkgs/ui-testing';

import { caps, clientIds } from './observations';
import { type ProductSurface, productExtra } from './surface';
import { defineAction } from './system';
import { nodeAt } from './ui-nodes';

export const spawnActor = defineAction({
  name: 'spawnActor',
  *generate() {
    const id = yield* draw(() => '');
    yield async (s: ProductSurface) => {
      if (s.actors.has(id)) return;
      const handle = await s.runtime.launchActor(id);
      s.actors.set(id, handle);
    };
  },
});

export const resetActor = defineAction({
  name: 'resetActor',
  *generate() {
    const id = yield* draw(() => '');
    yield async (s: ProductSurface) => {
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
  *generate() {
    const ms = yield* draw(() => 50);
    yield async (s: ProductSurface) => {
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
  *generate() {
    const [c, ids] = yield* observe(caps, clientIds);
    if (!(c as string[]).includes('partition')) return;
    const list = ids as string[];
    if (list.length === 0) return;
    const id = yield* draw(
      (rng) => list[Math.floor(rng.next() * list.length)]!
    );
    yield (s: ProductSurface) => {
      s.session.network.partition('server', id);
    };
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
  *generate() {
    const op = yield* draw(() => {
      return {
        actorId: '',
        op: 'tap',
        path: [] as string[],
        extra: {},
      } satisfies UiOp;
    });
    yield async (s: ProductSurface) => {
      await performUiOp(s, op);
    };
  },
});

/** What `wait` waits for. `text` carries `text` / `exact` in the payload. */
export type UiWaitKind = 'visible' | 'hidden' | 'text';

export type UiWait = {
  readonly actorId: string;
  readonly path: readonly string[];
  readonly kind: UiWaitKind;
  /** `true` → `node.expect.*` (assertion copy); `false` → `node.wait`. */
  readonly assert: boolean;
  readonly text?: string;
  readonly exact?: boolean;
  readonly timeoutMs?: number;
  readonly description?: string;
};

/**
 * Waiting is a checkpoint: it advances the host's own wait pump, so every
 * memoised observation is invalidated once it returns.
 */
export const uiWait = defineAction({
  name: 'uiWait',
  *generate() {
    const w = yield* draw(() => {
      return {
        actorId: '',
        path: [] as string[],
        kind: 'visible',
        assert: false,
      } satisfies UiWait;
    });
    yield async (s: ProductSurface) => {
      await performUiWait(s, w);
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

function waitOptions(w: UiWait) {
  return {
    ...(w.timeoutMs !== undefined ? { timeoutMs: w.timeoutMs } : {}),
    ...(w.description !== undefined ? { description: w.description } : {}),
  };
}

async function performUiWait(s: ProductSurface, w: UiWait): Promise<void> {
  const node = nodeAt(s, w.actorId, w.path);
  if (node === null) {
    throw new Error(`uiWait: actor '${w.actorId}' has no UI`);
  }
  const opts = waitOptions(w);
  if (!w.assert) {
    const state =
      w.kind === 'text'
        ? { text: w.text ?? '', exact: w.exact ?? true }
        : w.kind;
    await node.wait(state, opts);
    return;
  }
  if (w.kind === 'visible') {
    await node.expect.visible(opts);
    return;
  }
  if (w.kind === 'hidden') {
    await node.expect.hidden(opts);
    return;
  }
  await node.expect.text(w.text ?? '', {
    ...opts,
    ...(w.exact !== undefined ? { exact: w.exact } : {}),
  });
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
