/**
 * The client gating layers this package can build whole: the access table's
 * (the decision the app renders a feature, its lock or its unlock from —
 * `useDecision`) and the daily puzzle limit's (what the app answers when a
 * rated puzzle is about to start — `usePermissions().can`, counting the
 * device's synced ledger).
 *
 * For tests and spec bindings only (a `root/` export).
 */

import type { TableDef } from '@pkgs/db-schema';
import type { DecisionLayer } from '@pkgs/dmn/registry';

import { useDecision } from '../../public/use-can';
import { usePermissions } from '../../public/use-permissions';
import { ACTION } from '../../shared/permission-catalog';
import { grantKeyOf } from './capabilities';
import { clientGatingLayer } from './client';
import { capabilityOf, identityFor, personOf } from './people';
import { insertStarted, startedEntries } from './puzzle-ledger';
import {
  ACCESS_REASONS,
  DAILY_PUZZLE_LIMIT_REASONS,
  tableAnswer,
} from './reasons';
import type { AppPolicy } from './world';

type ClientOptions = {
  readonly tables: readonly TableDef[];
  readonly policy?: AppPolicy;
};

/** `access`, on the device: the live decision for the capability's key. */
export function accessClientLayer(options: ClientOptions): DecisionLayer {
  return clientGatingLayer({
    ...options,
    observes: ['answer', 'reason'],
    probe: (input) => {
      const decision = useDecision(grantKeyOf(capabilityOf(input)));
      return () => tableAnswer(decision(), ACCESS_REASONS);
    },
  });
}

/**
 * `daily-puzzle-limit`, on the device: whether the app lets the person start
 * another rated puzzle, with their started puzzles in the synced ledger.
 */
export function dailyPuzzleLimitClientLayer(
  options: ClientOptions
): DecisionLayer {
  return clientGatingLayer({
    ...options,
    observes: ['answer', 'reason'],
    seed: (c) =>
      insertStarted(c.db, {
        ownerId: identityFor(personOf(c.input)).actorId,
        entries: startedEntries(c.input, c.nowMs),
      }),
    probe: () => {
      const permissions = usePermissions();
      return () =>
        tableAnswer(
          permissions.can(ACTION.puzzleRatedSolve),
          DAILY_PUZZLE_LIMIT_REASONS
        );
    },
  });
}
