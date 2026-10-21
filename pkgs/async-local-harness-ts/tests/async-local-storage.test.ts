import { describe, expect, test } from 'bun:test';
import { AsyncLocalStorage as NodeAsyncLocalStorage } from 'node:async_hooks';

import {
  AsyncLocalStorage,
  resetAsyncLocalNativeCtorCacheForTests,
} from '@pkgs/async-local-shared-ts/async-local-storage';
import { StackAsyncLocalStorage } from '@pkgs/async-local-shared-ts/stack-async-local-storage';

describe('AsyncLocalStorage', () => {
  test('getStore is undefined outside run', () => {
    const als = new AsyncLocalStorage<number>();
    expect(als.getStore()).toBeUndefined();
  });

  test('nested run restores outer store', () => {
    const als = new AsyncLocalStorage<string>();
    als.run('outer', () => {
      expect(als.getStore()).toBe('outer');
      als.run('inner', () => {
        expect(als.getStore()).toBe('inner');
      });
      expect(als.getStore()).toBe('outer');
    });
    expect(als.getStore()).toBeUndefined();
  });

  test('async run restores store after await', async () => {
    const als = new AsyncLocalStorage<string>();
    const done = als.run('async', async () => {
      expect(als.getStore()).toBe('async');
      await Promise.resolve();
      expect(als.getStore()).toBe('async');
      return 'ok';
    });
    expect(await done).toBe('ok');
    expect(als.getStore()).toBeUndefined();
  });

  test('native ALS isolates overlapping concurrent runs after install', async () => {
    const g = globalThis as typeof globalThis & {
      AsyncLocalStorage?: typeof NodeAsyncLocalStorage;
    };
    const previous = g.AsyncLocalStorage;
    g.AsyncLocalStorage = NodeAsyncLocalStorage;
    resetAsyncLocalNativeCtorCacheForTests();
    try {
      const als = new AsyncLocalStorage<string>();
      const gate = Promise.withResolvers<void>();
      const seen: string[] = [];

      const a = als.run('A', async () => {
        await gate.promise;
        seen.push(als.getStore() ?? 'missing');
      });
      const b = als.run('B', async () => {
        seen.push(als.getStore() ?? 'missing');
        gate.resolve();
        await Promise.resolve();
        seen.push(als.getStore() ?? 'missing');
      });
      await Promise.all([a, b]);
      expect(seen).toEqual(['B', 'A', 'B']);
    } finally {
      if (previous === undefined) {
        Reflect.deleteProperty(g, 'AsyncLocalStorage');
      } else {
        g.AsyncLocalStorage = previous;
      }
      resetAsyncLocalNativeCtorCacheForTests();
    }
  });
});

describe('StackAsyncLocalStorage', () => {
  test('overlapping concurrent runs share one mutable store', async () => {
    const als = new StackAsyncLocalStorage<string>();
    const gate = Promise.withResolvers<void>();
    const seen: string[] = [];

    const a = als.run('A', async () => {
      await gate.promise;
      seen.push(als.getStore() ?? 'missing');
    });
    const b = als.run('B', async () => {
      seen.push(als.getStore() ?? 'missing');
      gate.resolve();
      await Promise.resolve();
      seen.push(als.getStore() ?? 'missing');
    });
    await Promise.all([a, b]);
    // Documents why Worker entry must install native ALS: A observes B.
    expect(seen[0]).toBe('B');
    expect(seen[1]).toBe('B');
    expect(seen[2]).toBe('B');
  });
});
