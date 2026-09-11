import { CELL_UNITS } from '@pkgs/chess-board/board-units';
import { createDragGhostController } from '@pkgs/chess-board/drag-ghost-controller';
import { describe, expect, it, vi } from 'vitest';

function createFrameGate() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    schedule(cb: FrameRequestCallback): number {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancel(id: number): void {
      pending.delete(id);
    },
    flush(): void {
      const entries = [...pending.entries()];
      pending.clear();
      for (const [, cb] of entries) cb(0);
    },
    get pendingCount() {
      return pending.size;
    },
  };
}

describe('createDragGhostController', () => {
  it('batches moveTo through rAF and writes transform only', () => {
    const frames = createFrameGate();
    const ghost = createDragGhostController(frames.schedule, frames.cancel);
    const el = document.createElement('div');
    ghost.setElement(el);
    ghost.begin({ code: 'wn', x: 100, y: 200, touch: false });
    expect(ghost.isActive()).toBe(true);
    expect(el.style.transform).toContain('translate(');
    expect(el.style.transform).not.toContain('scale(');

    ghost.moveTo(150, 250);
    ghost.moveTo(160, 260);
    expect(frames.pendingCount).toBe(1);
    frames.flush();
    expect(el.style.transform).toBe(
      `translate(${160 - CELL_UNITS / 2}px,${260 - CELL_UNITS / 2}px)`
    );

    ghost.end();
    expect(ghost.isActive()).toBe(false);
    expect(el.style.visibility).toBe('hidden');
  });

  it('applies touch lift offset and scale', () => {
    const frames = createFrameGate();
    const ghost = createDragGhostController(frames.schedule, frames.cancel);
    const el = document.createElement('div');
    ghost.setElement(el);
    ghost.begin({ code: 'wp', x: 100, y: 100, touch: true });
    const lift = CELL_UNITS * 0.15;
    expect(el.style.transform).toBe(
      `translate(${100 - CELL_UNITS / 2}px,${100 - CELL_UNITS / 2 - lift}px) scale(1.08)`
    );
  });

  it('cancelFrame is called on end while a frame is pending', () => {
    const cancel = vi.fn();
    let id = 0;
    const schedule = (_cb: FrameRequestCallback) => {
      id += 1;
      return id;
    };
    const ghost = createDragGhostController(schedule, cancel);
    ghost.setElement(document.createElement('div'));
    ghost.begin({ code: 'bk', x: 0, y: 0, touch: false });
    ghost.moveTo(10, 10);
    ghost.end();
    expect(cancel).toHaveBeenCalled();
  });
});
