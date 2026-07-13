import { describe, expect, test } from 'bun:test';

import {
  createSharedWatchRegistry,
  type WatchSqlHandle,
} from '../client/shared-watch-registry';

function createFakeHandle(
  initial: readonly Record<string, unknown>[],
  onClose: () => void
): WatchSqlHandle & {
  emit: (rows: readonly Record<string, unknown>[]) => void;
} {
  let snapshot = initial;
  let hydrated = true;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getHydrated: () => hydrated,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close: onClose,
    emit: (rows) => {
      snapshot = rows;
      hydrated = true;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

describe('createSharedWatchRegistry', () => {
  test('shares one handle for identical sql and params', () => {
    let openCount = 0;
    let closeCount = 0;
    const registry = createSharedWatchRegistry(() => {
      openCount += 1;
      return createFakeHandle([{ id: '1' }], () => {
        closeCount += 1;
      });
    });

    const a = registry.watch('SELECT id FROM t WHERE id = ?', ['1']);
    const b = registry.watch('SELECT id FROM t WHERE id = ?', ['1']);

    const unsubA = a.subscribe(() => undefined);
    const unsubB = b.subscribe(() => undefined);

    expect(openCount).toBe(1);
    expect(a.getSnapshot()).toEqual([{ id: '1' }]);
    expect(b.getSnapshot()).toEqual([{ id: '1' }]);

    unsubA();
    expect(closeCount).toBe(0);
    unsubB();
    expect(closeCount).toBe(1);
  });

  test('opens separate handles for different params', () => {
    let openCount = 0;
    const registry = createSharedWatchRegistry((_sql, params) => {
      openCount += 1;
      return createFakeHandle([{ id: String(params[0]) }], () => undefined);
    });

    const a = registry.watch('SELECT id FROM t WHERE id = ?', ['a']);
    const b = registry.watch('SELECT id FROM t WHERE id = ?', ['b']);
    const unsubA = a.subscribe(() => undefined);
    const unsubB = b.subscribe(() => undefined);

    expect(openCount).toBe(2);
    expect(a.getSnapshot()[0]?.['id']).toBe('a');
    expect(b.getSnapshot()[0]?.['id']).toBe('b');

    unsubA();
    unsubB();
  });

  test('notifies all subscribers when underlying handle emits', () => {
    const fake = createFakeHandle([{ n: 1 }], () => undefined);
    const registry = createSharedWatchRegistry(() => fake);
    const sub = registry.watch<{ n: number }>('SELECT n FROM t');
    let ticks = 0;
    const unsub = sub.subscribe(() => {
      ticks += 1;
    });
    expect(ticks).toBe(1);
    fake.emit([{ n: 2 }]);
    expect(ticks).toBe(2);
    expect(sub.getSnapshot()[0]?.n).toBe(2);
    unsub();
  });
});
