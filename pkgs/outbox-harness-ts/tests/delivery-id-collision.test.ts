import { expect, test } from 'bun:test';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { openDueWork } from './due-work-fixture';

// regression: outbox-delivery-id-delimiter-collision
test('distinct event and consumer pairs cannot collide through delimiters', async () => {
  const h = await openDueWork();
  let ids = 0;
  try {
    h.register(['b:c', 'c']);
    await h.append({ id: 'a' });
    await h.append({ id: 'a:b' });
    const deps = { ...h.deps, createId: () => `delivery-${++ids}` };
    expect((await drainOutbox(deps)).processed).toBe(4);
    expect((await drainOutbox(deps)).processed).toBe(0);
    expect(h.seen).toHaveLength(4);
  } finally {
    await h.db.disconnect();
  }
});

test('two materializers selecting the same logical delivery remain idempotent', async () => {
  const { ensureDeliveries } = await import(
    '@pkgs/outbox-shared-ts/ensure-deliveries'
  );
  const h = await openDueWork();
  let ids = 0;
  try {
    h.register(['worker']);
    await h.append({ id: 'same-event' });
    const deps = { ...h.deps, createId: () => `candidate-${++ids}` };
    await Promise.all([
      ensureDeliveries(h.db, deps),
      ensureDeliveries(h.db, deps),
    ]);
    expect(await h.deliveryState()).toHaveLength(1);
    expect((await drainOutbox(deps)).processed).toBe(1);
    expect(h.seen).toHaveLength(1);
  } finally {
    await h.db.disconnect();
  }
});
