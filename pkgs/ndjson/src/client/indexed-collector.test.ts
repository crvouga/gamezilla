import { describe, expect, test } from 'bun:test';
import { IndexedNdjsonCollector, IndexedNdjsonStreamError } from './index';

describe('IndexedNdjsonCollector', () => {
  test('orders results by index regardless of arrival order', () => {
    const c = new IndexedNdjsonCollector<string>(3);
    c.push({ frame: 'result', index: 2, result: 'c' });
    c.push({ frame: 'result', index: 0, result: 'a' });
    c.push({ frame: 'result', index: 1, result: 'b' });
    c.push({ frame: 'end' });
    expect(c.finalize()).toEqual(['a', 'b', 'c']);
  });

  test('surfaces the first error frame as IndexedNdjsonStreamError', () => {
    const c = new IndexedNdjsonCollector<string>(2);
    c.push({ frame: 'result', index: 0, result: 'ok' });
    c.push({
      frame: 'error',
      index: 1,
      status: 500,
      message: 'boom',
      kind: 'crash',
      context: { foo: 'bar' },
    });
    c.push({ frame: 'end' });
    let thrown: unknown = null;
    try {
      c.finalize();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(IndexedNdjsonStreamError);
    const err = thrown as IndexedNdjsonStreamError;
    expect(err.status).toBe(500);
    expect(err.index).toBe(1);
    expect(err.kind).toBe('crash');
    expect(err.context).toEqual({ foo: 'bar' });
  });

  test('keeps only the first error when multiple are received', () => {
    const c = new IndexedNdjsonCollector<string>(3);
    c.push({ frame: 'error', index: 0, status: 500, message: 'first' });
    c.push({ frame: 'error', index: 1, status: 500, message: 'second' });
    c.push({ frame: 'end' });
    expect(() => c.finalize()).toThrow(/first/);
  });

  test('fires onErrorFrame eagerly for every error frame', () => {
    const seen: string[] = [];
    const c = new IndexedNdjsonCollector<string>(2, {
      onErrorFrame: (f) => seen.push(f.message),
    });
    c.push({ frame: 'error', index: 0, status: 500, message: 'a' });
    c.push({ frame: 'error', index: 1, status: 500, message: 'b' });
    expect(seen).toEqual(['a', 'b']);
  });

  test('rejects frames received after end', () => {
    const c = new IndexedNdjsonCollector<string>(1);
    c.push({ frame: 'end' });
    expect(() => c.push({ frame: 'result', index: 0, result: 'late' })).toThrow(
      /after end marker/
    );
  });

  test('rejects out-of-range result indices', () => {
    const c = new IndexedNdjsonCollector<string>(2);
    expect(() => c.push({ frame: 'result', index: 5, result: 'x' })).toThrow(
      /out of range/
    );
  });

  test('throws when finalized without an end frame', () => {
    const c = new IndexedNdjsonCollector<string>(1);
    c.push({ frame: 'result', index: 0, result: 'a' });
    expect(() => c.finalize()).toThrow(/truncated transport/);
  });

  test('throws when a slot is missing', () => {
    const c = new IndexedNdjsonCollector<string>(2);
    c.push({ frame: 'result', index: 0, result: 'a' });
    c.push({ frame: 'end' });
    expect(() => c.finalize()).toThrow(/omitted a result frame/);
  });

  test('handles zero expected results gracefully', () => {
    const c = new IndexedNdjsonCollector<string>(0);
    c.push({ frame: 'end' });
    expect(c.finalize()).toEqual([]);
  });
});
