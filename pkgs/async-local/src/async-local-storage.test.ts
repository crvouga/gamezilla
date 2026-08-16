import { describe, expect, test } from 'bun:test';

import { AsyncLocalStorage } from './async-local-storage';

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
});
