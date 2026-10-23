import { expect, test } from 'bun:test';
import { eventCompatibilityErrors } from '@pkgs/observability-root-shared-ts/event-compatibility';
import { defineEvent } from '@pkgs/observability-root-shared-ts/event-contract';

const contract = defineEvent({
  name: 'example.game.completed',
  version: 1,
  owner: 'example',
  description: 'A game ended.',
  delivery: 'reliable',
  attributes: {
    'game.mode': {
      type: 'string',
      required: true,
      values: ['bot', 'multiplayer'],
    },
  },
});

test('compatible additions keep saved event queries valid', () => {
  expect(
    eventCompatibilityErrors(contract, {
      ...contract,
      attributes: {
        ...contract.attributes,
        'game.duration_ms': { type: 'number', minimum: 0 },
      },
    })
  ).toEqual([]);
});

test('breaking schemas require an explicit new version', () => {
  const changed = {
    ...contract,
    attributes: {
      'game.mode': { type: 'string', required: true, values: ['bot'] },
      'game.duration_ms': { type: 'number', required: true, minimum: 0 },
    },
  } as const;
  expect(eventCompatibilityErrors(contract, changed)).toHaveLength(2);
  expect(
    eventCompatibilityErrors(contract, { ...changed, version: 2 })
  ).toEqual([]);
  expect(
    eventCompatibilityErrors(contract, { ...contract, attributes: {} })
  ).toHaveLength(1);
  expect(
    eventCompatibilityErrors(contract, { ...contract, delivery: 'best_effort' })
  ).toHaveLength(1);
});
