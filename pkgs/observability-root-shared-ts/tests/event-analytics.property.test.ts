import { expect, test } from 'bun:test';
import { logicalEvents } from '@pkgs/observability-root-shared-ts/event-analytics';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('logical business counts are invariant under retries and exclude unknown or synthetic populations', () => {
  assertProperty(
    'event population and replay invariant',
    fc.property(
      fc.array(
        fc.record({
          occurredAtMs: fc.integer({ min: 0, max: 30 }),
          synthetic: fc.constantFrom(false, true, undefined),
          copies: fc.integer({ min: 1, max: 5 }),
        }),
        { maxLength: 30 }
      ),
      (facts) => {
        const events = facts.map((fact, index) => ({
          name: 'example.operation.completed',
          version: 1,
          id: `operation-${index}`,
          occurredAtMs: fact.occurredAtMs,
          ...(fact.synthetic === undefined
            ? {}
            : { synthetic: fact.synthetic }),
          attributes: { 'subject.id': `subject-${index}` },
        }));
        const replayed = events
          .flatMap((event, index) =>
            Array.from({ length: facts[index]?.copies ?? 1 }, () => ({
              ...event,
            }))
          )
          .reverse();
        const expected = events.filter(
          (event) =>
            event.synthetic === false &&
            event.occurredAtMs >= 10 &&
            event.occurredAtMs < 20
        );
        const window = { fromMs: 10, untilMs: 20 };
        expect(
          logicalEvents(replayed, window)
            .map((event) => event.id)
            .sort()
        ).toEqual(expected.map((event) => event.id).sort());
      }
    )
  );
});
