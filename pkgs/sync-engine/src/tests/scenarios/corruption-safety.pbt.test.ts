import { describe, expect, test } from 'bun:test';

import { CORRUPTION_VARIANTS, STORAGE_TAMPERS } from '../../sim/scenario';
import { acmeSystem, expectConverged, pool } from '../apps/acme';
import { walkThenConverge } from '../apps/acme/walk-converge';

describe('corruption safety PBT', () => {
  test(
    'HTTP response corruption then mutate converges (every variant)',
    async () => {
      for (const [i, variant] of CORRUPTION_VARIANTS.entries()) {
        for (const kind of [
          'corruptMutationsResponse',
          'corruptQueryResponse',
        ] as const) {
          await using s = await acmeSystem.script({ seed: 500 + i });
          await s.apply(pool.armHttpFault, 'c0', { kind, variant });
          await s.apply(pool.domain, {
            clientId: 'c0',
            mutation: 'setNote',
            args: { id: 'n0', body: 'corruption', title: '' },
          });
          await s.elapse(40);
          await s.apply(pool.heal);
          await expectConverged(s);
        }
      }
    },
    { timeout: 120_000 }
  );

  test(
    'pubsub payload corruption then mutate converges (every variant)',
    async () => {
      for (const [i, variant] of CORRUPTION_VARIANTS.entries()) {
        await using s = await acmeSystem.script({ seed: 520 + i });
        await s.apply(pool.armPubsubFault, {
          kind: 'corruptPubsubPayload',
          variant,
        });
        await s.apply(pool.domain, {
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n0', body: 'corruption', title: '' },
        });
        await s.elapse(40);
        await s.apply(pool.heal);
        await expectConverged(s);
      }
    },
    { timeout: 120_000 }
  );

  test(
    'local storage tamper then restart converges (every tamper)',
    async () => {
      for (const [i, tamper] of STORAGE_TAMPERS.entries()) {
        await using s = await acmeSystem.script({ seed: 540 + i });
        await s.apply(pool.domain, {
          clientId: 'c0',
          mutation: 'setNote',
          args: { id: 'n0', body: 'corruption', title: '' },
        });
        await s.apply(pool.tamperLocalStorage, 'c0', tamper);
        await s.apply(pool.restart, 'c0');
        await s.elapse(40);
        await s.apply(pool.heal);
        await expectConverged(s);
      }
    },
    { timeout: 120_000 }
  );

  test(
    'corruption arms interleaved with mutates converge on heal',
    async () => {
      let tampered = 0;
      for (const seed of [561, 562, 563]) {
        const walk = await walkThenConverge({
          seed,
          actions: [
            'armHttpFault',
            'armPubsubFault',
            'tamperLocalStorage',
            'domain',
            'heal',
          ],
          steps: 10,
        });
        tampered += walk.coverage.actions['tamperLocalStorage'] ?? 0;
      }
      expect(tampered).toBeGreaterThan(0);
    },
    { timeout: 120_000 }
  );
});
