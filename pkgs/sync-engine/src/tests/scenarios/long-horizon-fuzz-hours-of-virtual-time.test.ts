import { describe, expect, test } from 'bun:test';

import { ACME_DST_FAULTS_HOST, acmeSystem } from '../apps/acme';

/** Committed corpus — modest multi-client profiles that settle reliably. */
const CORPUS = [1, 7, 11, 17, 31, 42, 99, 404] as const;

const TIME = { weight: 1, minMs: 0, maxMs: 40 } as const;

describe('long horizon fuzz hours of virtual time', () => {
  test(
    'larger profile + corpus seeds converge on the lossy host',
    async () => {
      for (const seed of CORPUS) {
        const report = await acmeSystem.explore({
          host: ACME_DST_FAULTS_HOST,
          seed,
          episodes: 1,
          steps: 36,
          args: { clientCount: 3 },
          stopOnViolation: true,
          time: TIME,
        });
        expect(report.failures.map((f) => f.error)).toEqual([]);
      }
    },
    { timeout: 240_000 }
  );

  test(
    'skew/crash-friendly mid profile still settles',
    async () => {
      const report = await acmeSystem.explore({
        host: ACME_DST_FAULTS_HOST,
        seed: 909,
        episodes: 1,
        steps: 48,
        args: { clientCount: 3 },
        stopOnViolation: true,
        time: TIME,
      });
      expect(report.failures.map((f) => f.error)).toEqual([]);
    },
    { timeout: 120_000 }
  );
});
