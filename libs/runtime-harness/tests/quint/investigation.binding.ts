/**
 * `specs/runtime/investigation.qnt` against investigation trails.
 * Each action leaves the trail reading the model names.
 */

import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  followTrail,
  lookForTrail,
  recordTrail,
  trailKind,
} from '@libs/runtime-harness/privacy-retention';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const ALICE = 'alice';

function view(kind: string): {
  readonly shownToTeam: boolean;
  readonly shownToPerson: boolean;
  readonly reason: string;
} {
  if (kind === 'read')
    return { shownToTeam: true, shownToPerson: false, reason: 'none' };
  if (kind === 'expired')
    return { shownToTeam: false, shownToPerson: false, reason: 'expired' };
  if (kind === 'refused')
    return { shownToTeam: false, shownToPerson: false, reason: 'refused' };
  return { shownToTeam: false, shownToPerson: false, reason: 'nothing' };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'investigation',
  traces: 16,
  maxSteps: 6,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(followTrail, 'carol');
    },
    teamReadsRecent: async (w) => {
      await w.s.apply(recordTrail, ALICE, 1);
      await w.s.apply(followTrail, ALICE);
    },
    teamReadsExpired: async (w) => {
      await w.s.apply(recordTrail, ALICE, 30);
      await w.s.apply(followTrail, ALICE);
    },
    teamReadsNothing: async (w) => {
      await w.s.apply(followTrail, 'carol');
    },
    personLooks: async (w) => {
      await w.s.apply(recordTrail, ALICE, 1);
      await w.s.apply(lookForTrail, ALICE, ALICE);
    },
  },
  observe: async (w) => view(await w.quiet.read(trailKind)),
});
