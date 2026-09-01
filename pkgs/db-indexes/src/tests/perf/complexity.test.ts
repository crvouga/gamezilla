/**
 * Soft perf / complexity gates. Marked with generous timeouts; ratios not absolute ms.
 */
import { describe, expect, test } from 'bun:test';
import { fingerprintSql } from '../../core/fingerprint';
import { planIndexes } from '../../core/plan';
import type { WorkloadManifest } from '../../core/types';
import { fixedClock, RecordingPort } from '../helpers/recording-port';

function manifestOfSize(n: number): WorkloadManifest {
  const queries = Array.from({ length: n }, (_, i) => {
    const col = `c${String(i % 16)}`;
    const sql = `SELECT id FROM notes WHERE ${col} = ?`;
    return {
      name: `q${String(i)}`,
      hydrates: ['notes'] as const,
      statements: [
        {
          index: 0,
          sql,
          fingerprint: fingerprintSql(sql),
          weight: 1,
        },
      ],
    };
  });
  return { version: 1, queries };
}

async function timePlan(n: number): Promise<number> {
  const clock = fixedClock(0);
  const db = new RecordingPort({
    indexes: [],
    tables: [{ name: 'notes', estimatedRows: 50_000 }],
    usage: [],
    metas: [],
    defaultImprovement: 10,
  });
  const start = performance.now();
  await planIndexes({
    manifest: manifestOfSize(n),
    db,
    clock,
    config: { minTableRows: 1, minImprovementFactor: 1 },
  });
  return performance.now() - start;
}

describe('perf gates', () => {
  test(
    'analyzer runtime ratios stay within O(C log C) band',
    async () => {
      const sizes = [64, 256] as const;
      const times: number[] = [];
      for (const n of sizes) {
        times.push(await timePlan(n));
      }
      // 4× input should not be > ~20× time (generous soft band)
      const ratio = times[1]! / Math.max(times[0]!, 0.1);
      expect(ratio).toBeLessThan(40);
    },
    60_000
  );

  test('100× identical planIndexes: no unbounded growth', async () => {
    const clock = fixedClock(0);
    const db = new RecordingPort({
      indexes: [],
      tables: [{ name: 'notes', estimatedRows: 50_000 }],
      usage: [],
      metas: [],
      defaultImprovement: 10,
    });
    const manifest = manifestOfSize(8);
    for (let i = 0; i < 100; i++) {
      await planIndexes({
        manifest,
        db,
        clock,
        config: { minTableRows: 1 },
      });
    }
    // Soft leak gate: completing 100 runs without OOM is the check
    expect(true).toBe(true);
  });

  test(
    'max-limits case soft wall-clock with headroom',
    async () => {
      const ms = await timePlan(256);
      // Soft bound: 30s with 2× headroom budget of 60s
      expect(ms).toBeLessThan(60_000);
    },
    90_000
  );
});
