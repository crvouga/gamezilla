import { expect, test } from 'bun:test';
import {
  LIGHT_CYCLES_DUEL_HARNESS_GAME,
  LIGHT_CYCLES_QUAD_HARNESS_GAME,
  LIGHT_CYCLES_TRIO_HARNESS_GAME,
} from '@libs/light-cycles-harness-ts/light-cycles-harness-game';
import { readLightCyclesRecord } from '@libs/light-cycles-harness-ts/light-cycles-record-reading';

test('every mode is a simulation harness game whose literal examples hold', () => {
  for (const game of [
    LIGHT_CYCLES_DUEL_HARNESS_GAME,
    LIGHT_CYCLES_TRIO_HARNESS_GAME,
    LIGHT_CYCLES_QUAD_HARNESS_GAME,
  ])
    expect(game.simulationFixtures.examples).toHaveLength(2);
});

test('a Quad record names all four people in seat order', () => {
  const record =
    LIGHT_CYCLES_QUAD_HARNESS_GAME.shared.registration.capabilities.history!.record(
      LIGHT_CYCLES_QUAD_HARNESS_GAME.shared.registration.rules.initial(),
      '',
      {
        participants: ['alice', 'bob', 'carol', 'dave'].map((name) => ({
          name,
          rating: null,
        })),
        outcome: 'red',
        reason: 'target score',
        timeControl: null,
      }
    );
  expect(readLightCyclesRecord(record)).toMatchObject({
    participants: ['alice', 'bob', 'carol', 'dave'],
    result: 'red',
  });
});
