import { expect, test } from 'bun:test';
import { drainOutbox } from '@pkgs/outbox-shared-ts/drain';
import { hasDueOutboxWork } from '@pkgs/outbox-shared-ts/due-work';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { openDueWork } from './due-work-fixture';

const existingDelivery = fc.option(
  fc.record({
    consumerId: fc.constantFrom('ping-worker', 'pong-worker', 'removed-worker'),
    at: fc.constantFrom(-2, 0, 2),
    processed: fc.boolean(),
    deleted: fc.boolean(),
  }),
  { nil: undefined }
);
const world = fc.record({
  consumers: fc.subarray(['ping-worker', 'pong-worker']),
  events: fc.array(
    fc.record({
      kind: fc.constantFrom('ping' as const, 'pong' as const),
      at: fc.constantFrom(-2, 0, 2),
      deleted: fc.boolean(),
      causation: fc.constantFrom('alice', 'bob', null),
      delivery: existingDelivery,
    }),
    { maxLength: 10 }
  ),
  eventIds: fc.constantFrom(undefined, [], ['event-0'], ['event-0', 'event-2']),
  causationIds: fc.constantFrom(undefined, [], ['alice'], ['bob']),
  limit: fc.integer({ min: 1, max: 4 }),
});

test('a negative scoped witness leaves no delivery attempt, cleanup or retry for the next drain', async () => {
  await assertProperty(
    'due-work witness agrees with the real drain',
    fc.asyncProperty(world, async (input) => {
      const h = await openDueWork();
      try {
        h.register(input.consumers);
        for (const [index, event] of input.events.entries()) {
          const id = `event-${index}`;
          await h.append({ ...event, id });
          if (event.delivery !== undefined)
            await h.delivery({ ...event.delivery, eventId: id });
        }
        const deps = {
          ...h.deps,
          limit: input.limit,
          ...(input.eventIds === undefined ? {} : { eventIds: input.eventIds }),
          ...(input.causationIds === undefined
            ? {}
            : { causationIds: input.causationIds }),
        };
        const before = await h.deliveryState();
        const due = await hasDueOutboxWork(deps);
        const result = await drainOutbox(deps);
        if (!due) {
          expect(h.attempts).toEqual([]);
          expect(h.seen).toEqual([]);
          expect(result).toEqual({
            processed: 0,
            exhausted: 0,
            notifyUserIds: [],
          });
          const prior = new Map(before.map((row) => [row.id, row]));
          for (const row of await h.deliveryState())
            expect(row).toEqual(
              prior.get(row.id) ?? {
                id: row.id,
                attempts: 0,
                processed_at: null,
                last_error: null,
              }
            );
        }
        // With no retired delivery blocking its unique key, these small healthy
        // worlds also establish that a positive witness corresponds to real work.
        if (input.events.every((event) => event.delivery?.deleted !== true))
          expect(due).toBe(result.processed > 0);
      } finally {
        await h.db.disconnect();
      }
    })
  );
});
