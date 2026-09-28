/**
 * `specs/chess/daily-puzzle-limit.dmn` against the permission system:
 *
 * - application decision — the kernel's quota decision for the case's
 *   person (facts from the product's resolver), counting the case's solved
 *   puzzles through the product's window and ledger arithmetic;
 * - server enforcement — the rated-puzzle consume replayed against a server
 *   database holding the person's solved puzzles on the UTC day boundary
 *   (today's at midnight, earlier ones a millisecond before): allowed adds
 *   one ledger row, refused adds none and says why.
 */

import { BILLING_TABLES } from '@libs/billing/public/schema';
import { dailyPuzzleLimitApplicationLayer } from '@libs/permissions/root/conformance/application';
import { dailyPuzzleLimitServerLayer } from '@libs/permissions/root/conformance/server-layers';
import { bindDecisions } from '@pkgs/dmn/registry';

bindDecisions({
  spec: 'daily-puzzle-limit',
  layers: {
    'application decision': dailyPuzzleLimitApplicationLayer(),
    'server enforcement': dailyPuzzleLimitServerLayer({
      tables: BILLING_TABLES,
    }),
  },
});
