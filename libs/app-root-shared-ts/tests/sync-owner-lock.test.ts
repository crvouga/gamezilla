import { afterEach, describe, expect, test } from 'bun:test';
import { tryAcquireSyncOwnerLease } from '@libs/app-root-shared-ts/sync-owner-lock';

type Lock = (callback: (lock: unknown) => unknown) => Promise<unknown>;

const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function withLocks(request: Lock | undefined): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks:
        request === undefined
          ? undefined
          : { request: (_name: string, _o: unknown, cb: never) => request(cb) },
    },
  });
}

afterEach(() => {
  if (original === undefined) {
    Reflect.deleteProperty(globalThis, 'navigator');
  } else {
    Object.defineProperty(globalThis, 'navigator', original);
  }
});

describe('the sync owner lease', () => {
  test('a host without Web Locks owns alone', async () => {
    withLocks(undefined);
    expect((await tryAcquireSyncOwnerLease('db')).isOwner).toBe(true);
  });

  test('the first tab owns and releasing frees the lock', async () => {
    let held: Promise<unknown> | undefined;
    withLocks((callback) => {
      held = Promise.resolve(callback({}));
      return held;
    });
    const lease = await tryAcquireSyncOwnerLease('db');
    expect(lease.isOwner).toBe(true);
    lease.release();
    lease.release();
    await held;
  });

  test('a tab that finds the lock taken follows', async () => {
    withLocks(async (callback) => {
      await callback(null);
    });
    const lease = await tryAcquireSyncOwnerLease('db');
    expect(lease.isOwner).toBe(false);
    lease.release();
  });

  // regression: sync-owner-lock-request-rejected
  test('a browser that rejects the lock request still boots, owning alone', async () => {
    withLocks(() =>
      Promise.reject(
        new DOMException('The document is sandboxed', 'SecurityError')
      )
    );
    expect((await tryAcquireSyncOwnerLease('db')).isOwner).toBe(true);
  });

  // regression: sync-owner-lock-request-rejected
  test('a browser whose lock request throws still boots, owning alone', async () => {
    withLocks(() => {
      throw new TypeError('locks.request is not a function');
    });
    expect((await tryAcquireSyncOwnerLease('db')).isOwner).toBe(true);
  });
});
