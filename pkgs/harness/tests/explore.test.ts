/**
 * Framework-level explore / randomActions: the example app proves smart
 * monkey testing is only `defineAction` + properties (no UI).
 */

import { describe, expect, test } from 'bun:test';
import { dec, exampleApp, inc } from './example-app/example-app';

const app = exampleApp();

describe('explore / randomActions (defineAction only)', () => {
  test('example: scripted apply then read', async () => {
    await using s = await app.run({ seed: 1 });
    await s.apply(inc, 2);
    await s.apply(dec, 1);
    expect(await s.read((c) => c.n)).toBe(1);
  });

  test('monkey: randomActions walk holds properties', async () => {
    await using s = await app.run({ seed: 7 });
    const w = await s.randomActions({ steps: 40 });
    expect(w.violations).toEqual([]);
    expect(w.count).toBe(40);
    expect(Object.keys(w.coverage.actions).length).toBeGreaterThan(0);
  });

  test('explore: multi-episode search holds properties', async () => {
    const report = await app.explore({
      seed: 99,
      episodes: 8,
      steps: 30,
    });
    expect(report.ok).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.coverage.actions['inc'] ?? 0).toBeGreaterThan(0);
  });

  test('same seed → identical walk choices', async () => {
    async function choices(seed: number): Promise<string> {
      await using s = await app.run({ seed });
      const w = await s.randomActions({ steps: 20 });
      return JSON.stringify(w.steps);
    }
    expect(await choices(123)).toBe(await choices(123));
  });
});
