import { describe, expect, test } from 'bun:test';
import { collectTabbable, nextTabStop } from '@pkgs/ui-shared/focus-trap-logic';
import { createSurfaceStackStore } from '@pkgs/ui-shared/surface-stack-store';
import { SURFACE_STACK_BASE, SURFACE_STACK_STEP } from '@pkgs/ui-shared/constants';

describe('createSurfaceStackStore', () => {
  test('assigns monotonic z-indexes and restores a remounted underlay slot', () => {
    const store = createSurfaceStackStore();
    store.register('a');
    store.register('b');
    expect(store.getSnapshot().map((e) => e.zIndex)).toEqual([
      SURFACE_STACK_BASE,
      SURFACE_STACK_BASE + SURFACE_STACK_STEP,
    ]);
    expect(store.getTopId()).toBe('b');
    store.unregister('a');
    store.register('a');
    expect(store.getSnapshot().map((e) => e.id)).toEqual(['a', 'b']);
    expect(store.isTop('b')).toBe(true);
    store.unregister('b');
    store.unregister('a');
    expect(store.getSnapshot()).toEqual([]);
    expect(store.zIndexOf('a')).toBeNull();
  });

  test('notifies subscribers once per change and ignores duplicate registers', () => {
    const store = createSurfaceStackStore();
    let calls = 0;
    const off = store.subscribe(() => {
      calls += 1;
    });
    store.register('a');
    store.register('a');
    expect(calls).toBe(1);
    off();
    store.unregister('a');
    expect(calls).toBe(1);
  });
});

describe('nextTabStop', () => {
  const el = (id: string) => ({ id }) as unknown as HTMLElement;
  const list = [el('a'), el('b'), el('c')];
  test('wraps at the ends and enters from outside', () => {
    expect(nextTabStop(list, null, false)).toBe(list[0] ?? null);
    expect(nextTabStop(list, null, true)).toBe(list[2] ?? null);
    expect(nextTabStop(list, list[2] ?? null, false)).toBe(list[0] ?? null);
    expect(nextTabStop(list, list[0] ?? null, true)).toBe(list[2] ?? null);
    expect(nextTabStop(list, list[1] ?? null, false)).toBeNull();
    expect(nextTabStop([], null, false)).toBeNull();
  });
  test('collectTabbable is exported', () => {
    expect(typeof collectTabbable).toBe('function');
  });
});
