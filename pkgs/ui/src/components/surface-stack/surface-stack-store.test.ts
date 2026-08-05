import { describe, expect, test } from 'bun:test';

import { SURFACE_STACK_BASE, SURFACE_STACK_STEP } from './constants';
import { createSurfaceStackStore } from './surface-stack-store';

describe('createSurfaceStackStore', () => {
  test('assigns monotonic z-index by open order', () => {
    const store = createSurfaceStackStore();
    store.register('a', 'A');
    store.register('b', 'B');
    const snap = store.getSnapshot();
    expect(snap).toHaveLength(2);
    expect(snap[0]).toMatchObject({
      id: 'a',
      zIndex: SURFACE_STACK_BASE,
    });
    expect(snap[1]).toMatchObject({
      id: 'b',
      zIndex: SURFACE_STACK_BASE + SURFACE_STACK_STEP,
    });
    expect(store.isTop('b')).toBe(true);
    expect(store.isTop('a')).toBe(false);
    expect(store.getTopId()).toBe('b');
  });

  test('unregistering a middle layer recomputes remaining z-indexes', () => {
    const store = createSurfaceStackStore();
    store.register('a', 'A');
    store.register('b', 'B');
    store.register('c', 'C');
    store.unregister('b');
    const snap = store.getSnapshot();
    expect(snap.map((e) => e.id)).toEqual(['a', 'c']);
    expect(snap[0]?.zIndex).toBe(SURFACE_STACK_BASE);
    expect(snap[1]?.zIndex).toBe(SURFACE_STACK_BASE + SURFACE_STACK_STEP);
    expect(store.getTopId()).toBe('c');
  });

  test('re-registering an existing id updates the node without bumping order', () => {
    const store = createSurfaceStackStore();
    store.register('a', 'A1');
    store.register('b', 'B');
    store.register('a', 'A2');
    const snap = store.getSnapshot();
    expect(snap.map((e) => e.id)).toEqual(['a', 'b']);
    expect(snap[0]?.node).toBe('A2');
    expect(store.isTop('b')).toBe(true);
  });

  test('unregister then register alone appends as the new top', () => {
    const store = createSurfaceStackStore();
    store.register('a', 'A');
    store.unregister('a');
    store.register('a', 'A');
    expect(store.getSnapshot().map((e) => e.id)).toEqual(['a']);
    expect(store.isTop('a')).toBe(true);
  });

  test('underlay remount restores under remaining overlay', () => {
    const store = createSurfaceStackStore();
    store.register('list', 'List');
    store.register('confirm', 'Confirm');
    store.unregister('list');
    expect(store.getSnapshot().map((e) => e.id)).toEqual(['confirm']);
    store.register('list', 'List2');
    expect(store.getSnapshot().map((e) => e.id)).toEqual(['list', 'confirm']);
    expect(store.isTop('confirm')).toBe(true);
    expect(store.getSnapshot()[0]?.node).toBe('List2');
  });

  test('identical node re-register is a no-op', () => {
    const store = createSurfaceStackStore();
    const node = 'A';
    let notifies = 0;
    store.subscribe(() => {
      notifies += 1;
    });
    store.register('a', node);
    const afterFirst = notifies;
    store.register('a', node);
    expect(notifies).toBe(afterFirst);
  });
});
