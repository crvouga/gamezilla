import { defineProperty, observe } from '@pkgs/dst';

import {
  clock,
  converged,
  invariantViolations,
  partitioned,
  quiet,
} from './sync-observations';

/** always(invariants hold) — read-only checkInvariants */
export const invariantsHold = defineProperty({
  name: 'invariants',
  *watch() {
    while (true) {
      const violations = (yield invariantViolations) as string[];
      if (violations.length > 0) {
        throw new Error(violations.join('; '));
      }
    }
  },
});

/**
 * always(quiet ∧ healed ⇒ domain-agreed). Uses the pure `converged`
 * observation (no heal / assertConverged side effects).
 */
export const converges = defineProperty({
  name: 'converges',
  *watch() {
    while (true) {
      const [q, cut, ok] = (yield observe(quiet, partitioned, converged)) as [
        boolean,
        string[],
        boolean,
      ];
      if (q && cut.length === 0 && !ok) {
        throw new Error('quiet and healed but not converged');
      }
    }
  },
});

/**
 * Liveness bound after quiet+healed. Not attached by default to short
 * check campaigns (chaos actions often leave the world intentionally
 * diverged until an explicit heal at the end of a pin).
 */
export const eventuallyConverges = defineProperty({
  name: 'eventuallyConverges',
  *watch() {
    while (true) {
      const [q, cut, t0] = (yield observe(quiet, partitioned, clock)) as [
        boolean,
        string[],
        number,
      ];
      if (!q || cut.length > 0) continue;
      while (true) {
        const [q2, cut2, ok, t] = (yield observe(
          quiet,
          partitioned,
          converged,
          clock
        )) as [boolean, string[], boolean, number];
        if (!q2 || cut2.length > 0 || ok) break;
        if (t - t0 > 10_000) {
          throw new Error(`still diverged ${t - t0}ms after going quiet`);
        }
      }
    }
  },
});

/** Default monitors for scripted pins + check campaigns. */
export const SYNC_PROPERTIES = [invariantsHold, converges] as const;
