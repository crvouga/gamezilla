import { describe, expect, test } from 'bun:test';
import { createPremoveQueue } from '@pkgs/chess-board-core/premove/premove-queue';

describe('createPremoveQueue', () => {
  test('enqueues up to max and rejects when full', () => {
    const q = createPremoveQueue(2);
    expect(q.enqueue({ from: 'e2', to: 'e4' })).toBe(true);
    expect(q.enqueue({ from: 'd2', to: 'd4' })).toBe(true);
    expect(q.enqueue({ from: 'c2', to: 'c4' })).toBe(false);
    expect(q.list()).toEqual([
      { from: 'e2', to: 'e4' },
      { from: 'd2', to: 'd4' },
    ]);
  });

  test('cancelLast and clear notify subscribers', () => {
    const q = createPremoveQueue(3);
    let n = 0;
    const unsub = q.subscribe(() => {
      n += 1;
    });
    q.enqueue({ from: 'a2', to: 'a3' });
    q.enqueue({ from: 'b2', to: 'b3' });
    expect(n).toBe(2);
    q.cancelLast();
    expect(q.list()).toEqual([{ from: 'a2', to: 'a3' }]);
    expect(n).toBe(3);
    q.clear();
    expect(q.list()).toEqual([]);
    expect(n).toBe(4);
    unsub();
    q.enqueue({ from: 'c2', to: 'c3' });
    expect(n).toBe(4);
  });

  test('setMax trims the queue', () => {
    const q = createPremoveQueue(4);
    q.enqueue({ from: 'a2', to: 'a4' });
    q.enqueue({ from: 'b2', to: 'b4' });
    q.enqueue({ from: 'c2', to: 'c4' });
    q.setMax(1);
    expect(q.list()).toEqual([{ from: 'a2', to: 'a4' }]);
    expect(q.enqueue({ from: 'd2', to: 'd4' })).toBe(false);
  });

  test('stores promotion on queued premoves', () => {
    const q = createPremoveQueue();
    expect(
      q.enqueue({ from: 'e7', to: 'e8', promotion: 'n' })
    ).toBe(true);
    expect(q.list()[0]?.promotion).toBe('n');
  });
});
