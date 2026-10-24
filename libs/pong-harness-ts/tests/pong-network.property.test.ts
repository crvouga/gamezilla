import { test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { verifyRecovery } from './pong-network-checks';

test('Pong courts recover from seeded faulty delivery and a lost player or spectator connection', async () => {
  await assertProperty(
    'Pong adverse delivery',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 1_000_000 }),
      fc.record({
        latencyMeanMs: fc.integer({ min: 0, max: 80 }),
        latencyJitterMs: fc.integer({ min: 0, max: 40 }),
        dropProbability: fc.constantFrom(0, 0.1, 0.3),
        duplicateProbability: fc.constantFrom(0, 0.5, 1),
        reorderProbability: fc.constantFrom(0, 1),
      }),
      fc.boolean(),
      fc.constantFrom('alice' as const, 'bob' as const, 'carol' as const),
      verifyRecovery
    )
  );
}, 20_000);
