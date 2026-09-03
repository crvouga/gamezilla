import { defineSurface, observe } from '@pkgs/dst';

import {
  clock,
  converged,
  invariantViolations,
  partitioned,
  quiet,
} from './sync-observations';
import type { SyncSurface } from './system';

const { defineProperty } = defineSurface<SyncSurface>();

/** always(invariants hold) — read-only checkInvariants */
export const invariantsHold = defineProperty({
  name: 'invariants',
  *watch() {
    const o = yield* observe({ violations: invariantViolations });
    if (o.violations.length > 0) {
      throw new Error(o.violations.join('; '));
    }
  },
});

/**
 * always(quiet ∧ healed ⇒ domain-agreed). Uses the pure `converged`
 * observation (no heal / revive side effects).
 */
export const converges = defineProperty({
  name: 'converges',
  *watch() {
    const o = yield* observe({ quiet, cut: partitioned, converged });
    if (o.quiet && o.cut.length === 0 && !o.converged) {
      throw new Error('quiet and healed but not converged');
    }
  },
});

/**
 * Liveness bound after quiet+healed. Not attached by default to short
 * check campaigns (chaos actions often leave the system intentionally
 * diverged until an explicit heal at the end of a pin).
 */
export const eventuallyConverges = defineProperty({
  name: 'eventuallyConverges',
  *watch() {
    const start = yield* observe({ quiet, cut: partitioned, clock });
    if (!start.quiet || start.cut.length > 0) return;
    const t0 = start.clock;
    while (true) {
      const o = yield* observe({
        quiet,
        cut: partitioned,
        converged,
        clock,
      });
      if (!o.quiet || o.cut.length > 0 || o.converged) break;
      if (o.clock - t0 > 10_000) {
        throw new Error(`still diverged ${o.clock - t0}ms after going quiet`);
      }
    }
  },
});

/** Default monitors for scripted pins + check campaigns. */
export const SYNC_PROPERTIES = [invariantsHold, converges] as const;
