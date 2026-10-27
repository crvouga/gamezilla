import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { StoredArtifact, SweepPolicy } from './artifact-sweep';
import { planArtifactSweep, SWEEP_POLICY } from './artifact-sweep';

const NOW = new Date('2026-10-27T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const GIB = 1024 ** 3;

function artifact(
  id: number,
  daysOld: number,
  sizeInBytes: number,
  extra: Partial<StoredArtifact> = {}
): StoredArtifact {
  return {
    id,
    name: `artifact-${String(id)}`,
    sizeInBytes,
    createdAt: new Date(NOW.getTime() - daysOld * DAY_MS).toISOString(),
    expired: false,
    runId: id,
    ...extra,
  };
}

const ids = (plan: { delete: readonly StoredArtifact[] }) =>
  plan.delete.map((a) => a.id).sort((a, b) => a - b);

describe('planArtifactSweep', () => {
  // regression: artifact-storage-quota-exhausted
  test('a retired workflow’s artifacts past a week go, whatever their retention', () => {
    const plan = planArtifactSweep({
      artifacts: [
        artifact(1, 8, 10, { name: 'check-evidence-3' }),
        artifact(2, 1, 10, { name: 'verify-plan' }),
      ],
      now: NOW,
      activeRunIds: new Set(),
    });
    expect(ids(plan)).toEqual([1]);
    expect(plan.keptBytes).toBe(10);
  });

  test('over budget, the oldest go first until it fits', () => {
    const plan = planArtifactSweep({
      artifacts: [
        artifact(1, 3, GIB),
        artifact(2, 2, GIB),
        artifact(3, 1, GIB),
      ],
      now: NOW,
      activeRunIds: new Set(),
    });
    expect(ids(plan)).toEqual([1]);
    expect(plan.keptBytes).toBe(2 * GIB);
  });

  test('an unfinished run keeps its artifacts, even old and over budget', () => {
    const plan = planArtifactSweep({
      artifacts: [artifact(1, 30, 5 * GIB), artifact(2, 1, GIB)],
      now: NOW,
      activeRunIds: new Set([1]),
    });
    expect(ids(plan)).toEqual([2]);
    expect(plan.keptBytes).toBe(5 * GIB);
  });

  test('expired artifacts are neither counted nor deleted', () => {
    const plan = planArtifactSweep({
      artifacts: [artifact(1, 30, 5 * GIB, { expired: true })],
      now: NOW,
      activeRunIds: new Set(),
    });
    expect(plan).toEqual({ delete: [], keptBytes: 0 });
  });

  test('property: what is kept fits the budget unless only unfinished runs hold it', () => {
    const policy: SweepPolicy = { maxAgeDays: 7, budgetBytes: 1000 };
    assertProperty(
      'sweep keeps budget and active runs',
      fc.property(
        fc.array(
          fc.record({
            daysOld: fc.double({ min: 0, max: 30, noNaN: true }),
            size: fc.integer({ min: 0, max: 600 }),
            expired: fc.boolean(),
            active: fc.boolean(),
          }),
          { maxLength: 20 }
        ),
        (rows) => {
          const artifacts = rows.map((row, index) =>
            artifact(index + 1, row.daysOld, row.size, {
              expired: row.expired,
            })
          );
          const active = new Set(
            rows.flatMap((row, index) => (row.active ? [index + 1] : []))
          );
          const plan = planArtifactSweep({
            artifacts,
            now: NOW,
            activeRunIds: active,
            policy,
          });
          const deleted = new Set(plan.delete.map((a) => a.id));
          const live = artifacts.filter((a) => !a.expired);
          const kept = live.filter((a) => !deleted.has(a.id));
          const pinned = kept.filter((a) => active.has(a.id));
          // Never an expired artifact, never one of an unfinished run.
          for (const a of plan.delete) {
            expect(a.expired).toBe(false);
            expect(active.has(a.id)).toBe(false);
          }
          expect(plan.keptBytes).toBe(
            kept.reduce((sum, a) => sum + a.sizeInBytes, 0)
          );
          // Nothing deletable past the age limit survives.
          for (const a of kept)
            if (!active.has(a.id))
              expect(
                NOW.getTime() - Date.parse(a.createdAt)
              ).toBeLessThanOrEqual(policy.maxAgeDays * DAY_MS);
          // Over budget only when every remaining artifact is pinned.
          if (plan.keptBytes > policy.budgetBytes)
            expect(pinned.length).toBe(kept.length);
          // Nothing younger is deleted while an older deletable one is kept.
          const deletableKept = kept.filter((a) => !active.has(a.id));
          const youngestDeleted = Math.min(
            ...plan.delete.map((a) => NOW.getTime() - Date.parse(a.createdAt))
          );
          for (const a of deletableKept)
            expect(NOW.getTime() - Date.parse(a.createdAt)).toBeLessThanOrEqual(
              youngestDeleted
            );
        }
      )
    );
  });
});

test('Health sweeps artifacts every hour with permission to delete them', () => {
  const { jobs } = Bun.YAML.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.github/workflows/health.yml'),
      'utf8'
    )
  ) as {
    jobs: Record<
      string,
      { permissions?: Record<string, string>; steps: { run?: string }[] }
    >;
  };
  const cleanup = jobs['health-cleanup']!;
  expect(cleanup.permissions?.['actions']).toBe('write');
  expect(
    cleanup.steps.some((step) =>
      step.run?.includes('scripts/artifact-sweep.ts --apply')
    )
  ).toBe(true);
  expect(SWEEP_POLICY.maxAgeDays).toBeLessThanOrEqual(7);
});
