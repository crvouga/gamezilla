import { describe, expect, test } from 'bun:test';

import { StatusBarRegistryStore } from './status-bar-registry-store';
import type { RegisteredStatusBarItem } from './types';

function item(id: string, order?: number): RegisteredStatusBarItem {
  return {
    id,
    ...(order !== undefined ? { order } : {}),
    indicator: null,
    title: id,
    _version: 0,
  };
}

describe('StatusBarRegistryStore', () => {
  test('upserts, sorts by order, and removes by registration id', () => {
    const store = new StatusBarRegistryStore();
    store.upsert(item('b', 20), 'reg-b');
    store.upsert(item('a', 10), 'reg-a');
    store.upsert(item('c'), 'reg-c');

    expect(store.getVisibleSorted().map((i) => i.id)).toEqual(['a', 'b', 'c']);

    store.remove('a', 'wrong-reg');
    expect(store.get('a')).toBeDefined();

    store.remove('a', 'reg-a');
    expect(store.get('a')).toBeUndefined();
    expect(store.getVisibleSorted().map((i) => i.id)).toEqual(['b', 'c']);
  });

  test('hides items with visible: false', () => {
    const store = new StatusBarRegistryStore();
    store.upsert({ ...item('shown', 1), visible: true }, 'r1');
    store.upsert({ ...item('hidden', 2), visible: false }, 'r2');
    expect(store.getVisibleSorted().map((i) => i.id)).toEqual(['shown']);
  });
});
