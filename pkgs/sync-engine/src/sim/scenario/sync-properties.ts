import { defineSurface } from '@pkgs/dst';

import {
  clock,
  converged,
  invariantViolations,
  partitioned,
  quiet,
} from './sync-observations';
import type { SyncSurface } from './system';

const { defineProperty } = defineSurface<SyncSurface>();

/** always(invariants hold) — read-only kit.checkInvariants */
export const invariantsHold = defineProperty({
  name: 'invariants',
  check: async (s) => {
    const violations = await invariantViolations(s);
    if (violations.length > 0) {
      throw new Error(violations.join('; '));
    }
  },
});

/**
 * always(quiet ∧ healed ⇒ domain-agreed). Uses the pure `converged`
 * read (no heal / revive side effects).
 */
export const converges = defineProperty({
  name: 'converges',
  check: async (s) => {
    if (quiet(s) && partitioned(s).length === 0 && !(await converged(s))) {
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
  setup: (s) => ({
    armed: quiet(s) && partitioned(s).length === 0,
    t0: clock(s),
  }),
  check: async (s, ctx) => {
    if (!ctx.armed) return ctx;
    if (!quiet(s) || partitioned(s).length > 0 || (await converged(s))) {
      return { armed: false, t0: ctx.t0 };
    }
    if (clock(s) - ctx.t0 > 10_000) {
      throw new Error(
        `still diverged ${clock(s) - ctx.t0}ms after going quiet`
      );
    }
    return ctx;
  },
});

/** Default monitors for scripted pins + check campaigns. */
export const SYNC_PROPERTIES = [invariantsHold, converges] as const;
