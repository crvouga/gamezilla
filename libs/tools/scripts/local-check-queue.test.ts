import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { checkCacheConcurrency } from './check-cache-concurrency';
import {
  type CheckLease,
  localCheckEnv,
  withLocalCheckSlot,
} from './local-check-queue';

function admission() {
  let held = false;
  let opened = 0;
  let closed = 0;
  const openLease = (): CheckLease => {
    opened++;
    let owns = false;
    return {
      tryAcquire() {
        if (held) return false;
        held = owns = true;
        return true;
      },
      close() {
        closed++;
        if (owns) held = false;
      },
    };
  };
  return { openLease, counts: () => ({ opened, closed, held }) };
}

// regression: local-check-worktree-memory-contention
test('two worktrees queue before snapshotting and keep the slot through cleanup', async () => {
  const host = admission();
  const first = Promise.withResolvers<void>();
  const cleanup = Promise.withResolvers<void>();
  const tick = Promise.withResolvers<void>();
  const events: string[] = [];
  const ports = {
    openLease: host.openLease,
    signal: new AbortController().signal,
    sleep: () => tick.promise,
    queued: () => events.push('queued'),
  };
  const a = withLocalCheckSlot(async () => {
    events.push('snapshot A');
    await first.promise;
    events.push('archive A');
    await cleanup.promise;
    return 7;
  }, ports);
  const b = withLocalCheckSlot(async () => {
    events.push('snapshot B');
    return 0;
  }, ports);
  expect(events).toEqual(['snapshot A', 'queued']);
  first.resolve();
  await Promise.resolve();
  expect(events).toEqual(['snapshot A', 'queued', 'archive A']);
  cleanup.resolve();
  expect(await a).toBe(7);
  tick.resolve();
  expect(await b).toBe(0);
  expect(events.at(-1)).toBe('snapshot B');
  expect(host.counts()).toEqual({ opened: 2, closed: 2, held: false });
});

test('every queued check runs once, failures propagate, and admission never overlaps', async () => {
  await assertProperty(
    'local-check-machine-wide-admission',
    fc.asyncProperty(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
      async (failures) => {
        const host = admission();
        let active = 0;
        let peak = 0;
        const started: number[] = [];
        const runs = failures.map((fails, index) =>
          withLocalCheckSlot(
            async () => {
              started.push(index);
              peak = Math.max(peak, ++active);
              await Promise.resolve();
              active--;
              if (fails) throw new Error(String(index));
              return index;
            },
            {
              openLease: host.openLease,
              signal: new AbortController().signal,
              sleep: () => Promise.resolve(),
              queued: () => {},
            }
          )
        );
        const results = await Promise.allSettled(runs);
        expect(started.sort((a, b) => a - b)).toEqual(
          failures.map((_, index) => index)
        );
        expect(peak).toBe(1);
        expect(host.counts()).toEqual({
          opened: failures.length,
          closed: failures.length,
          held: false,
        });
        for (const [index, result] of results.entries()) {
          expect(result.status).toBe(
            failures[index] ? 'rejected' : 'fulfilled'
          );
          if (result.status === 'fulfilled') expect(result.value).toBe(index);
          else expect(result.reason.message).toBe(String(index));
        }
      }
    )
  );
});

test('a cancelled waiter closes only its connection and never starts work', async () => {
  const host = admission();
  const owner = host.openLease();
  expect(owner.tryAcquire()).toBe(true);
  const controller = new AbortController();
  const slept = Promise.withResolvers<void>();
  let started = false;
  const waiting = withLocalCheckSlot(
    async () => {
      started = true;
    },
    {
      openLease: host.openLease,
      signal: controller.signal,
      queued: () => {},
      sleep: () => slept.promise,
    }
  );
  controller.abort(new Error('cancelled'));
  slept.resolve();
  await expect(waiting).rejects.toThrow('cancelled');
  expect(started).toBe(false);
  expect(host.counts()).toEqual({ opened: 2, closed: 1, held: true });
  owner.close();
});

test('cancelled admission never opens a connection', async () => {
  const host = admission();
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await expect(
    withLocalCheckSlot(async () => 0, {
      openLease: host.openLease,
      signal: controller.signal,
      sleep: () => Promise.resolve(),
      queued: () => {},
    })
  ).rejects.toThrow('cancelled');
  expect(host.counts()).toEqual({ opened: 0, closed: 0, held: false });
});

// regression: local-check-worktree-memory-contention
test('local checks default to one task and solver without changing the caller', () => {
  const source = { TMPDIR: '/private/run/tmp', CI: 'true' };
  expect(localCheckEnv(source)).toEqual({
    ...source,
    TURBO_CONCURRENCY: '1',
    CHECK_CACHE_CONCURRENCY: '1',
    MODEL_CHECK_CONCURRENCY: '1',
    CHECK_SOLVER_SLOTS: '1',
  });
  expect(source).toEqual({ TMPDIR: '/private/run/tmp', CI: 'true' });
  expect(
    localCheckEnv({
      TURBO_CONCURRENCY: ' 2 ',
      MODEL_CHECK_CONCURRENCY: '2',
      CHECK_SOLVER_SLOTS: '2',
    })['TURBO_CONCURRENCY']
  ).toBe('2');
  expect(localCheckEnv({ TURBO_CONCURRENCY: ' ' })['TURBO_CONCURRENCY']).toBe(
    '1'
  );
});

test('local cache transfers use one worker while remote defaults stay unchanged', () => {
  expect(checkCacheConcurrency(localCheckEnv({}), 32)).toBe(1);
  expect(checkCacheConcurrency(localCheckEnv({}), 16)).toBe(1);
  expect(checkCacheConcurrency({}, 32)).toBe(32);
  expect(checkCacheConcurrency({ CI: 'true' }, 16)).toBe(16);
  expect(checkCacheConcurrency({ CHECK_CACHE_CONCURRENCY: ' 2 ' }, 16)).toBe(2);
  for (const value of ['0', '-1', '1.5', 'Infinity', 'NaN', '50%'])
    expect(() =>
      checkCacheConcurrency({ CHECK_CACHE_CONCURRENCY: value }, 16)
    ).toThrow('positive integer');
});
