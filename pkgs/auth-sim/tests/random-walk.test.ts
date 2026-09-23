import { describe, expect, test } from 'bun:test';
import { auth, outcomeCounts } from '@pkgs/auth-sim';

const SEEDS = Array.from({ length: 16 }, (_, i) => 11 + i);
const STEPS = 150;

/**
 * Flows the walk must reach across its seeds, or it is not testing linking at
 * all: fresh users, returning users, automatic linking by verified address,
 * address matches that need proof (confirmed and declined), explicit links,
 * both refusals of a link, the last-identity refusal, and unlinking.
 */
const MUST_REACH = [
  'sign:new',
  'sign:existing',
  'sign:linked',
  'sign:link_required',
  'confirm:linked',
  'decline:ok',
  'link:ok',
  'link:error:identity_already_linked',
  'link:error:provider_already_linked',
  'unlink:ok',
  'unlink:error:last_identity',
  'sign:error:cancelled',
  'sign:error:provider_failed',
  'sign:failed',
];

/**
 * The auth random walk: every action in the catalog — sign-in with either
 * provider as anyone (or nobody), confirming and declining pending links,
 * linking and unlinking, signing out here and everywhere, devices going
 * offline, bearer theft, provider-side revocation / deletion / relay
 * toggles / address changes, provider faults, key rotation and time — drawn
 * at random, with the reference model and every invariant checked after
 * each step.
 */
describe('auth sim: random walk', () => {
  test(`${String(SEEDS.length)} seeds × ${String(STEPS)} steps hold every property and reach every flow`, async () => {
    const reached: Record<string, number> = {};
    for (const seed of SEEDS) {
      await using s = await auth.run({
        seed,
        args: { fabric: 'sqlite-mem', clientCount: 3 },
      });
      const report = await s.randomActions({
        steps: STEPS,
        stopOnViolation: true,
      });
      expect({ seed, violations: report.violations }).toEqual({
        seed,
        violations: [],
      });
      expect(report.count).toBe(STEPS);
      for (const [key, count] of Object.entries(await s.read(outcomeCounts))) {
        reached[key] = (reached[key] ?? 0) + count;
      }
    }
    const missing = MUST_REACH.filter((flow) => (reached[flow] ?? 0) === 0);
    expect(missing).toEqual([]);
  }, 300_000);

  test('the postgres fabric holds the same properties', async () => {
    for (const seed of [21, 22, 23, 24]) {
      await using s = await auth.run({
        seed,
        args: { fabric: 'postgres-mem', clientCount: 3 },
      });
      const report = await s.randomActions({
        steps: 150,
        stopOnViolation: true,
      });
      expect({ seed, violations: report.violations }).toEqual({
        seed,
        violations: [],
      });
      expect(report.count).toBe(150);
    }
  }, 300_000);

  test('explore: episodes over sampled topologies, shrinking any failure', async () => {
    const report = await auth.explore({
      seed: 42,
      episodes: 6,
      steps: 60,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
    for (const action of [
      'signIn',
      'linkProvider',
      'unlinkProvider',
      'setOnline',
    ]) {
      expect(report.coverage.actions[action] ?? 0).toBeGreaterThan(0);
    }
  }, 300_000);
});
