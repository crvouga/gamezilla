import { expect, test } from 'bun:test';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { hasDueOutboxWork } from '@pkgs/outbox-shared-ts/due-work';
import { openDueWork, Ping } from './due-work-fixture';

test('a retry and a deferred event become due at their own availability time', async () => {
  const h = await openDueWork();
  try {
    h.register(['ping-worker']);
    await h.append({ id: 'retry' });
    await h.delivery({ eventId: 'retry', at: 10 });
    await h.append({ id: 'future', at: 20 });
    expect(await hasDueOutboxWork(h.deps)).toBe(false);
    h.advance(10);
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(h.deps)).toBe(false);
    h.advance(10);
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(h.deps)).toBe(false);
  } finally {
    await h.db.disconnect();
  }
});

test('a zero-delay retry remains visible after a partially successful pass', async () => {
  const h = await openDueWork();
  try {
    let first = true;
    h.registerConsumer({
      id: 'ping-worker',
      on: Ping,
      retryPolicy: { maxAttempts: 3, backoffMs: [0] },
      handler: async () => {
        if (first) {
          first = false;
          throw new Error('retry');
        }
      },
    });
    await h.append({ id: 'retry' });
    await h.append({ id: 'healthy' });
    expect((await drainOutbox(h.deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(h.deps)).toBe(false);
  } finally {
    await h.db.disconnect();
  }
});

test('a pending delivery keeps its consumer identity after its event is gone or changes type', async () => {
  const h = await openDueWork();
  try {
    h.register(['ping-worker']);
    for (const event of [
      { id: 'legacy', kind: 'pong' as const },
      { id: 'deleted', deleted: true },
    ]) {
      await h.append(event);
      await h.delivery({ eventId: event.id });
    }
    await h.delivery({ eventId: 'missing' });
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(3);
    expect(h.attempts).toEqual(['legacy:ping-worker']);
    expect(
      (await h.deliveryState()).every((row) => row.processed_at !== null)
    ).toBe(true);
    expect(await hasDueOutboxWork(h.deps)).toBe(false);
  } finally {
    await h.db.disconnect();
  }
});

test('unmaterialized due work is not hidden behind the materialization cap', async () => {
  const h = await openDueWork();
  try {
    h.register(['ping-worker']);
    for (let n = 0; n < 201; n++)
      await h.append({ id: `future-${n}`, at: 1000 });
    await h.append({ id: 'due' });
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(0);
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(h.deps)).toBe(false);
  } finally {
    await h.db.disconnect();
  }
});

test('the witness reads newly committed work and time advanced during delivery', async () => {
  const h = await openDueWork();
  try {
    h.registerConsumer({
      id: 'ping-worker',
      on: Ping,
      handler: async () => {
        h.advance(10);
      },
    });
    await h.append({ id: 'root' });
    await h.append({ id: 'becomes-due', at: 10 });
    expect((await drainOutbox(h.deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
    expect(await hasDueOutboxWork(h.deps)).toBe(false);
    // Another producer commits between the pass and the observation.
    // regression: outbox-due-work-test-appends-outside-its-transaction
    await h.db.transaction(async (tx) => {
      await h.append({ id: 'concurrent' }, tx);
    });
    expect(await hasDueOutboxWork(h.deps)).toBe(true);
    expect((await drainOutbox(h.deps)).processed).toBe(1);
  } finally {
    await h.db.disconnect();
  }
});
