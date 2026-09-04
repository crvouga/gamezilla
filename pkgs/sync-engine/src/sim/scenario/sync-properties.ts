import type { PropertyDef } from '@pkgs/dst';

import {
  converged,
  invariantViolations,
  partitioned,
  quiet,
} from './sync-observations';
import type { SyncSurface } from './system';

/** always(invariants hold) — read-only kit.checkInvariants */
export const invariantsHold: PropertyDef<SyncSurface> = {
  name: 'invariants',
  check: async (s) => {
    const violations = await invariantViolations(s);
    if (violations.length > 0) {
      throw new Error(violations.join('; '));
    }
  },
};

/**
 * always(quiet ∧ healed ⇒ domain-agreed). Uses the pure `converged`
 * read (no heal / revive side effects).
 */
export const converges: PropertyDef<SyncSurface> = {
  name: 'converges',
  check: async (s) => {
    if (quiet(s) && partitioned(s).length === 0 && !(await converged(s))) {
      throw new Error('quiet and healed but not converged');
    }
  },
};

/** Standing properties registered on every sync system. */
export const SYNC_PROPERTY_DEFS = [invariantsHold, converges] as const;
