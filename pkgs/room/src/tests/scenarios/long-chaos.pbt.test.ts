import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import { counterApp } from '../apps/counter/app';
import { roomSeedFingerprint, runRoomSeed } from '../scenario/script-seed';

describe('room seeded chaos PBT', () => {
  test('same generated seed → identical chaos fingerprint', async () => {
    await assertProperty(
      'room chaos determinism',
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000 }).map(String),
        fc.integer({ min: 8, max: 24 }),
        async (seed, steps) => {
          const once = await roomSeedFingerprint({
            app: counterApp,
            seed,
            steps,
            clientCount: 2,
          });
          const twice = await roomSeedFingerprint({
            app: counterApp,
            seed,
            steps,
            clientCount: 2,
          });
          expect(once).toBe(twice);
        }
      ),
      { numRuns: 4 }
    );
  }, 180_000);

  test('runRoomSeed converges for random seeds', async () => {
    await assertProperty(
      'room seed converges',
      fc.asyncProperty(fc.integer({ min: 1, max: 10_000 }), async (seed) => {
        const result = await runRoomSeed({
          app: counterApp,
          seed,
          steps: 20,
          clientCount: 2,
        });
        expect(result.ok).toBe(true);
      }),
      { numRuns: 4 }
    );
  }, 180_000);
});
