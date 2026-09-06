import { describe, expect, test } from 'bun:test';
import { createAsyncRunner } from '@pkgs/async/async-runner';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createAsyncRunner', () => {
  test('walks idle → running → success', async () => {
    const d = deferred<number>();
    const runner = createAsyncRunner(async () => d.promise);
    const seen: string[] = [];
    runner.subscribe(() => seen.push(runner.getSnapshot().status));

    expect(runner.getSnapshot().status).toBe('idle');
    const p = runner.run();
    expect(runner.getSnapshot().status).toBe('running');
    d.resolve(42);
    await expect(p).resolves.toBe(42);
    expect(runner.getSnapshot()).toEqual({
      status: 'success',
      value: 42,
      error: null,
    });
    expect(seen).toEqual(['running', 'success']);
  });

  test('de-duplicates in-flight runs by key', async () => {
    let calls = 0;
    const d = deferred<string>();
    const runner = createAsyncRunner(
      async (_ctx, id: string) => {
        calls += 1;
        return `${id}:${await d.promise}`;
      },
      { getKey: (id) => id }
    );
    const a = runner.run('x');
    const b = runner.run('x');
    expect(a).toBe(b);
    d.resolve('ok');
    await a;
    expect(calls).toBe(1);
  });

  test('normalizes thrown values and reports via onError', async () => {
    const errors: Error[] = [];
    const runner = createAsyncRunner(
      async () => {
        throw 'boom';
      },
      { onError: (e) => errors.push(e) }
    );
    await expect(runner.run()).rejects.toBeInstanceOf(Error);
    expect(runner.getSnapshot().status).toBe('error');
    expect(errors[0]?.message).toBe('boom');
    runner.clearError();
    expect(runner.getSnapshot().status).toBe('idle');
  });

  test('cancelAll aborts the signal and marks cancelled', async () => {
    const runner = createAsyncRunner(
      (ctx) =>
        new Promise<never>((_resolve, reject) => {
          ctx.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    const p = runner.run();
    runner.cancelAll('test');
    await expect(p).rejects.toBeDefined();
    expect(runner.getSnapshot().status).toBe('cancelled');
  });

  test('dispose stops publishing state', async () => {
    const d = deferred<number>();
    const runner = createAsyncRunner(async () => d.promise);
    const p = runner.run();
    runner.dispose();
    d.resolve(1);
    await p.catch(() => undefined);
    expect(runner.getSnapshot().status).toBe('running');
  });
});
