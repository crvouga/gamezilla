import { describe, expect, test } from 'bun:test';
import { RPC_ERROR_TX_ABORTED, TX_IDLE_TIMEOUT_MS } from './rpc';
import { sqlFromWire } from './sql-wire';

describe('sqlFromWire', () => {
  test('rebuilds placeholders from wire values', () => {
    const q = sqlFromWire({
      sql: 'SELECT ? AS a WHERE b = ?',
      values: [1, 'x'],
    });
    expect(q.sql).toBe('SELECT ? AS a WHERE b = ?');
    expect([...q.values]).toEqual([1, 'x']);
  });
});

describe('tx queue ordering (simulated)', () => {
  test('second begin waits until first commits', async () => {
    type Job = () => Promise<void>;
    let chain: Promise<unknown> = Promise.resolve();
    const runExclusive = (fn: Job) => {
      const done = chain.then(fn, fn);
      chain = done.then(
        () => undefined,
        () => undefined
      );
      return done;
    };

    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => {
      releaseFirst = r;
    });

    const p1 = (async () => {
      await new Promise<void>((resolveBegin) => {
        void runExclusive(async () => {
          order.push('begin1');
          resolveBegin();
          await firstGate;
          order.push('end1');
        });
      });
    })();

    await Promise.resolve();
    const p2 = runExclusive(async () => {
      order.push('begin2');
    });

    await Promise.resolve();
    expect(order).toEqual(['begin1']);
    releaseFirst();
    await p1;
    await p2;
    expect(order).toEqual(['begin1', 'end1', 'begin2']);
  });

  test('idle timeout constant matches plan (10s)', () => {
    expect(TX_IDLE_TIMEOUT_MS).toBe(10_000);
    expect(RPC_ERROR_TX_ABORTED).toBe('E_TX_ABORTED');
  });

  test('nested transaction flattens to same handle', async () => {
    const calls: string[] = [];
    type Tx = {
      transaction: <T>(fn: (inner: Tx) => Promise<T>) => Promise<T>;
    };
    const tx: Tx = {
      transaction: async <T>(fn: (inner: Tx) => Promise<T>) => {
        calls.push('nested');
        return fn(tx);
      },
    };
    await tx.transaction(async (inner) => {
      calls.push('outer');
      await inner.transaction(async () => {
        calls.push('inner');
      });
    });
    expect(calls).toEqual(['nested', 'outer', 'nested', 'inner']);
  });
});
