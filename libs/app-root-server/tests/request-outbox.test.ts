import { expect, test } from 'bun:test';
import { requestOutboxRegistry } from '@libs/app-root-server/outbox-drain';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import { createEventOutbox } from '@pkgs/observability-root-shared/event-outbox';
import { OutboxConsumerRegistry } from '@pkgs/outbox-shared/define-consumer';

test('request drains exclude telemetry network delivery and preserve product work', () => {
  const all = new OutboxConsumerRegistry();
  const event = createEventOutbox(
    defineEvent({
      name: 'example.work.completed',
      version: 1,
      owner: 'example',
      description: 'Work completed.',
      delivery: 'reliable',
      attributes: {},
    })
  );
  for (const id of ['telemetry:example:v1', 'example-business'])
    all.register({ id, on: event.message, handler: async () => {} });
  expect(
    requestOutboxRegistry(all)
      .all()
      .map((consumer) => consumer.id)
  ).toEqual(['example-business']);
  expect(all.all()).toHaveLength(2);
});
