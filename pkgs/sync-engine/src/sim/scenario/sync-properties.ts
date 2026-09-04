import { defineProperty } from '@pkgs/sim';

import {
  inSync,
  invariantViolations,
  partitioned,
  quiet,
} from './sync-observations';
import type { SyncSim } from './system';

/** always(invariants hold) — read-only kit.checkInvariants */
export const invariantsHold = defineProperty({
  name: 'invariants',
  check: async (s: SyncSim) => {
    const violations = await invariantViolations(s);
    if (violations.length > 0) {
      throw new Error(violations.join('; '));
    }
  },
});

/**
 * always(quiet ∧ healed ⇒ domain-agreed). Uses the pure `inSync`
 * read (no restoreNetwork / recoverAll side effects).
 */
export const staysInSync = defineProperty({
  name: 'staysInSync',
  check: async (s: SyncSim) => {
    if (quiet(s) && partitioned(s).length === 0 && !(await inSync(s))) {
      throw new Error('quiet and healed but not inSync');
    }
  },
});

/** Standing properties registered on every sync system. */
export const SYNC_PROPERTY_DEFS = [invariantsHold, staysInSync] as const;
