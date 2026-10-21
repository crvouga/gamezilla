import { expect, test } from 'bun:test';
import { ManagedSession } from '@apps/synthetic-population-worker-ts/managed-session';
import { SyntheticPopulationWorker } from '@apps/synthetic-population-worker-ts/synthetic-population-worker';
import { ControlledRealm, settleWorker, workerFixture } from './worker-fixture';

// regression: synthetic-population-drain-exits-before-release
test('confirmed close terminates the realm before release and waits for its acknowledgement', async () => {
  const f = workerFixture();
  const thread = new ControlledRealm();
  let closed = 0;
  f.blockRelease();
  const session = new ManagedSession(f.assignment, 'v2', {
    ...f,
    thread,
    onClose: () => {
      closed += 1;
    },
  });
  session.start('http://localhost');
  thread.emit({ type: 'closed' });
  await settleWorker();
  expect(thread.terminated).toBe(true);
  expect(f.calls).toEqual(['release']);
  expect(closed).toBe(0);
  f.release();
  await settleWorker();
  expect(closed).toBe(1);
  session.abort();
  expect(closed).toBe(1);
});

test('expiry terminates an unresponsive application without releasing uncertain ownership early', async () => {
  const f = workerFixture();
  const thread = new ControlledRealm();
  let closed = 0;
  const session = new ManagedSession(f.assignment, 'v1', {
    ...f,
    thread,
    onClose: () => {
      closed += 1;
    },
  });
  session.start('http://localhost');
  f.clock.advance(60_000);
  thread.emit({ type: 'authenticated', token: 'late-token' });
  await settleWorker();
  expect(thread.terminated).toBe(true);
  expect(closed).toBe(1);
  expect(f.calls).toEqual([]);
});

test('draining renews existing ownership, rejects new assignments, and force-stops at the deadline', async () => {
  const f = workerFixture();
  const thread = new ControlledRealm();
  const worker = new SyntheticPopulationWorker(
    {
      id: f.assignment.lease.workerId,
      origin: 'http://localhost',
      version: 'v2',
      capacity: 1,
      shutdownMs: 25_000,
    },
    {
      ...f,
      spawn: () => thread,
      resources: () => ({ memoryBytes: 1000, cpuMilliseconds: 0 }),
    }
  );
  await worker.start();
  expect(worker.status().active).toBe(1);
  const done = worker.drain();
  expect(worker.drain()).toBe(done);
  await settleWorker();
  expect(worker.status().draining).toBe(true);
  expect(worker.status().ready).toBe(false);
  expect(f.calls.filter((call) => call === 'claim')).toHaveLength(1);
  expect(f.calls).toContain('renew');
  f.clock.advance(25_000);
  await done;
  expect(thread.terminated).toBe(true);
  expect(worker.status().active).toBe(0);
  expect(f.calls).not.toContain('release');
});
