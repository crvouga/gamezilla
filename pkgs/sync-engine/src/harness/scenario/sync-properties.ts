import { defineProperty } from '@pkgs/harness';

import {
  inSync,
  invariantViolations,
  partitioned,
  quiet,
} from './sync-observations';
import type { SyncHarness } from './system';

/** always(invariants hold) — read-only kit.checkInvariants */
export const invariantsHold = defineProperty({
  name: 'invariants',
  check: async (s: SyncHarness) => {
    const violations = await invariantViolations(s);
    if (violations.length > 0) {
      throw new Error(violations.join('; '));
    }
  },
});

/**
 * always(quiet ∧ healed ∧ every device connected ⇒ domain-agreed). Uses the pure `inSync`
 * read (no restoreNetwork / recoverAll side effects).
 */
export const staysInSync = defineProperty({
  name: 'staysInSync',
  check: async (s: SyncHarness) => {
    if (!quiet(s) || partitioned(s).length > 0) return;
    // A device taken offline (or signed out) has not healed: it is behind
    // by design until it reconnects.
    for (const client of s.clients.values()) {
      if (client.connection() === 'disconnected') return;
    }
    if (!(await inSync(s))) {
      throw new Error('quiet and healed but not inSync');
    }
  },
});

/** Standing properties registered on every sync system. */
export const SYNC_PROPERTY_DEFS = [invariantsHold, staysInSync] as const;
